
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request

from app import db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.modelos import Turno


ZONA = ZoneInfo("America/Bogota")

disponibilidad_bp = Blueprint(
    "disponibilidad",
    __name__,
)


@disponibilidad_bp.get("/disponibles")
def consultar_disponibilidad():
    """
    Consulta franjas reservables por sede, trámite y fecha.

    Parámetros:
        sede_id: identificador de la sede
        tramite_id: identificador del trámite
        fecha: fecha en formato YYYY-MM-DD
    """
    sede_id = request.args.get("sede_id", type=int)
    tramite_id = request.args.get("tramite_id", type=int)
    fecha_texto = request.args.get("fecha", "")

    if not sede_id or not tramite_id or not fecha_texto:
        return jsonify({
            "error": (
                "Debes indicar sede_id, tramite_id "
                "y fecha (YYYY-MM-DD)."
            )
        }), 400

    try:
        fecha_consulta = date.fromisoformat(fecha_texto)
    except ValueError:
        return jsonify({
            "error": "La fecha debe tener formato YYYY-MM-DD."
        }), 400

    ahora = datetime.now(ZONA)

    if fecha_consulta < ahora.date():
        return jsonify({
            "error": "No se pueden reservar fechas pasadas."
        }), 400

    if fecha_consulta.weekday() >= 5:
        return jsonify({
            "error": "La atención está programada de lunes a viernes.",
            "cantidad": 0,
            "franjas": [],
        }), 200

    sede = db.session.get(Punto, sede_id)
    tramite = db.session.get(Tramite, tramite_id)

    if not sede or not sede.activo:
        return jsonify({
            "error": "La sede no existe o está inactiva."
        }), 404

    if not tramite or not tramite.activo:
        return jsonify({
            "error": "El trámite no existe o está inactivo."
        }), 404

    franjas = (
        Franja.query
        .filter(
            Franja.punto_id == sede_id,
            Franja.tramite_id == tramite_id,
            Franja.fecha == fecha_consulta,
            Franja.activa.is_(True),
        )
        .order_by(Franja.hora_inicio.asc())
        .all()
    )

    resultado = []

    for franja in franjas:
        inicio_franja = datetime.combine(
            franja.fecha,
            franja.hora_inicio,
            tzinfo=ZONA,
        )

        # No mostrar franjas que ya comenzaron.
        if inicio_franja <= ahora:
            continue

        # Respetar el horario de atención: 08:00 a 17:00.
        if (
            franja.hora_inicio < time(8, 0)
            or franja.hora_fin > time(17, 0)
            or franja.hora_fin <= franja.hora_inicio
        ):
            continue

        reservados = (
            db.session.query(db.func.count(Turno.id))
            .filter(
                Turno.franja_id == franja.id,
                Turno.estado != "CANCELADO",
            )
            .scalar()
            or 0
        )

        disponibles = max(0, franja.capacidad - reservados)

        if disponibles == 0:
            continue

        resultado.append({
            "franja_id": franja.id,
            "sede_id": franja.punto_id,
            "tramite_id": franja.tramite_id,
            "fecha": franja.fecha.isoformat(),
            "hora_inicio": franja.hora_inicio.strftime("%H:%M"),
            "hora_fin": franja.hora_fin.strftime("%H:%M"),
            "capacidad": franja.capacidad,
            "reservados": reservados,
            "disponibles": disponibles,
        })

    return jsonify({
        "sede": sede.nombre,
        "tramite": tramite.nombre,
        "fecha": fecha_consulta.isoformat(),
        "cantidad": len(resultado),
        "franjas": resultado,
    }), 200
