"""Endpoints de Reclamos (/api/v1/reclamos).

Público (celular verificado por OTP):
    POST /publico               radicar un reclamo (en línea o para seguir en persona)
    POST /publico/mios          reclamos del ciudadano con su estado y respuesta
Personal:
    GET  /                      bandeja de la sede (asesor) o de todas (panel)
    PUT  /<id>                  el asesor responde o cambia el estado
"""

from flask import Blueprint, request
from flask_jwt_extended import current_user

from app.dominios.auditoria.servicios import registrar as auditar
from app.dominios.turnos.otp import celular_del_token
from app.dominios.usuarios.servicios import cliente_por_celular, registrar_cliente_publico
from app.seguridad import limitar, requiere_rol

from .dtos import CATEGORIAS, ESTADOS_RECLAMO, reclamo_response
from .servicios import (
    escribir_asesor,
    escribir_cliente,
    gestionar,
    marcar_leidos,
    obtener_reclamo,
    radicar,
    reclamos_de_cliente,
    reclamos_de_sede,
)

reclamos_bp = Blueprint("reclamos", __name__)


@reclamos_bp.get("/catalogo")
def catalogo():
    return {"categorias": CATEGORIAS, "estados": ESTADOS_RECLAMO}, 200


@reclamos_bp.post("/publico")
@limitar("LIMITE_OTP_POR_MINUTO")
def radicar_publico():
    datos = request.get_json(silent=True) or {}
    try:
        celular = celular_del_token(datos, ("reserva",))
    except ValueError as error:
        return {"error": str(error)}, 400
    cliente = registrar_cliente_publico(datos.get("nombre"), celular)
    reclamo = radicar(cliente, datos)
    return {
        "mensaje": f"Tu reclamo quedó radicado con el número {reclamo.radicado}.",
        "reclamo": reclamo_response(reclamo, publica=True),
        "reclamo_id": reclamo.id,
    }, 201


@reclamos_bp.post("/publico/mios")
@limitar("LIMITE_PUBLICO_POR_MINUTO")
def mis_reclamos():
    datos = request.get_json(silent=True) or {}
    try:
        celular = celular_del_token(datos)
    except ValueError as error:
        return {"error": str(error)}, 400
    cliente = cliente_por_celular(celular)
    reclamos = reclamos_de_cliente(cliente.id) if cliente else []
    respuesta = {"reclamos": [reclamo_response(r, publica=True) for r in reclamos]}
    if datos.get("marcar_leidos", True):
        marcar_leidos(reclamos, "cliente")
    return respuesta, 200


@reclamos_bp.post("/publico/mensajes")
@limitar("LIMITE_OTP_POR_MINUTO")
def escribir_publico():
    """Minichat: el ciudadano escribe y el asistente responde al instante."""
    datos = request.get_json(silent=True) or {}
    try:
        celular = celular_del_token(datos)
    except ValueError as error:
        return {"error": str(error)}, 400
    cliente = cliente_por_celular(celular)
    if not cliente:
        return {"error": "No encontramos reclamos para tu celular."}, 404
    reclamo = escribir_cliente(cliente, datos.get("radicado"), datos.get("texto"))
    return {"reclamo": reclamo_response(reclamo, publica=True)}, 201


@reclamos_bp.get("/")
@requiere_rol("AGENTE", "ADMIN", "SUPERVISOR")
def bandeja():
    punto_id = (
        current_user.punto_asignado_id
        if current_user.rol == "AGENTE"
        else request.args.get("punto_id", type=int)
    )
    estado = request.args.get("estado") or None
    if estado and estado not in ESTADOS_RECLAMO:
        return {"error": "Estado no válido."}, 400
    reclamos = reclamos_de_sede(punto_id, estado)
    filas = [reclamo_response(r) for r in reclamos]
    return {
        "reclamos": filas,
        "estados": ESTADOS_RECLAMO,
        "pendientes": sum(1 for r in reclamos if r.estado != "RESUELTO"),
        "mensajes_sin_leer": sum(f["sin_leer"] for f in filas),
    }, 200


@reclamos_bp.post("/<int:reclamo_id>/mensajes")
@requiere_rol("AGENTE")
def escribir_personal(reclamo_id):
    datos = request.get_json(silent=True) or {}
    reclamo = escribir_asesor(current_user, reclamo_id, datos.get("texto"))
    auditar("reclamo_gestionado", f"{reclamo.radicado}: mensaje del asesor")
    return {"mensaje": "Mensaje enviado.", "reclamo": reclamo_response(reclamo)}, 201


@reclamos_bp.put("/<int:reclamo_id>/leido")
@requiere_rol("AGENTE")
def marcar_leido(reclamo_id):
    reclamo = obtener_reclamo(reclamo_id)
    if not reclamo or reclamo.punto_id != current_user.punto_asignado_id:
        return {"error": "El reclamo no existe en tu sede."}, 404
    marcar_leidos([reclamo], "asesor")
    return {"reclamo": reclamo_response(reclamo)}, 200


@reclamos_bp.put("/<int:reclamo_id>")
@requiere_rol("AGENTE")
def responder(reclamo_id):
    datos = request.get_json(silent=True) or {}
    reclamo = gestionar(current_user, reclamo_id, datos.get("estado"), datos.get("respuesta"))
    auditar("reclamo_gestionado", f"{reclamo.radicado} → {ESTADOS_RECLAMO[reclamo.estado]}")
    return {
        "mensaje": f"{reclamo.radicado}: {ESTADOS_RECLAMO[reclamo.estado]}.",
        "reclamo": reclamo_response(reclamo),
    }, 200
