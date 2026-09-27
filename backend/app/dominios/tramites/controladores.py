from flask import Blueprint
from .servicios import listar_tramites
from .dtos import tramite_response

tramites_bp = Blueprint("tramites", __name__)


@tramites_bp.get("/")
def obtener_tramites():
    tramites = listar_tramites()

    return {
        "tramites": [tramite_response(t) for t in tramites]
    }