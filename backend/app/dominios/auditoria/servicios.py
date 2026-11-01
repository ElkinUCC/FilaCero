import logging

from flask import has_request_context, request

from app import db
from app.horario import a_iso_utc
from .modelos import Auditoria

log = logging.getLogger("filacero.auditoria")

ACCIONES = {
    "login": "Inicio de sesión",
    "login_fallido": "Intento de ingreso fallido",
    "login_bloqueado": "Ingreso con cuenta bloqueada",
    "logout": "Cerró sesión",
    "clave_cambiada": "Cambió su contraseña",
    "clave_restablecida": "Contraseña restablecida",
    "usuario_creado": "Usuario creado",
    "usuario_editado": "Usuario editado",
    "rol_cambiado": "Cambio de rol",
    "usuario_desactivado": "Acceso desactivado",
    "usuario_activado": "Acceso activado",
    "sede_creada": "Sede creada",
    "sede_editada": "Sede editada",
    "sede_eliminada": "Sede eliminada",
    "tramite_creado": "Trámite creado",
    "tramite_editado": "Trámite editado",
    "tramite_eliminado": "Trámite eliminado",
}


def _actor_actual():
    try:
        from flask_jwt_extended import current_user, verify_jwt_in_request
        verify_jwt_in_request(optional=True)
        return current_user.id if current_user else None
    except Exception:
        return None


def registrar(accion, detalle=None, usuario_id=None):
    """Guarda un evento. Nunca interrumpe la operación principal si falla."""
    try:
        evento = Auditoria(
            accion=accion,
            detalle=(detalle or "")[:255] or None,
            usuario_id=usuario_id if usuario_id is not None else _actor_actual(),
            ip=(request.remote_addr if has_request_context() else None),
        )
        db.session.add(evento)
        db.session.commit()
    except Exception:  # pragma: no cover
        db.session.rollback()
        log.exception("No se pudo registrar la auditoría %s", accion)


def evento_response(evento):
    return {
        "id": evento.id,
        "fecha": a_iso_utc(evento.fecha),
        "accion": evento.accion,
        "accion_texto": ACCIONES.get(evento.accion, evento.accion),
        "detalle": evento.detalle,
        "usuario": evento.usuario.nombre if evento.usuario else None,
        "usuario_correo": evento.usuario.correo if evento.usuario else None,
        "ip": evento.ip,
    }
