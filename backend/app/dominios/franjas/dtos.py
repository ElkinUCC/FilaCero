def franja_response(franja):
    return {
        "id": franja.id,
        "punto_id": franja.punto_id,
        "tramite_id": franja.tramite_id,
        "fecha": franja.fecha.isoformat(),
        "hora_inicio": franja.hora_inicio.strftime("%H:%M"),
        "hora_fin": franja.hora_fin.strftime("%H:%M"),
        "capacidad": franja.capacidad,
        "activa": franja.activa
    }
