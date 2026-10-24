def turno_response(turno):
    return {
        "id": turno.id,
        "codigo": turno.codigo,
        "fecha": turno.franja.fecha.isoformat(),
        "hora_inicio": turno.franja.hora_inicio.strftime("%H:%M"),
        "hora_fin": turno.franja.hora_fin.strftime("%H:%M"),
        "hora_solicitud": (
            turno.hora_solicitud.isoformat()
            if turno.hora_solicitud else None
        ),
        "estado": turno.estado,
        "usuario_id": turno.usuario_id,
        "tramite_id": turno.tramite_id,
        "punto_id": turno.punto_id,
        "franja_id": turno.franja_id
    }
