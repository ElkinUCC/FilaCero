from flask import Blueprint, request
from flask_jwt_extended import current_user, jwt_required

from app.seguridad import limitar

from .dtos import LoginSchema, RegistroUsuarioSchema, usuario_response
from .servicios import (
    cambiar_clave_propia,
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
    # Los errores de negocio (correo repetido, clave débil) los responde el
    # manejador global de app/errores.py con su código HTTP.
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
