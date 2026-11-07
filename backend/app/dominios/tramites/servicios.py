import re

from app import db
from app.errores import ConflictoError, DatosInvalidosError, NoEncontradoError

from .modelos import Tramite

# --- Excepciones de dominio (el app factory las traduce a HTTP) ---


class TramiteNoEncontradoError(NoEncontradoError):
    pass


class TramiteDuplicadoError(ConflictoError):
    pass


class TramiteConTurnosError(ConflictoError):
    pass


def _texto(valor, campo, maximo, obligatorio=False):
    if valor is None:
        valor = ""
    if not isinstance(valor, str):
        raise DatosInvalidosError(f"El campo {campo} debe ser texto.")
    valor = valor.strip()
    if obligatorio and not valor:
        raise DatosInvalidosError(f"El {campo} del trámite es obligatorio.")
    if len(valor) > maximo:
        raise DatosInvalidosError(f"El campo {campo} no puede superar {maximo} caracteres.")
    return valor or None


def _tiempo(valor):
    if isinstance(valor, bool):
        raise DatosInvalidosError("El tiempo estimado debe ser un entero positivo.")
    try:
        tiempo = int(valor)
    except (TypeError, ValueError):
        raise DatosInvalidosError("El tiempo estimado debe ser un entero positivo.") from None
    if tiempo <= 0 or tiempo > 480 or (isinstance(valor, float) and not valor.is_integer()):
        raise DatosInvalidosError("El tiempo estimado debe estar entre 1 y 480 minutos.")
    return tiempo


def _campos_solicitud(valor):
    if valor is None:
        return []
    if not isinstance(valor, list) or len(valor) > 3:
        raise DatosInvalidosError("Cada trámite puede tener máximo 3 preguntas.")

    campos = []
    identificadores = set()
    tipos = {"texto", "parrafo", "seleccion", "si_no"}
    for campo in valor:
        if not isinstance(campo, dict):
            raise DatosInvalidosError("La configuración de preguntas no es válida.")
        identificador = campo.get("id")
        etiqueta = campo.get("etiqueta")
        tipo = campo.get("tipo")
        obligatorio = campo.get("obligatorio", False)
        if (
            not isinstance(identificador, str)
            or not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", identificador)
            or identificador in identificadores
        ):
            raise DatosInvalidosError("Cada pregunta debe tener un identificador único.")
        if not isinstance(etiqueta, str) or not etiqueta.strip() or len(etiqueta.strip()) > 120:
            raise DatosInvalidosError("Cada pregunta debe tener un título de hasta 120 caracteres.")
        if not isinstance(tipo, str) or tipo not in tipos:
            raise DatosInvalidosError("El tipo de pregunta no es válido.")
        if not isinstance(obligatorio, bool):
            raise DatosInvalidosError("La opción obligatoria de cada pregunta debe ser booleana.")

        opciones = campo.get("opciones", [])
        if tipo == "seleccion":
            if (
                not isinstance(opciones, list)
                or not 2 <= len(opciones) <= 8
                or any(not isinstance(opcion, str) or not opcion.strip() for opcion in opciones)
                or any(len(opcion.strip()) > 100 for opcion in opciones)
            ):
                raise DatosInvalidosError(
                    "Cada pregunta de selección debe tener entre 2 y 8 opciones válidas."
                )
            opciones = [opcion.strip() for opcion in opciones]
            if len({opcion.casefold() for opcion in opciones}) != len(opciones):
                raise DatosInvalidosError("Las opciones de una pregunta no pueden repetirse.")
        else:
            opciones = []

        identificadores.add(identificador)
        campos.append(
            {
                "id": identificador,
                "etiqueta": etiqueta.strip(),
                "tipo": tipo,
                "obligatorio": obligatorio,
                "opciones": opciones,
            }
        )
    return campos


FLUJOS = ("GENERAL", "ENTREGA", "GARANTIA", "RECLAMO")
FLUJOS_CON_PREPARACION = ("ENTREGA", "GARANTIA")


def _flujo(valor):
    flujo = str(valor or "GENERAL").upper()
    if flujo not in FLUJOS:
        raise DatosInvalidosError("Tipo de atención no válido.")
    return flujo


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
        raise TramiteDuplicadoError("Ya existe un trámite con ese nombre.")

    flujo = _flujo(datos.get("tipo_flujo", "GENERAL"))
    tramite = Tramite(
        requiere_preparacion=flujo in FLUJOS_CON_PREPARACION,
        nombre=nombre,
        descripcion=_texto(datos.get("descripcion"), "descripción", 1000),
        instrucciones_preparacion=_texto(
            datos.get("instrucciones_preparacion"), "instrucciones", 1000
        ),
        campos_solicitud=_campos_solicitud(datos.get("campos_solicitud")),
        tiempo_estimado=_tiempo(datos.get("tiempo_estimado", 15)),
        tipo_flujo=_flujo(datos.get("tipo_flujo", "GENERAL")),
        activo=bool(datos.get("activo", True)),
    )
    db.session.add(tramite)
    db.session.commit()
    return tramite


def actualizar_tramite(tramite_id, datos):
    tramite = db.session.get(Tramite, tramite_id)
    if not tramite:
        raise TramiteNoEncontradoError("El trámite no existe.")

    if "nombre" in datos:
        nombre = _texto(datos["nombre"], "nombre", 100, obligatorio=True)
        if _nombre_duplicado(nombre, tramite.id):
            raise TramiteDuplicadoError("Ya existe un trámite con ese nombre.")
        tramite.nombre = nombre
    if "descripcion" in datos:
        tramite.descripcion = _texto(datos["descripcion"], "descripción", 1000)
    if "instrucciones_preparacion" in datos:
        tramite.instrucciones_preparacion = _texto(
            datos["instrucciones_preparacion"], "instrucciones", 1000
        )
    if "campos_solicitud" in datos:
        tramite.campos_solicitud = _campos_solicitud(datos["campos_solicitud"])
    if "tiempo_estimado" in datos:
        tramite.tiempo_estimado = _tiempo(datos["tiempo_estimado"])
    if "tipo_flujo" in datos:
        tramite.tipo_flujo = _flujo(datos["tipo_flujo"])
    # La preparación previa depende del tipo de atención (ADR-010 revisado):
    # solo se alista lo que el cliente viene a recoger o a dejar en garantía.
    tramite.requiere_preparacion = (tramite.tipo_flujo or "GENERAL") in FLUJOS_CON_PREPARACION
    if "activo" in datos:
        tramite.activo = bool(datos["activo"])

    db.session.commit()
    return tramite


def eliminar_tramite(tramite_id):
    from app.dominios.franjas.modelos import Franja

    tramite = db.session.get(Tramite, tramite_id)
    if not tramite:
        raise TramiteNoEncontradoError("El trámite no existe.")

    if tramite.turnos:
        raise TramiteConTurnosError(
            "El trámite tiene turnos registrados. Desactívalo en lugar de eliminarlo."
        )

    Franja.query.filter_by(tramite_id=tramite.id).delete()
    db.session.delete(tramite)
    db.session.commit()
