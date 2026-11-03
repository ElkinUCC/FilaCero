from datetime import date, datetime

from flask import Blueprint, jsonify, request

from app import db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.modelos import Turno
from app.horario import (
    ahora_local,
    asegurar_franjas,
    capacidad_sede,
    dentro_de_horario,
    ocupacion_sede_dia,
    validar_fecha_reservable,
    zona,
)
from app.seguridad import limitar

disponibilidad_bp = Blueprint("disponibilidad", __name__)


@disponibilidad_bp.get("/disponibles")
@limitar("LIMITE_PUBLICO_POR_MINUTO")
def consultar_disponibilidad():
    """Franjas reservables por sede, trámite y fecha (YYYY-MM-DD).

    Si la sede/trámite no tiene franjas ese día, se generan automáticamente
    según el horario configurado (por defecto todos los días, 24 horas).
    """
    sede_id = request.args.get("sede_id", type=int)
    tramite_id = request.args.get("tramite_id", type=int)
    fecha_texto = request.args.get("fecha", "")

    if not sede_id or not tramite_id or not fecha_texto:
        return jsonify({"error": "Debes indicar sede_id, tramite_id y fecha (YYYY-MM-DD)."}), 400

    try:
        fecha_consulta = date.fromisoformat(fecha_texto)
    except ValueError:
        return jsonify({"error": "La fecha debe tener formato YYYY-MM-DD."}), 400

    try:
        validar_fecha_reservable(fecha_consulta)
    except ValueError as error:
        return jsonify({"error": str(error), "cantidad": 0, "franjas": []}), 400

    sede = db.session.get(Punto, sede_id)
    tramite = db.session.get(Tramite, tramite_id)

    if not sede or not sede.activo:
        return jsonify({"error": "La sede no existe o está inactiva."}), 404
    if not tramite or not tramite.activo:
        return jsonify({"error": "El trámite no existe o está inactivo."}), 404

    asegurar_franjas(sede, tramite, fecha_consulta)

    franjas = (
        Franja.query.filter(
            Franja.punto_id == sede_id,
            Franja.tramite_id == tramite_id,
            Franja.fecha == fecha_consulta,
            Franja.activa.is_(True),
        )
        .order_by(Franja.hora_inicio.asc())
        .all()
    )

    # Un solo query para contar reservas de todas las franjas del día.
    ids = [f.id for f in franjas]
    conteo = (
        dict(
            db.session.query(Turno.franja_id, db.func.count(Turno.id))
            .filter(Turno.franja_id.in_(ids), Turno.estado.notin_(("CANCELADO",)))
            .group_by(Turno.franja_id)
            .all()
        )
        if ids
        else {}
    )

    cupo_sede = capacidad_sede(sede_id)
    ocupada = ocupacion_sede_dia(sede_id, fecha_consulta)

    ahora = ahora_local()
    resultado = []
    for franja in franjas:
        inicio = datetime.combine(franja.fecha, franja.hora_inicio, tzinfo=zona())
        if inicio <= ahora:
            continue
        if not dentro_de_horario(franja.hora_inicio, franja.hora_fin):
            continue

        reservados = conteo.get(franja.id, 0)
        # Disponible = lo que permita la franja Y la sede completa a esa hora.
        disponibles = max(
            0,
            min(
                franja.capacidad - reservados,
                cupo_sede - ocupada.get(franja.hora_inicio, 0),
            ),
        )
        if disponibles == 0:
            continue

        resultado.append(
            {
                "franja_id": franja.id,
                "sede_id": franja.punto_id,
                "tramite_id": franja.tramite_id,
                "fecha": franja.fecha.isoformat(),
                "hora_inicio": franja.hora_inicio.strftime("%H:%M"),
                "hora_fin": franja.hora_fin.strftime("%H:%M"),
                "capacidad": franja.capacidad,
                "reservados": reservados,
                "disponibles": disponibles,
                "jornada": "mañana" if franja.hora_inicio.hour < 12 else "tarde",
            }
        )

    return (
        jsonify(
            {
                "sede": sede.nombre,
                "tramite": tramite.nombre,
                "fecha": fecha_consulta.isoformat(),
                "cantidad": len(resultado),
                "franjas": resultado,
            }
        ),
        200,
    )
