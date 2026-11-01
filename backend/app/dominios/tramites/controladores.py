from flask import Blueprint, request
from flask_jwt_extended import get_jwt, verify_jwt_in_request

from app.dominios.auditoria.servicios import registrar
from app.seguridad import requiere_rol
from .dtos import tramite_response
from .servicios import actualizar_tramite, crear_tramite, eliminar_tramite, listar_tramites

tramites_bp = Blueprint("tramites", __name__)


def _es_admin_opcional():
    try:
        verify_jwt_in_request(optional=True)
        return get_jwt().get("rol") in ("ADMIN", "SUPERVISOR")
    except Exception:
        return False


@tramites_bp.get("/")
def obtener_tramites():
    todos = request.args.get("todos") == "1" and _es_admin_opcional()
    tramites = [t for t in listar_tramites() if todos or t.activo]
    return {"tramites": [tramite_response(t) for t in tramites]}, 200


@tramites_bp.post("/")
@requiere_rol("ADMIN")
def crear():
    try:
        tramite = crear_tramite(request.get_json(silent=True) or {})
        registrar("tramite_creado", tramite.nombre)
        return {"tramite": tramite_response(tramite), "mensaje": "Trámite creado."}, 201
    except ValueError as error:
        return {"error": str(error)}, 400


@tramites_bp.put("/<int:tramite_id>")
@requiere_rol("ADMIN")
def actualizar(tramite_id):
    try:
        tramite = actualizar_tramite(tramite_id, request.get_json(silent=True) or {})
        registrar("tramite_editado", tramite.nombre + (" (activo)" if tramite.activo else " (inactivo)"))
        return {"tramite": tramite_response(tramite), "mensaje": "Trámite actualizado."}, 200
    except ValueError as error:
        return {"error": str(error)}, 400


@tramites_bp.delete("/<int:tramite_id>")
@requiere_rol("ADMIN")
def eliminar(tramite_id):
    try:
        eliminar_tramite(tramite_id)
        registrar("tramite_eliminado", f"id {tramite_id}")
        return {"mensaje": "Trámite eliminado."}, 200
    except ValueError as error:
        return {"error": str(error)}, 400
