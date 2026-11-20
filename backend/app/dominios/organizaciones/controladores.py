"""Consulta y configuración controlada de la organización activa."""

from flask import Blueprint, g, request
from flask_jwt_extended import current_user, jwt_required

from app.seguridad import requiere_rol

from .dtos import organizacion_response
from .servicios import actualizar_configuracion

organizaciones_bp = Blueprint("organizaciones", __name__)


@organizaciones_bp.get("/actual")
@jwt_required()
def obtener_actual():
    if not current_user or current_user.organizacion_id != g.organizacion_id:
        return {"success": False, "error": "No se pudo validar la organización de la sesión."}, 401
    return {"organizacion": organizacion_response(g.organizacion)}, 200


@organizaciones_bp.patch("/actual")
@requiere_rol("ADMIN")
def actualizar_actual():
    """Los errores de validación los traduce a 400 el manejador global (app/errores.py)."""
    organizacion = actualizar_configuracion(g.organizacion, request.get_json(silent=True) or {})
    return {
        "mensaje": "Configuración de organización actualizada.",
        "organizacion": organizacion_response(organizacion),
    }, 200
