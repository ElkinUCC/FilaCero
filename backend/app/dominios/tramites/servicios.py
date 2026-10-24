from app import db
from .modelos import Tramite


def listar_tramites():
    return Tramite.query.order_by(Tramite.nombre.asc()).all()


def crear_tramite(datos):
    nombre = datos.get("nombre", "").strip()
    if not nombre:
        raise ValueError("El nombre del trámite es obligatorio.")

    tiempo = datos.get("tiempo_estimado", 15)
    if not isinstance(tiempo, int) or tiempo <= 0:
        raise ValueError("El tiempo estimado debe ser un entero positivo.")

    tramite = Tramite(
        nombre=nombre,
        descripcion=datos.get("descripcion"),
        tiempo_estimado=tiempo,
        activo=datos.get("activo", True)
    )
    db.session.add(tramite)
    db.session.commit()
    return tramite


def actualizar_tramite(tramite_id, datos):
    tramite = db.session.get(Tramite, tramite_id)
    if not tramite:
        raise ValueError("El trámite no existe.")

    if "nombre" in datos:
        nombre = datos["nombre"].strip()
        if not nombre:
            raise ValueError("El nombre del trámite es obligatorio.")
        tramite.nombre = nombre

    if "descripcion" in datos:
        tramite.descripcion = datos["descripcion"]

    if "tiempo_estimado" in datos:
        tiempo = datos["tiempo_estimado"]
        if not isinstance(tiempo, int) or tiempo <= 0:
            raise ValueError("El tiempo estimado debe ser un entero positivo.")
        tramite.tiempo_estimado = tiempo

    if "activo" in datos:
        tramite.activo = bool(datos["activo"])

    db.session.commit()
    return tramite


def eliminar_tramite(tramite_id):
    tramite = db.session.get(Tramite, tramite_id)
    if not tramite:
        raise ValueError("El trámite no existe.")

    if tramite.turnos or tramite.franjas:
        raise ValueError(
            "El trámite tiene turnos o franjas asociadas. Desactívalo en lugar de eliminarlo."
        )

    db.session.delete(tramite)
    db.session.commit()
