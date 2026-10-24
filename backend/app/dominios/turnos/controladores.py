from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from .servicios import crear_turno, mis_turnos, cancelar_turno
from .dtos import turno_response

turnos_bp = Blueprint("turnos", __name__)


@turnos_bp.post("/")
@jwt_required()
def solicitar_turno():
    datos = request.get_json(silent=True) or {}
    try:
        turno = crear_turno(
            int(get_jwt_identity()),
            int(datos["tramite_id"]),
            int(datos["punto_id"]),
            int(datos["franja_id"])
        )
        return turno_response(turno), 201
    except (KeyError, TypeError, ValueError) as error:
        return {"error": str(error)}, 400


@turnos_bp.get("/mis-turnos")
@jwt_required()
def obtener_mis_turnos():
    turnos = mis_turnos(int(get_jwt_identity()))
    return {"turnos": [turno_response(t) for t in turnos]}, 200


@turnos_bp.post("/<int:turno_id>/cancelar")
@jwt_required()
def cancelar_mi_turno(turno_id):
    try:
        turno = cancelar_turno(turno_id, int(get_jwt_identity()))
        return {"mensaje": "Turno cancelado.", "turno": turno_response(turno)}, 200
    except ValueError as error:
        return {"error": str(error)}, 400
