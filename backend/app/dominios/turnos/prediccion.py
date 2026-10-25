
from datetime import datetime

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app import db
from app.dominios.turnos.modelos import Turno

prediccion_bp = Blueprint("prediccion", __name__)


def _predecir_duracion(turno):
    """Regresión lineal ligera con duraciones históricas."""

    historial = (
        db.session.query(
            Turno.fecha_inicio,
            Turno.fecha_fin,
        )
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

    duraciones = [
        (fin - inicio).total_seconds()
        for inicio, fin in historial
        if fin > inicio
    ]

    # Respaldo: mediana histórica o 10 minutos.
    if len(duraciones) < 5:
        if duraciones:
            duraciones.sort()
            n = len(duraciones)
            base = (
                duraciones[n // 2]
                if n % 2
                else (duraciones[n // 2 - 1] + duraciones[n // 2]) / 2
            )
        else:
            base = 600
        return base, len(duraciones), "respaldo_estadistico"

    # Regresión lineal: identifica la tendencia reciente
    # de duración de atención en la secuencia histórica.
    valores = list(reversed(duraciones))
    x_media = (len(valores) - 1) / 2
    y_media = sum(valores) / len(valores)

    denominador = sum(
        (i - x_media) ** 2 for i in range(len(valores))
    )

    pendiente = (
        sum(
            (i - x_media) * (y - y_media)
            for i, y in enumerate(valores)
        ) / denominador
        if denominador
        else 0
    )

    prediccion = y_media + pendiente * (
        len(valores) - 1 - x_media
    )

    return max(60, min(prediccion, 7200)), len(valores), "regresion_lineal"


@prediccion_bp.get("/<int:turno_id>/tiempo-espera")
@jwt_required()
def tiempo_espera(turno_id):
    turno = db.session.get(Turno, turno_id)

    if not turno:
        return jsonify({"error": "Turno no encontrado"}), 404

    if turno.estado in ("ATENDIDO", "CANCELADO"):
        return jsonify({
            "turno_id": turno.id,
            "estado": turno.estado,
            "tiempo_estimado_minutos": 0,
            "mensaje": "El turno ya no está en espera."
        }), 200

    if turno.estado == "EN_ATENCION":
        return jsonify({
            "turno_id": turno.id,
            "estado": turno.estado,
            "tiempo_estimado_minutos": 0,
            "mensaje": "La atención de este turno ya comenzó."
        }), 200

    duracion, muestras, modelo = _predecir_duracion(turno)

    delante = (
        db.session.query(func.count(Turno.id))
        .filter(
            Turno.punto_id == turno.punto_id,
            Turno.franja_id == turno.franja_id,
            Turno.estado == "ESPERANDO",
            Turno.hora_solicitud < turno.hora_solicitud,
        )
        .scalar()
        or 0
    )

    # Si hay un turno en atención en esta sede y franja,
    # también se estima su tiempo restante usando la duración media.
    en_atencion = (
        db.session.query(func.count(Turno.id))
        .filter(
            Turno.punto_id == turno.punto_id,
            Turno.franja_id == turno.franja_id,
            Turno.estado == "EN_ATENCION",
        )
        .scalar()
        or 0
    )

    minutos = round((delante + en_atencion) * duracion / 60)

    return jsonify({
        "turno_id": turno.id,
        "estado": turno.estado,
        "turnos_antes": delante,
        "tiempo_estimado_minutos": minutos,
        "muestras_historicas": muestras,
        "modelo": modelo,
        "generado_en": datetime.now().isoformat(timespec="seconds"),
        "nota": "Estimación orientativa basada en atenciones anteriores."
    }), 200
