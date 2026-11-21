from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from app.dominios.auditoria.servicios import registrar
from app.seguridad import limitar, requiere_rol

from . import servicios
from .dtos import LoginSchema, RegistroUsuarioSchema, usuario_response
from .servicios import (
    ROLES,
    cambiar_clave_propia,
    dar_de_baja,
    emitir_token,
    iniciar_sesion,
    registrar_usuario,
    revocar_todas_las_sesiones,
)

usuarios_bp = Blueprint("usuarios", __name__)

registro_schema = RegistroUsuarioSchema()
login_schema = LoginSchema()


@usuarios_bp.post("/registro")
@limitar("LIMITE_OTP_POR_MINUTO")
def registro():
    from flask import current_app

    datos = registro_schema.load(request.get_json(silent=True) or {})
    if not current_app.config.get("REGISTRO_PUBLICO", False):
        return {"error": "El registro público de cuentas está deshabilitado."}, 403
    # Los errores de negocio
    usuario = registrar_usuario(datos["nombre"], datos["correo"], datos["password"])
    return {
        "mensaje": "Usuario registrado correctamente",
        "usuario": usuario_response(usuario),
    }, 201


@usuarios_bp.post("/login")
@limitar("LIMITE_LOGIN_POR_MINUTO")
def login():
    datos = login_schema.load(request.get_json(silent=True) or {})
    # CredencialesInvalidasError -> 401 y CuentaBloqueadaError -> 429 (app/errores.py).
    usuario, token = iniciar_sesion(datos["correo"], datos["password"])
    return {
        "mensaje": "Inicio de sesión exitoso",
        "usuario": usuario_response(usuario),
        "access_token": token,
    }


@usuarios_bp.get("/me")
@jwt_required()
def mi_cuenta():
    if not current_user or not current_user.activo:
        return {"error": "Sesión inválida. Inicia sesión de nuevo."}, 401
    return {"usuario": usuario_response(current_user)}, 200


@usuarios_bp.post("/me/clave")
@jwt_required()
@limitar("LIMITE_LOGIN_POR_MINUTO")
def cambiar_mi_clave():
    from app.dominios.auditoria.servicios import registrar

    if not current_user or not current_user.activo:
        return {"error": "Sesión inválida. Inicia sesión de nuevo."}, 401
    datos = request.get_json(silent=True) or {}
    cambiar_clave_propia(current_user, datos.get("actual"), datos.get("nueva"))
    registrar("clave_cambiada", usuario_id=current_user.id)
    # Las sesiones anteriores quedaron revocadas: se entrega un token nuevo.
    return {
        "mensaje": "Contraseña actualizada.",
        "usuario": usuario_response(current_user),
        "access_token": emitir_token(current_user),
    }, 200


@usuarios_bp.post("/logout")
@jwt_required()
def cerrar_sesion():
    """Revoca TODOS los tokens del usuario (cierra sesión en todos sus equipos)."""
    from app.dominios.auditoria.servicios import registrar

    if current_user:
        revocar_todas_las_sesiones(current_user)
        registrar("logout", usuario_id=current_user.id)
    return {"mensaje": "Sesión cerrada."}, 200


# Administración de cuentas del personal (/api/v1/admin/usuarios)


admin_usuarios_bp = Blueprint("admin_usuarios", __name__)


def _error(error):
    return jsonify({"success": False, "error": str(error)}), getattr(error, "codigo_http", 400)


@admin_usuarios_bp.get("/")
@requiere_rol("ADMIN")
def listar():
    usuarios = servicios.listar_personal()
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
        usuario, clave_temporal = servicios.crear_personal(request.get_json(silent=True) or {})
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
        usuario, cambios, eventos = servicios.editar_personal(
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
        usuario, clave = servicios.restablecer_clave(usuario_id, current_user.id)
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
