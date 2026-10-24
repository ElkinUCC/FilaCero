from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt
from .servicios import (
    listar_tramites, crear_tramite, actualizar_tramite, eliminar_tramite
)
from .dtos import tramite_response

tramites_bp = Blueprint("tramites", __name__)


def es_admin():
    return get_jwt().get("rol") == "ADMIN"


@tramites_bp.get("/")
def obtener_tramites():
    tramites = [t for t in listar_tramites() if t.activo]
    return {"tramites": [tramite_response(t) for t in tramites]}, 200


@tramites_bp.post("/")
@jwt_required()
def crear():
    if not es_admin():
        return {"error": "Se requiere rol ADMIN."}, 403
    try:
        tramite = crear_tramite(request.get_json(silent=True) or {})
        return {"tramite": tramite_response(tramite)}, 201
    except ValueError as error:
        return {"error": str(error)}, 400


@tramites_bp.put("/<int:tramite_id>")
@jwt_required()
def actualizar(tramite_id):
    if not es_admin():
        return {"error": "Se requiere rol ADMIN."}, 403
    try:
        tramite = actualizar_tramite(
            tramite_id, request.get_json(silent=True) or {}
        )
        return {"tramite": tramite_response(tramite)}, 200
    except ValueError as error:
        return {"error": str(error)}, 400


@tramites_bp.delete("/<int:tramite_id>")
@jwt_required()
def eliminar(tramite_id):
    if not es_admin():
        return {"error": "Se requiere rol ADMIN."}, 403
    try:
        eliminar_tramite(tramite_id)
        return {"mensaje": "Trámite eliminado."}, 200
    except ValueError as error:
        return {"error": str(error)}, 400
