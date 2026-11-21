"""Administración de cuentas del personal: credenciales, roles y bitácora."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from app.dominios.auditoria.servicios import consultar_bitacora, registrar
from app.seguridad import requiere_rol

from . import admin_servicios
from .admin_servicios import ROLES
from .dtos import usuario_response
from .servicios import dar_de_baja

admin_usuarios_bp = Blueprint("admin_usuarios", __name__)


def _error(error):
    return jsonify({"success": False, "error": str(error)}), getattr(error, "codigo_http", 400)


@admin_usuarios_bp.get("/")
@requiere_rol("ADMIN")
def listar():
    usuarios = admin_servicios.listar_personal()
    return (
        jsonify(
            {
                "usuarios": [usuario_response(u) for u in usuarios],
                "roles": ROLES,
                "yo": current_user.id,
            }
        ),
        200,
    )


@admin_usuarios_bp.post("/")
@requiere_rol("ADMIN")
def crear():
    try:
        usuario, clave_temporal = admin_servicios.crear_personal(
            request.get_json(silent=True) or {}
        )
    except ValueError as error:
        return _error(error)

    registrar("usuario_creado", f"{usuario.correo} como {ROLES[usuario.rol]}")
    respuesta = {"mensaje": "Usuario creado.", "usuario": usuario_response(usuario)}
    if clave_temporal:
        respuesta["clave_temporal"] = clave_temporal  # se muestra UNA sola vez
    return jsonify(respuesta), 201


@admin_usuarios_bp.put("/<int:usuario_id>")
@requiere_rol("ADMIN")
def editar(usuario_id):
    try:
        usuario, cambios, eventos = admin_servicios.editar_personal(
            usuario_id, request.get_json(silent=True) or {}, current_user.id
        )
    except ValueError as error:
        return _error(error)

    for accion, detalle in eventos:
        registrar(accion, detalle)
    registrar(
        "usuario_editado", f"{usuario.correo}" + (f" ({'; '.join(cambios)})" if cambios else "")
    )
    return jsonify({"mensaje": "Usuario actualizado.", "usuario": usuario_response(usuario)}), 200


@admin_usuarios_bp.delete("/<int:usuario_id>")
@requiere_rol("ADMIN")
def eliminar(usuario_id):
    """Baja definitiva (lógica): conserva turnos atendidos y bitácora."""
    usuario, correo = dar_de_baja(usuario_id, current_user.id)
    registrar("usuario_eliminado", f"{correo} ({usuario.nombre})")
    return jsonify({"mensaje": f"{usuario.nombre} fue eliminado. Su historial se conserva."}), 200


@admin_usuarios_bp.post("/<int:usuario_id>/restablecer-clave")
@requiere_rol("ADMIN")
def restablecer_clave(usuario_id):
    try:
        usuario, clave = admin_servicios.restablecer_clave(usuario_id, current_user.id)
    except ValueError as error:
        return _error(error)
    registrar("clave_restablecida", usuario.correo)
    return (
        jsonify(
            {
                "mensaje": "Contraseña restablecida. Deberá cambiarla al ingresar.",
                "clave_temporal": clave,
                "usuario": usuario_response(usuario),
            }
        ),
        200,
    )


@admin_usuarios_bp.get("/auditoria")
@requiere_rol("ADMIN")
def auditoria():
    try:
        return jsonify(consultar_bitacora(request.args)), 200
    except ValueError as error:
        return _error(error)
