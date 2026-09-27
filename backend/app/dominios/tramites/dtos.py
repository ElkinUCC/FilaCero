def tramite_response(tramite):
    return {
        "id": tramite.id,
        "nombre": tramite.nombre,
        "descripcion": tramite.descripcion,
        "tiempo_estimado": tramite.tiempo_estimado,
        "activo": tramite.activo
    }