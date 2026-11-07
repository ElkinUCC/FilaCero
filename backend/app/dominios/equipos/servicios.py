"""Servicios del dominio Equipos (órdenes de servicio).

Reglas:
  - Un equipo pertenece a un cliente (identificado por su celular) y a una sede.
  - Transiciones válidas: POR_RECIBIR -> RECIBIDO -> EN_REPARACION -> LISTO -> ENTREGADO
    (se permite retroceder un paso para corregir, nunca desde ENTREGADO).
  - Garantía: televisores con fecha de compra de máximo 1 año.
  - Para reservar una entrega el equipo debe estar LISTO y ser del celular verificado.
"""

import secrets
from datetime import UTC, date, datetime, timedelta

from app import db
from app.dominios.sedes.modelos import Punto
from app.errores import ConflictoError, DatosInvalidosError, NoEncontradoError

from .dtos import ESTADOS_EQUIPO
from .modelos import Equipo
from .repositorios import existe_codigo, obtener, por_cliente

GARANTIA_DIAS = 365
ORDEN = ["POR_RECIBIR", "RECIBIDO", "EN_REPARACION", "LISTO", "ENTREGADO"]
MARCAS = [
    "Samsung",
    "LG",
    "Sony",
    "TCL",
    "Hisense",
    "Kalley",
    "Challenger",
    "Xiaomi",
    "Philips",
    "Otra",
]


def _ahora():
    return datetime.now(UTC).replace(tzinfo=None)


def _texto(valor, campo, maximo, obligatorio=False):
    texto = " ".join(str(valor or "").split())
    if obligatorio and len(texto) < 2:
        raise DatosInvalidosError(f"Completa el campo {campo}.")
    if len(texto) > maximo:
        raise DatosInvalidosError(f"El campo {campo} admite máximo {maximo} caracteres.")
    return texto or None


def _codigo():
    for _ in range(6):
        codigo = f"EQ-{secrets.token_hex(3).upper()}"
        if not existe_codigo(codigo):
            return codigo
    raise ConflictoError("No se pudo generar el código del equipo. Intenta de nuevo.")


def validar_fecha_compra(valor, hoy=None):
    """Fecha de compra para garantía: no futura y de máximo 1 año."""
    from app.horario import hoy_local

    hoy = hoy or hoy_local()
    if not valor:
        raise DatosInvalidosError("Indica la fecha de compra del televisor.")
    try:
        fecha = valor if isinstance(valor, date) else date.fromisoformat(str(valor))
    except ValueError:
        raise DatosInvalidosError("La fecha de compra no es válida.") from None
    if fecha > hoy:
        raise DatosInvalidosError("La fecha de compra no puede ser futura.")
    if fecha < hoy - timedelta(days=GARANTIA_DIAS):
        raise DatosInvalidosError(
            "Ese televisor ya no está en garantía (cubre 1 año desde la compra). "
            "Puedes reservar un diagnóstico."
        )
    return fecha


def datos_garantia(datos):
    """Valida lo que el ciudadano escribe al pedir una garantía (sin guardar)."""
    datos = datos or {}
    marca = _texto(datos.get("marca"), "marca", 40, obligatorio=True)
    return {
        "marca": marca,
        "modelo": _texto(datos.get("modelo"), "modelo", 60),
        "fecha_compra": validar_fecha_compra(datos.get("fecha_compra")),
        "falla": _texto(datos.get("falla"), "falla", 300, obligatorio=True),
    }


def registrar(cliente, punto_id, datos, registrado_por=None, origen="REPARACION", estado=None):
    """Crea la orden de servicio de un equipo (la confirma el llamador)."""
    punto = db.session.get(Punto, int(punto_id)) if punto_id else None
    if not punto or not punto.activo:
        raise DatosInvalidosError("Elige una sede activa para el equipo.")
    if origen not in ("REPARACION", "GARANTIA"):
        raise DatosInvalidosError("Origen no válido.")
    fecha_compra = None
    if origen == "GARANTIA":
        fecha_compra = validar_fecha_compra(datos.get("fecha_compra"))
    elif datos.get("fecha_compra"):
        try:
            fecha_compra = date.fromisoformat(str(datos["fecha_compra"]))
        except ValueError:
            raise DatosInvalidosError("La fecha de compra no es válida.") from None
    estado = estado or ("POR_RECIBIR" if registrado_por is None else "RECIBIDO")
    if estado not in ESTADOS_EQUIPO:
        raise DatosInvalidosError("Estado de equipo no válido.")
    equipo = Equipo(
        codigo=_codigo(),
        cliente_id=cliente.id,
        punto_id=punto.id,
        tipo=_texto(datos.get("tipo"), "tipo", 40) or "Televisor",
        marca=_texto(datos.get("marca"), "marca", 40, obligatorio=True),
        modelo=_texto(datos.get("modelo"), "modelo", 60),
        serial=_texto(datos.get("serial"), "serial", 60),
        falla=_texto(datos.get("falla"), "falla", 300),
        origen=origen,
        fecha_compra=fecha_compra,
        estado=estado,
        nota=_texto(datos.get("nota"), "nota", 300),
        registrado_por_id=registrado_por.id if registrado_por else None,
    )
    db.session.add(equipo)
    db.session.flush()
    return equipo


