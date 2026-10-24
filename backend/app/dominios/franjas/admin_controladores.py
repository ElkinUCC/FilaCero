from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt
from .admin_servicios import crear_franja, cambiar_estado_franja
from .dtos import franja_response

admin_franjas_bp = Blueprint("admin_franjas", __name__)


def autorizado():
    return get_jwt().get("rol") == "ADMIN"


@admin_franjas_bp.post("/")
@jwt_required()
def crear():
    if not autorizado():
        return {"error": "Se requiere rol ADMIN."}, 403
    try:
        franja = crear_franja(request.get_json(silent=True) or {})
        return {"franja": franja_response(franja)}, 201
    except ValueError as error:
        return {"error": str(error)}, 400


@admin_franjas_bp.patch("/<int:franja_id>")
@jwt_required()
def cambiar_estado(franja_id):
    if not autorizado():
        return {"error": "Se requiere rol ADMIN."}, 403

    datos = request.get_json(silent=True) or {}
    if not isinstance(datos.get("activa"), bool):
        return {"error": "El campo activa debe ser true o false."}, 400

    try:
        franja = cambiar_estado_franja(franja_id, datos["activa"])
        return {"franja": franja_response(franja)}, 200
    except ValueError as error:
        return {"error": str(error)}, 400
