from datetime import datetime
from zoneinfo import ZoneInfo
import secrets

from app import db
from app.dominios.usuarios.modelos import Usuario
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.franjas.repositorios import obtener_para_reserva
from .modelos import Turno
from .repositorios import guardar, obtener_por_usuario, obtener_por_id


ZONA = ZoneInfo("America/Bogota")


def crear_turno(usuario_id, tramite_id, punto_id, franja_id):
    try:
        usuario = db.session.get(Usuario, usuario_id)
        tramite = db.session.get(Tramite, tramite_id)
        punto = db.session.get(Punto, punto_id)

        if not usuario or not usuario.activo:
            raise ValueError("El usuario no existe o está inactivo.")
        if not tramite or not tramite.activo:
            raise ValueError("El trámite no existe o está inactivo.")
        if not punto or not punto.activo:
            raise ValueError("La sede no existe o está inactiva.")

        franja = obtener_para_reserva(franja_id)
        if not franja or not franja.activa:
            raise ValueError("La franja no existe o está inactiva.")
        if franja.punto_id != punto_id or franja.tramite_id != tramite_id:
            raise ValueError("La franja no corresponde a la sede y trámite.")

        ahora = datetime.now(ZONA)
        inicio = datetime.combine(franja.fecha, franja.hora_inicio, tzinfo=ZONA)
        if inicio <= ahora:
            raise ValueError("No se pueden reservar franjas que ya comenzaron.")

        reservados = Turno.query.filter(
            Turno.franja_id == franja.id,
            Turno.estado != "CANCELADO"
        ).count()

        if reservados >= franja.capacidad:
            raise ValueError("La franja ya no tiene cupos disponibles.")

        duplicado = Turno.query.filter(
            Turno.usuario_id == usuario_id,
            Turno.franja_id == franja.id,
            Turno.estado != "CANCELADO"
        ).first()
        if duplicado:
            raise ValueError("Ya tienes una reserva activa en esta franja.")

        turno = Turno(
            codigo=f"FC-{ahora:%Y%m%d}-{secrets.token_hex(3).upper()}",
            usuario_id=usuario_id,
            tramite_id=tramite_id,
            punto_id=punto_id,
            franja_id=franja.id,
            estado="ESPERANDO"
        )
        return guardar(turno)

    except Exception:
        db.session.rollback()
        raise


def mis_turnos(usuario_id):
    return obtener_por_usuario(usuario_id)


def cancelar_turno(turno_id, usuario_id):
    try:
        turno = obtener_por_id(turno_id)

        if not turno:
            raise ValueError("El turno no existe.")
        if turno.usuario_id != usuario_id:
            raise ValueError("No puedes cancelar un turno de otro usuario.")
        if turno.estado != "ESPERANDO":
            raise ValueError("Solo se pueden cancelar turnos en espera.")

        turno.estado = "CANCELADO"
        db.session.commit()
        return turno

    except Exception:
        db.session.rollback()
        raise
