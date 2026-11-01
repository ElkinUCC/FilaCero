from app import db
from .modelos import Tramite


def _texto(valor, campo, maximo, obligatorio=False):
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise ValueError(f"El campo {campo} debe ser texto.")
    valor = valor.strip()
    if obligatorio and not valor:
        raise ValueError(f"El {campo} del trámite es obligatorio.")
    if len(valor) > maximo:
        raise ValueError(f"El campo {campo} no puede superar {maximo} caracteres.")
    return valor or None


def _tiempo(valor):
    if isinstance(valor, bool):
        raise ValueError("El tiempo estimado debe ser un entero positivo.")
    try:
        tiempo = int(valor)
    except (TypeError, ValueError):
        raise ValueError("El tiempo estimado debe ser un entero positivo.")
    if tiempo <= 0 or tiempo > 480 or (isinstance(valor, float) and not valor.is_integer()):
        raise ValueError("El tiempo estimado debe estar entre 1 y 480 minutos.")
    return tiempo


def _nombre_duplicado(nombre, excluir_id=None):
    consulta = Tramite.query.filter(db.func.lower(Tramite.nombre) == nombre.lower())
    if excluir_id:
        consulta = consulta.filter(Tramite.id != excluir_id)
    return consulta.first() is not None


def listar_tramites():
    return Tramite.query.order_by(Tramite.nombre.asc()).all()


def crear_tramite(datos):
    nombre = _texto(datos.get("nombre"), "nombre", 100, obligatorio=True)
    if _nombre_duplicado(nombre):
        raise ValueError("Ya existe un trámite con ese nombre.")

    tramite = Tramite(
        nombre=nombre,
        descripcion=_texto(datos.get("descripcion"), "descripción", 1000),
        tiempo_estimado=_tiempo(datos.get("tiempo_estimado", 15)),
        activo=bool(datos.get("activo", True)),
    )
    db.session.add(tramite)
    db.session.commit()
    return tramite


def actualizar_tramite(tramite_id, datos):
    tramite = db.session.get(Tramite, tramite_id)
    if not tramite:
        raise ValueError("El trámite no existe.")

    if "nombre" in datos:
        nombre = _texto(datos["nombre"], "nombre", 100, obligatorio=True)
        if _nombre_duplicado(nombre, tramite.id):
            raise ValueError("Ya existe un trámite con ese nombre.")
        tramite.nombre = nombre
    if "descripcion" in datos:
        tramite.descripcion = _texto(datos["descripcion"], "descripción", 1000)
    if "tiempo_estimado" in datos:
        tramite.tiempo_estimado = _tiempo(datos["tiempo_estimado"])
    if "activo" in datos:
        tramite.activo = bool(datos["activo"])

    db.session.commit()
    return tramite


def eliminar_tramite(tramite_id):
    from app.dominios.franjas.modelos import Franja

    tramite = db.session.get(Tramite, tramite_id)
    if not tramite:
        raise ValueError("El trámite no existe.")

    if tramite.turnos:
        raise ValueError(
            "El trámite tiene turnos registrados. Desactívalo en lugar de eliminarlo."
        )

    Franja.query.filter_by(tramite_id=tramite.id).delete()
    db.session.delete(tramite)
    db.session.commit()
