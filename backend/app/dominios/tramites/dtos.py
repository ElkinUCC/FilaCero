def tramite_response(tramite):
    return {
        "id": tramite.id,
        "nombre": tramite.nombre,
        "descripcion": tramite.descripcion,
        "instrucciones_preparacion": tramite.instrucciones_preparacion,
        "campos_solicitud": tramite.campos_solicitud or [],
        "tiempo_estimado": tramite.tiempo_estimado,
        "activo": bool(tramite.activo),
    }
