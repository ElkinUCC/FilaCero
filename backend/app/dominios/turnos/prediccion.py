from datetime import datetime

from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app import db
from app.dominios.usuarios.modelos import Usuario
from .modelos import Turno
from .repositorios import posicion_en_cola

prediccion_bp = Blueprint("prediccion", __name__)


def _predecir_duracion(turno):
    """Regresión lineal ligera sobre las últimas 100 atenciones (segundos)."""
    historial = (
        db.session.query(Turno.fecha_inicio, Turno.fecha_fin)
        .filter(
            Turno.estado == "ATENDIDO",
            Turno.fecha_inicio.isnot(None),
            Turno.fecha_fin.isnot(None),
            Turno.tramite_id == turno.tramite_id,
            Turno.punto_id == turno.punto_id,
        )
        .order_by(Turno.fecha_fin.desc())
        .limit(100)
        .all()
    )
    duraciones = [(fin - inicio).total_seconds() for inicio, fin in historial if fin > inicio]

    if len(duraciones) < 5:
        if duraciones:
            duraciones.sort()
            n = len(duraciones)
            base = duraciones[n // 2] if n % 2 else (duraciones[n // 2 - 1] + duraciones[n // 2]) / 2
        else:
            base = (turno.tramite.tiempo_estimado if turno.tramite else 10) * 60
        return base, len(duraciones), "respaldo_estadistico"

    valores = list(reversed(duraciones))
    x_media = (len(valores) - 1) / 2
    y_media = sum(valores) / len(valores)
    denominador = sum((i - x_media) ** 2 for i in range(len(valores)))
    pendiente = (
        sum((i - x_media) * (y - y_media) for i, y in enumerate(valores)) / denominador
        if denominador else 0
    )
    prediccion = y_media + pendiente * (len(valores) - 1 - x_media)
    return max(60, min(prediccion, 7200)), len(valores), "regresion_lineal"


def estimar_espera(turno):
    if turno.estado != "ESPERANDO":
        return {"turnos_antes": 0, "tiempo_estimado_minutos": 0}

    duracion, muestras, modelo = _predecir_duracion(turno)
    antes = posicion_en_cola(turno)
    agentes = max(1, Usuario.query.filter_by(
        rol="AGENTE", activo=True, punto_asignado_id=turno.punto_id
    ).count())
    en_atencion = Turno.query.filter(
        Turno.punto_id == turno.punto_id,
        Turno.estado.in_(("LLAMADO", "EN_ATENCION")),
    ).count()

    minutos = round(((antes + en_atencion) * duracion / agentes) / 60)
    return {
        "turnos_antes": antes,
        "tiempo_estimado_minutos": minutos,
        "muestras_historicas": muestras,
        "modelo": modelo,
    }


@prediccion_bp.get("/<int:turno_id>/tiempo-espera")
@jwt_required()
def tiempo_espera(turno_id):
    turno = db.session.get(Turno, turno_id)
    if not turno:
        return jsonify({"error": "Turno no encontrado"}), 404

    # Solo el dueño, un agente de la misma sede o un administrador.
    usuario = db.session.get(Usuario, int(get_jwt_identity()))
    permitido = usuario and usuario.activo and (
        usuario.id == turno.usuario_id
        or usuario.rol == "ADMIN"
        or (usuario.rol == "AGENTE" and usuario.punto_asignado_id == turno.punto_id)
    )
    if not permitido:
        # 404 y no 403: no se revela que el turno existe.
        return jsonify({"error": "Turno no encontrado"}), 404

    if turno.estado in ("ATENDIDO", "CANCELADO", "NO_ASISTIO", "EN_ATENCION"):
        return jsonify({
            "turno_id": turno.id,
            "estado": turno.estado,
            "tiempo_estimado_minutos": 0,
            "mensaje": "El turno ya no está en espera.",
        }), 200

    return jsonify({
        "turno_id": turno.id,
        "estado": turno.estado,
        **estimar_espera(turno),
        "generado_en": datetime.now().isoformat(timespec="seconds"),
        "nota": "Estimación orientativa basada en atenciones anteriores.",
    }), 200
