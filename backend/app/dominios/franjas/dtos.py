"""Contratos JSON (DTO) de las franjas."""


def franja_response(franja):
    return {
        "id": franja.id,
        "punto_id": franja.punto_id,
        "tramite_id": franja.tramite_id,
        "fecha": franja.fecha.isoformat(),
        "hora_inicio": franja.hora_inicio.strftime("%H:%M"),
        "hora_fin": franja.hora_fin.strftime("%H:%M"),
        "capacidad": franja.capacidad,
        "activa": franja.activa,
    }


def franja_disponibilidad_response(franja, reservados, disponibles):
    """Franja con su ocupación (listado general /api/v1/franjas)."""
    return {
        "id": franja.id,
        "punto_id": franja.punto_id,
        "punto": franja.punto.nombre,
        "tramite_id": franja.tramite_id,
        "tramite": franja.tramite.nombre,
        "fecha": franja.fecha.isoformat(),
        "hora_inicio": franja.hora_inicio.strftime("%H:%M"),
        "hora_fin": franja.hora_fin.strftime("%H:%M"),
        "capacidad": franja.capacidad,
        "reservados": reservados,
        "disponibles": disponibles,
        "disponible": disponibles > 0,
    }


def franja_reservable_response(franja, reservados, disponibles):
    """Franja que el ciudadano puede elegir en el asistente de reserva."""
    return {
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
