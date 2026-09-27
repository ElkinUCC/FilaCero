def punto_response(punto):
    return {
        "id": punto.id,
        "nombre": punto.nombre,
        "direccion": punto.direccion,
        "activo": punto.activo
    }