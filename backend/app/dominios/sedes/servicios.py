from app import db
from .modelos import Punto


def listar_puntos():
    return Punto.query.order_by(Punto.nombre.asc()).all()


def crear_punto(datos):
    nombre = datos.get("nombre", "").strip()
    if not nombre:
        raise ValueError("El nombre de la sede es obligatorio.")

    punto = Punto(
        nombre=nombre,
        direccion=datos.get("direccion"),
        activo=datos.get("activo", True)
    )
    db.session.add(punto)
    db.session.commit()
    return punto


def actualizar_punto(punto_id, datos):
    punto = db.session.get(Punto, punto_id)
    if not punto:
        raise ValueError("La sede no existe.")

    if "nombre" in datos:
        nombre = datos["nombre"].strip()
        if not nombre:
            raise ValueError("El nombre de la sede es obligatorio.")
        punto.nombre = nombre

    if "direccion" in datos:
        punto.direccion = datos["direccion"]

    if "activo" in datos:
        punto.activo = bool(datos["activo"])

    db.session.commit()
    return punto


def eliminar_punto(punto_id):
    punto = db.session.get(Punto, punto_id)
    if not punto:
        raise ValueError("La sede no existe.")

    if punto.turnos or punto.franjas:
        raise ValueError(
            "La sede tiene turnos o franjas asociadas. Desactívala en lugar de eliminarla."
        )

    db.session.delete(punto)
    db.session.commit()
