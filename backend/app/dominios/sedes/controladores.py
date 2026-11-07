from flask import Blueprint, request
from flask_jwt_extended import get_jwt, verify_jwt_in_request

from app.dominios.auditoria.servicios import registrar
from app.seguridad import requiere_rol

from .dtos import punto_response
from .servicios import actualizar_punto, crear_punto, eliminar_punto, listar_puntos

puntos_bp = Blueprint("puntos", __name__)


def _es_admin_opcional():
    try:
        verify_jwt_in_request(optional=True)
        return get_jwt().get("rol") in ("ADMIN", "SUPERVISOR")
    except Exception:
        return False


@puntos_bp.get("/")
def obtener_puntos():
    # ?todos=1 solo para administradores: incluye sedes inactivas.
    todos = request.args.get("todos") == "1" and _es_admin_opcional()
    puntos = [p for p in listar_puntos() if todos or p.activo]
    return {"puntos": [punto_response(p, operativo=todos) for p in puntos]}, 200


@puntos_bp.post("/")
@requiere_rol("ADMIN")
def crear():
    punto = crear_punto(request.get_json(silent=True) or {})
    registrar("sede_creada", punto.nombre)
    return {"punto": punto_response(punto), "mensaje": "Sede creada."}, 201


@puntos_bp.put("/<int:punto_id>")
@requiere_rol("ADMIN")
def actualizar(punto_id):
    punto = actualizar_punto(punto_id, request.get_json(silent=True) or {})
    registrar("sede_editada", punto.nombre + (" (activa)" if punto.activo else " (inactiva)"))
    return {"punto": punto_response(punto), "mensaje": "Sede actualizada."}, 200


@puntos_bp.delete("/<int:punto_id>")
@requiere_rol("ADMIN")
def eliminar(punto_id):
    eliminar_punto(punto_id)
    registrar("sede_eliminada", f"id {punto_id}")
    return {"mensaje": "Sede eliminada."}, 200
