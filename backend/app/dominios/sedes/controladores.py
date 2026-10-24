from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt
from .servicios import (
    listar_puntos, crear_punto, actualizar_punto, eliminar_punto
)
from .dtos import punto_response

puntos_bp = Blueprint("puntos", __name__)


def es_admin():
    return get_jwt().get("rol") == "ADMIN"


@puntos_bp.get("/")
def obtener_puntos():
    puntos = [p for p in listar_puntos() if p.activo]
    return {"puntos": [punto_response(p) for p in puntos]}, 200


@puntos_bp.post("/")
@jwt_required()
def crear():
    if not es_admin():
        return {"error": "Se requiere rol ADMIN."}, 403
    try:
        punto = crear_punto(request.get_json(silent=True) or {})
        return {"punto": punto_response(punto)}, 201
    except ValueError as error:
        return {"error": str(error)}, 400


@puntos_bp.put("/<int:punto_id>")
@jwt_required()
def actualizar(punto_id):
    if not es_admin():
        return {"error": "Se requiere rol ADMIN."}, 403
    try:
        punto = actualizar_punto(
            punto_id, request.get_json(silent=True) or {}
        )
        return {"punto": punto_response(punto)}, 200
    except ValueError as error:
        return {"error": str(error)}, 400


@puntos_bp.delete("/<int:punto_id>")
@jwt_required()
def eliminar(punto_id):
    if not es_admin():
        return {"error": "Se requiere rol ADMIN."}, 403
    try:
        eliminar_punto(punto_id)
        return {"mensaje": "Sede eliminada."}, 200
    except ValueError as error:
        return {"error": str(error)}, 400
