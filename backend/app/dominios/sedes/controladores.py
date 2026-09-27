from flask import Blueprint
from .servicios import listar_puntos
from .dtos import punto_response

puntos_bp = Blueprint("puntos", __name__)


@puntos_bp.get("/")
def obtener_puntos():
    puntos = listar_puntos()

    return {
        "puntos": [punto_response(p) for p in puntos]
    }