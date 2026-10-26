import os
from datetime import timedelta

from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.dominios.usuarios.servicios import registrar_cliente_publico
from .servicios import crear_turno, mis_turnos, cancelar_turno
from .dtos import turno_response

turnos_bp = Blueprint("turnos", __name__)

# Modo de prueba local. En producción debe estar desactivado y conectarse
# un proveedor real de SMS; el código 1234 nunca debe usarse en producción.
_codigos_prueba = {}


def _serializador_verificacion():
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"],
        salt="filacero-verificacion-celular",
    )


@turnos_bp.post("/publico/solicitar-codigo")
def solicitar_codigo_celular():
    datos = request.get_json(silent=True) or {}
    celular = str(datos.get("celular", "")).strip()

    if not celular:
        return {"error": "Ingresa tu número de celular."}, 400

    if os.getenv("FILACERO_OTP_TEST_MODE", "").lower() not in ("1", "true", "si", "sí"):
        return {
            "error": "La verificación por SMS aún no está configurada. "
                     "Activa el modo de prueba solo en desarrollo."
        }, 503

    _codigos_prueba[celular] = "1234"
    return {
        "mensaje": "Código de prueba generado. En desarrollo utiliza 1234.",
        "modo_prueba": True,
        "codigo_prueba": "1234",
    }, 200


@turnos_bp.post("/publico/verificar-codigo")
def verificar_codigo_celular():
    datos = request.get_json(silent=True) or {}
    celular = str(datos.get("celular", "")).strip()
    codigo = str(datos.get("codigo", "")).strip()

    if not celular or not codigo:
        return {"error": "Ingresa el celular y el código de verificación."}, 400

    if os.getenv("FILACERO_OTP_TEST_MODE", "").lower() not in ("1", "true", "si", "sí"):
        return {"error": "La verificación por SMS no está configurada."}, 503

    if _codigos_prueba.get(celular) != codigo or codigo != "1234":
        return {"error": "El código de verificación no es válido."}, 400

    token = _serializador_verificacion().dumps({"celular": celular})
    _codigos_prueba.pop(celular, None)
    return {
        "mensaje": "Celular verificado correctamente.",
        "token_verificacion": token,
    }, 200


@turnos_bp.post("/publico")
def solicitar_turno_publico():
    datos = request.get_json(silent=True) or {}

    nombre = str(datos.get("nombre", "")).strip()
    celular = str(datos.get("celular", "")).strip()
    token_verificacion = str(datos.get("token_verificacion", "")).strip()

    try:
        punto_id = int(datos["punto_id"])
        tramite_id = int(datos["tramite_id"])
        franja_id = int(datos["franja_id"])

        if not nombre or not celular:
            return {
                "error": "Debes ingresar tu nombre y número de celular."
            }, 400

        if not token_verificacion:
            return {"error": "Debes verificar tu celular antes de reservar."}, 400

        try:
            verificacion = _serializador_verificacion().loads(
                token_verificacion, max_age=300
            )
        except SignatureExpired:
            return {"error": "La verificación expiró. Verifica tu celular nuevamente."}, 400
        except BadSignature:
            return {"error": "La verificación del celular no es válida."}, 400

        if verificacion.get("celular") != celular:
            return {"error": "El celular verificado no coincide con el de la reserva."}, 400

        usuario = registrar_cliente_publico(nombre, celular)

        turno = crear_turno(
            usuario.id,
            tramite_id,
            punto_id,
            franja_id,
        )

        return {
            "mensaje": "Tu turno fue reservado correctamente.",
            "turno": turno_response(turno),
            "cliente": {
                "nombre": usuario.nombre,
                "celular": usuario.celular,
            },
        }, 201

    except (KeyError, TypeError, ValueError) as error:
        return {"error": str(error)}, 400


@turnos_bp.post("/")
@jwt_required()
def solicitar_turno():
    datos = request.get_json(silent=True) or {}

    try:
        turno = crear_turno(
            int(get_jwt_identity()),
            int(datos["tramite_id"]),
            int(datos["punto_id"]),
            int(datos["franja_id"]),
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
        turno = cancelar_turno(
            turno_id,
            int(get_jwt_identity()),
        )
        return {
            "mensaje": "Turno cancelado.",
            "turno": turno_response(turno),
        }, 200

    except ValueError as error:
        return {"error": str(error)}, 400