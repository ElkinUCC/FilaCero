def turno_response(turno):
    return {
        "id": turno.id,
        "codigo": turno.codigo,
        "fecha": str(turno.fecha),
        "hora_solicitud": turno.hora_solicitud.isoformat(),
        "estado": turno.estado,
        "usuario_id": turno.usuario_id,
        "tramite_id": turno.tramite_id,
        "punto_id": turno.punto_id
    }