def registrar_por_asesor(asesor, datos):
    """El asesor recibe un equipo en su sede (formulario de la consola)."""
    from app.dominios.usuarios.servicios import registrar_cliente_publico

    if not asesor.punto_asignado_id:
        raise ConflictoError("Necesitas una sede asignada para registrar equipos.")
    from app.dominios.usuarios.servicios import verificar_o_asignar_documento

    cliente = registrar_cliente_publico(datos.get("cliente_nombre"), datos.get("cliente_celular"))
    try:
        verificar_o_asignar_documento(cliente, datos.get("cliente_documento"))
    except ValueError:
        db.session.rollback()
        raise
    origen = str(datos.get("origen") or "REPARACION").upper()
    equipo = registrar(cliente, asesor.punto_asignado_id, datos, asesor, origen, "RECIBIDO")
    db.session.commit()
    return equipo


def cambiar_estado(asesor, equipo_id, estado, nota=None, documento=None):
    """Avanza el equipo. Recibirlo en sede y entregarlo exigen la cédula del dueño."""
    from app.dominios.usuarios.servicios import verificar_o_asignar_documento

    equipo = obtener(equipo_id)
    if not equipo:
        raise NoEncontradoError("El equipo no existe.")
    if equipo.punto_id != asesor.punto_asignado_id:
        raise ConflictoError("El equipo pertenece a otra sede.")
    estado = str(estado or "").upper()
    if estado not in ESTADOS_EQUIPO:
        raise DatosInvalidosError("Estado de equipo no válido.")
    if equipo.estado == "ENTREGADO" and estado != "ENTREGADO":
        raise ConflictoError("El equipo ya fue entregado.")
    if ORDEN.index(estado) < ORDEN.index(equipo.estado) - 1:
        raise ConflictoError("Solo se puede retroceder un paso para corregir.")
    entrega = estado == "ENTREGADO" and equipo.estado != "ENTREGADO"
    recepcion = equipo.estado == "POR_RECIBIR" and estado == "RECIBIDO"
    if entrega or recepcion:
        try:
            verificar_o_asignar_documento(equipo.cliente, documento)
        except ValueError:
            db.session.rollback()
            raise
    equipo.estado = estado
    if nota is not None:
        equipo.nota = _texto(nota, "nota", 300)
    equipo.fecha_actualizacion = _ahora()
    equipo.fecha_entrega = _ahora() if estado == "ENTREGADO" else None
    db.session.commit()
    return equipo


def equipo_para_entrega(equipo_id, cliente):
    """Valida que el ciudadano pueda reservar la entrega de ese equipo."""
    from app.dominios.turnos.modelos import Turno
    from app.dominios.turnos.repositorios import ESTADOS_ACTIVOS

    try:
        equipo = obtener(int(equipo_id))
    except (TypeError, ValueError):
        equipo = None
    if not equipo or not cliente or equipo.cliente_id != cliente.id:
        raise DatosInvalidosError("Elige uno de tus equipos registrados.")
    if equipo.estado != "LISTO":
        raise DatosInvalidosError(
            f"Tu equipo está «{ESTADOS_EQUIPO[equipo.estado]}». "
            "Podrás reservar la entrega cuando esté listo."
        )
    ya = Turno.query.filter(Turno.equipo_id == equipo.id, Turno.estado.in_(ESTADOS_ACTIVOS)).first()
    if ya:
        raise DatosInvalidosError("Ya tienes un turno para recoger ese equipo.")
    return equipo


def equipos_del_celular(celular):
    from app.dominios.usuarios.repositorios import buscar_por_celular

    cliente = buscar_por_celular(celular)
    return cliente, (por_cliente(cliente.id) if cliente else [])
