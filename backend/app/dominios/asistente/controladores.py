"""API del asistente FilaCero IA (/api/v1/asistente)."""

from flask import Blueprint, jsonify, request

from app.seguridad import limitar, requiere_rol, usuario_autenticado

from . import servicios
from .dtos import leer_pregunta

asistente_bp = Blueprint("asistente", __name__)


@asistente_bp.get("/sugerencias")
@requiere_rol("ADMIN", "SUPERVISOR", "AGENTE")
def sugerencias():
    return jsonify(servicios.sugerencias(usuario_autenticado())), 200


@asistente_bp.post("/preguntar")
@requiere_rol("ADMIN", "SUPERVISOR", "AGENTE")
@limitar("LIMITE_ASISTENTE_POR_MINUTO")
def preguntar():
    cuerpo = request.get_json(silent=True) or {}
    try:
        pregunta, historial = leer_pregunta(cuerpo)
        resultado = servicios.preguntar(usuario_autenticado(), pregunta, historial, cuerpo)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    return jsonify(resultado), 200
