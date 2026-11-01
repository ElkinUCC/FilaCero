from flask import Blueprint, request

from app.seguridad import requiere_rol
from .admin_servicios import cambiar_estado_franja, crear_franja
from .dtos import franja_response

admin_franjas_bp = Blueprint("admin_franjas", __name__)


@admin_franjas_bp.post("/")
@requiere_rol("ADMIN")
def crear():
    try:
        franja = crear_franja(request.get_json(silent=True) or {})
        return {"franja": franja_response(franja)}, 201
    except ValueError as error:
        return {"error": str(error)}, 400


@admin_franjas_bp.patch("/<int:franja_id>")
@requiere_rol("ADMIN")
def cambiar_estado(franja_id):
    datos = request.get_json(silent=True) or {}
    if not isinstance(datos.get("activa"), bool):
        return {"error": "El campo activa debe ser true o false."}, 400
    try:
        franja = cambiar_estado_franja(franja_id, datos["activa"])
        return {"franja": franja_response(franja)}, 200
    except ValueError as error:
        return {"error": str(error)}, 400
