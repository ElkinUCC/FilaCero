from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from .servicios import crear_turno, mis_turnos
from .dtos import turno_response

turnos_bp = Blueprint("turnos", __name__)


@turnos_bp.post("/")
@jwt_required()
def solicitar_turno():

    usuario_id = int(get_jwt_identity())
    datos = request.get_json()

    try:
        turno = crear_turno(
            usuario_id,
            datos["tramite_id"],
            datos["punto_id"]
        )

        return turno_response(turno), 201

    except Exception as e:
        return {"error": str(e)}, 400


@turnos_bp.get("/mis-turnos")
@jwt_required()
def obtener_mis_turnos():

    usuario_id = int(get_jwt_identity())

    turnos = mis_turnos(usuario_id)

    return {
        "turnos": [
            turno_response(t)
            for t in turnos
        ]
    }