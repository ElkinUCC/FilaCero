"""Servicios del dominio Reclamos.

El ciudadano radica su reclamo en línea (con el celular verificado) y elige
si lo sigue por este medio o en persona; en el segundo caso, además reserva un
turno del trámite de reclamos. Los asesores de la sede lo gestionan y la
respuesta queda visible para el ciudadano al consultar con su celular.
"""

import secrets
from datetime import UTC, datetime

from app import db
from app.dominios.sedes.modelos import Punto
from app.errores import ConflictoError, DatosInvalidosError, NoEncontradoError

from .dtos import CATEGORIAS, ESTADOS_RECLAMO
from .modelos import MensajeReclamo, Reclamo
from .repositorios import existe_radicado, obtener

DESCRIPCION_MIN = 15
DESCRIPCION_MAX = 1500


def _radicado():
    for _ in range(6):
        radicado = f"RC-{secrets.token_hex(3).upper()}"
        if not existe_radicado(radicado):
            return radicado
    raise ConflictoError("No se pudo generar el radicado. Intenta de nuevo.")


def radicar(cliente, datos):
    datos = datos or {}
    categoria = str(datos.get("categoria") or "").upper()
    if categoria not in CATEGORIAS:
        raise DatosInvalidosError("Elige el motivo del reclamo.")
    descripcion = " ".join(str(datos.get("descripcion") or "").split())
    if len(descripcion) < DESCRIPCION_MIN:
        raise DatosInvalidosError("Cuéntanos un poco más (mínimo 15 caracteres).")
    if len(descripcion) > DESCRIPCION_MAX:
        raise DatosInvalidosError(f"El reclamo admite máximo {DESCRIPCION_MAX} caracteres.")
    try:
        punto = db.session.get(Punto, int(datos.get("punto_id")))
    except (TypeError, ValueError):
        punto = None
    if not punto or not punto.activo:
        raise DatosInvalidosError("Elige la sede relacionada con tu reclamo.")
    equipo_id = datos.get("equipo_id") or None
    if equipo_id:
        from app.dominios.equipos.repositorios import obtener as obtener_equipo

        equipo = obtener_equipo(int(equipo_id))
        if not equipo or equipo.cliente_id != cliente.id:
            raise DatosInvalidosError("El equipo no corresponde a tu celular.")
    reclamo = Reclamo(
        radicado=_radicado(),
        cliente_id=cliente.id,
        punto_id=punto.id,
        equipo_id=int(equipo_id) if equipo_id else None,
        categoria=categoria,
        descripcion=descripcion,
        presencial=bool(datos.get("presencial")),
    )
    db.session.add(reclamo)
    db.session.commit()
    return reclamo


def gestionar(asesor, reclamo_id, estado, respuesta=None):
    reclamo = obtener(reclamo_id)
    if not reclamo:
        raise NoEncontradoError("El reclamo no existe.")
    if reclamo.punto_id != asesor.punto_asignado_id:
        raise ConflictoError("El reclamo pertenece a otra sede.")
    estado = str(estado or "").upper()
    if estado not in ESTADOS_RECLAMO:
        raise DatosInvalidosError("Estado de reclamo no válido.")
    respuesta = " ".join(str(respuesta or "").split()) or None
    if estado == "RESUELTO" and not respuesta:
        raise DatosInvalidosError("Escribe la respuesta para el ciudadano antes de resolver.")
    if respuesta and len(respuesta) > DESCRIPCION_MAX:
        raise DatosInvalidosError(f"La respuesta admite máximo {DESCRIPCION_MAX} caracteres.")
    reclamo.estado = estado
    if respuesta is not None and respuesta != reclamo.respuesta:
        reclamo.respuesta = respuesta
        reclamo.fecha_respuesta = datetime.now(UTC).replace(tzinfo=None)
        # La respuesta también queda en el chat (si no es lo último que ya se escribió).
        ultimo = next((m for m in reversed(reclamo.mensajes) if m.autor == "ASESOR"), None)
        if not ultimo or ultimo.texto != respuesta:
            db.session.add(
                MensajeReclamo(
                    reclamo_id=reclamo.id,
                    autor="ASESOR",
                    autor_nombre=asesor.nombre,
                    texto=respuesta,
                    leido_asesor=True,
                )
            )
    reclamo.gestionado_por_id = asesor.id
    db.session.commit()
    return reclamo


# ---------------------------------------------------------------------
# Minichat
# ---------------------------------------------------------------------

MENSAJE_MAX = 600


def _texto_mensaje(texto):
    texto = " ".join(str(texto or "").split())
    if len(texto) < 2:
        raise DatosInvalidosError("Escribe tu mensaje.")
    if len(texto) > MENSAJE_MAX:
        raise DatosInvalidosError(f"El mensaje admite máximo {MENSAJE_MAX} caracteres.")
    return texto


def escribir_cliente(cliente, radicado, texto):
    """El ciudadano escribe; el asistente contesta al instante y el asesor ve la alerta."""
    from .asistente import NOMBRE, responder
    from .repositorios import por_radicado

    texto = _texto_mensaje(texto)
    reclamo = por_radicado(radicado)
    if not reclamo or reclamo.cliente_id != cliente.id:
        raise NoEncontradoError("No encontramos ese radicado para tu celular.")
    db.session.add(
        MensajeReclamo(
            reclamo_id=reclamo.id,
            autor="CLIENTE",
            autor_nombre=cliente.nombre,
            texto=texto,
            leido_cliente=True,
        )
    )
    db.session.add(
        MensajeReclamo(
            reclamo_id=reclamo.id,
            autor="ASISTENTE",
            autor_nombre=NOMBRE,
            texto=responder(reclamo, texto),
            leido_asesor=True,
        )
    )
    if reclamo.estado == "RESUELTO":
        reclamo.estado = "EN_GESTION"
    db.session.commit()
    db.session.refresh(reclamo)
    return reclamo


def escribir_asesor(asesor, reclamo_id, texto):
    reclamo = obtener(reclamo_id)
    if not reclamo:
        raise NoEncontradoError("El reclamo no existe.")
    if reclamo.punto_id != asesor.punto_asignado_id:
        raise ConflictoError("El reclamo pertenece a otra sede.")
    db.session.add(
        MensajeReclamo(
            reclamo_id=reclamo.id,
            autor="ASESOR",
            autor_nombre=asesor.nombre,
            texto=_texto_mensaje(texto),
            leido_asesor=True,
        )
    )
    for m in reclamo.mensajes:
        if m.autor == "CLIENTE":
            m.leido_asesor = True
    if reclamo.estado == "RADICADO":
        reclamo.estado = "EN_GESTION"
        reclamo.gestionado_por_id = asesor.id
    db.session.commit()
    db.session.refresh(reclamo)
    return reclamo


def marcar_leidos(reclamos, lado):
    """lado: "cliente" (lee asesor/asistente) o "asesor" (lee al ciudadano)."""
    cambios = False
    for r in reclamos:
        for m in r.mensajes:
            if lado == "cliente" and m.autor != "CLIENTE" and not m.leido_cliente:
                m.leido_cliente = cambios = True
            if lado == "asesor" and m.autor == "CLIENTE" and not m.leido_asesor:
                m.leido_asesor = cambios = True
    if cambios:
        db.session.commit()
