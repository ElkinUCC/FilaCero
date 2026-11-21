"""API de la bitácora de auditoría (/api/v1/admin/usuarios/auditoria)."""

from flask import Blueprint, jsonify, request

from app.seguridad import requiere_rol

from .servicios import consultar_bitacora

auditoria_bp = Blueprint("auditoria", __name__)


@auditoria_bp.get("/auditoria")
@requiere_rol("ADMIN")
def bitacora():
    try:
        return jsonify(consultar_bitacora(request.args)), 200
    except ValueError as error:
        return jsonify({"success": False, "error": str(error)}), getattr(error, "codigo_http", 400)
