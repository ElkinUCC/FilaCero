def punto_response(punto, *, operativo=False):
    datos = {
        "id": punto.id,
        "nombre": punto.nombre,
        "direccion": punto.direccion,
        "activo": bool(punto.activo),
    }
    if operativo:
        # Solo para el panel: capacidad real de la sede por franja.
        from app.horario import asesores_activos, cupos_por_asesor

        asesores = asesores_activos(punto.id)
        datos["asesores_activos"] = asesores
        datos["cupos_por_franja"] = asesores * cupos_por_asesor()
    return datos
