def tramite_response(tramite):
    return {
        "id": tramite.id,
        "nombre": tramite.nombre,
        "descripcion": tramite.descripcion,
        "instrucciones_preparacion": tramite.instrucciones_preparacion,
        "campos_solicitud": tramite.campos_solicitud or [],
        "tiempo_estimado": tramite.tiempo_estimado,
        "requiere_preparacion": bool(tramite.requiere_preparacion),
        "tipo_flujo": tramite.tipo_flujo or "GENERAL",
        "activo": bool(tramite.activo),
    }
