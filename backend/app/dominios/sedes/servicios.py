from app import db
from app.errores import ConflictoError, DatosInvalidosError, NoEncontradoError

from .modelos import Punto

# Excepciones de dominio (el app factory las traduce a HTTP)


class SedeNoEncontradaError(NoEncontradoError):
    pass


class SedeDuplicadaError(ConflictoError):
    pass


class SedeConTurnosError(ConflictoError):
    pass


def _texto(valor, campo, maximo, obligatorio=False):
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise DatosInvalidosError(f"El campo {campo} debe ser texto.")
    valor = " ".join(valor.split())
    if obligatorio and not valor:
        raise DatosInvalidosError(f"El {campo} de la sede es obligatorio.")
    if len(valor) > maximo:
        raise DatosInvalidosError(f"El {campo} no puede superar {maximo} caracteres.")
    return valor or None


def _nombre_duplicado(nombre, excluir_id=None):
    consulta = Punto.query.filter(db.func.lower(Punto.nombre) == nombre.lower())
    if excluir_id:
        consulta = consulta.filter(Punto.id != excluir_id)
    return consulta.first() is not None


def listar_puntos():
    return Punto.query.order_by(Punto.nombre.asc()).all()


def crear_punto(datos):
    nombre = _texto(datos.get("nombre"), "nombre", 100, obligatorio=True)
    if _nombre_duplicado(nombre):
        raise SedeDuplicadaError("Ya existe una sede con ese nombre.")

    punto = Punto(
        nombre=nombre,
        direccion=_texto(datos.get("direccion"), "dirección", 200),
        activo=bool(datos.get("activo", True)),
    )
    db.session.add(punto)
    db.session.commit()
    return punto


def actualizar_punto(punto_id, datos):
    punto = db.session.get(Punto, punto_id)
    if not punto:
        raise SedeNoEncontradaError("La sede no existe.")

    if "nombre" in datos:
        nombre = _texto(datos["nombre"], "nombre", 100, obligatorio=True)
        if _nombre_duplicado(nombre, punto.id):
            raise SedeDuplicadaError("Ya existe una sede con ese nombre.")
        punto.nombre = nombre
    if "direccion" in datos:
        punto.direccion = _texto(datos["direccion"], "dirección", 200)
    if "activo" in datos:
        punto.activo = bool(datos["activo"])

    db.session.commit()
    return punto


def eliminar_punto(punto_id):
    from app.dominios.franjas.modelos import Franja
    from app.dominios.usuarios.modelos import Usuario

    punto = db.session.get(Punto, punto_id)
    if not punto:
        raise SedeNoEncontradaError("La sede no existe.")

    if punto.turnos:
        raise SedeConTurnosError(
            "La sede tiene turnos registrados. Desactívala en lugar de eliminarla."
        )

    # Sin turnos: las franjas (posiblemente automáticas) se pueden borrar.
    Franja.query.filter_by(punto_id=punto.id).delete()
    Usuario.query.filter_by(punto_asignado_id=punto.id).update({"punto_asignado_id": None})
    db.session.delete(punto)
    db.session.commit()
