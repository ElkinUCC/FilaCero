from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity

from app import db
from app.dominios.usuarios.modelos import Usuario
from app.dominios.sedes.modelos import Punto
from app.dominios.turnos.dtos import turno_response

from .servicios import (
    consultar_cola,
    llamar_siguiente,
    iniciar_atencion,
    finalizar_atencion,
)

agentes_bp = Blueprint("agentes", __name__)
admin_agentes_bp = Blueprint("admin_agentes", __name__)


@agentes_bp.before_request
@jwt_required()
def proteger_agentes():
    if get_jwt().get("rol") != "AGENTE":
        from flask import jsonify
        return jsonify({"error": "Se requiere rol AGENTE."}), 403


@agentes_bp.get("/cola")
def cola():
    try:
        turnos = consultar_cola(int(get_jwt_identity()))
        return {
            "total_en_espera": len(turnos),
            "turnos": [turno_response(t) for t in turnos]
        }, 200
    except ValueError as error:
        return {"error": str(error)}, 400


@agentes_bp.post("/llamar-siguiente")
def llamar():
    try:
        turno = llamar_siguiente(int(get_jwt_identity()))
        return {
            "mensaje": "Turno llamado correctamente.",
            "turno": turno_response(turno)
        }, 200
    except ValueError as error:
        return {"error": str(error)}, 400


@agentes_bp.post("/turnos/<int:turno_id>/iniciar")
def iniciar(turno_id):
    try:
        turno = iniciar_atencion(
            int(get_jwt_identity()), turno_id
        )
        return {
            "mensaje": "Atención iniciada.",
            "turno": turno_response(turno)
        }, 200
    except ValueError as error:
        return {"error": str(error)}, 400


@agentes_bp.post("/turnos/<int:turno_id>/finalizar")
def finalizar(turno_id):
    try:
        turno = finalizar_atencion(
            int(get_jwt_identity()), turno_id
        )
        return {
            "mensaje": "Atención finalizada.",
            "turno": turno_response(turno)
        }, 200
    except ValueError as error:
        return {"error": str(error)}, 400


@admin_agentes_bp.post("/<int:usuario_id>/sede")
@jwt_required()
def asignar_sede(usuario_id):
    if get_jwt().get("rol") != "ADMIN":
        return {"error": "Se requiere rol ADMIN."}, 403

    datos = request.get_json(silent=True) or {}
    punto_id = datos.get("punto_id")

    if not isinstance(punto_id, int) or isinstance(punto_id, bool):
        return {"error": "punto_id debe ser un entero."}, 400

    agente = Usuario.query.filter_by(
        id=usuario_id, rol="AGENTE", activo=True
    ).first()
    punto = db.session.get(Punto, punto_id)

    if not agente:
        return {"error": "No existe un agente activo con ese ID."}, 404

    if not punto or not punto.activo:
        return {"error": "La sede no existe o está inactiva."}, 404

    agente.punto_asignado_id = punto.id
    db.session.commit()

    return {
        "mensaje": "Sede asignada correctamente.",
        "agente_id": agente.id,
        "punto_id": punto.id
    }, 200