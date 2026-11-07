"""Endpoints de Equipos (/api/v1/equipos).

Público (con celular verificado por OTP):
    POST /publico/mios          equipos del ciudadano y su nombre registrado
Personal:
    GET  /                      equipos de la sede (asesor) o de todas (panel)
    POST /                      el asesor registra un equipo recibido
    PUT  /<id>/estado           el asesor avanza el estado del equipo
"""

from flask import Blueprint, request
from flask_jwt_extended import current_user

from app.dominios.auditoria.servicios import registrar as auditar
from app.dominios.turnos.otp import celular_del_token
from app.seguridad import limitar, requiere_rol

from .dtos import ESTADOS_EQUIPO, equipo_publico_response, equipo_response
from .repositorios import por_sede
from .servicios import MARCAS, cambiar_estado, equipos_del_celular, registrar_por_asesor

equipos_bp = Blueprint("equipos", __name__)


@equipos_bp.get("/catalogo")
def catalogo():
    """Opciones para los formularios (marcas y estados)."""
    return {"marcas": MARCAS, "estados": ESTADOS_EQUIPO, "garantia_dias": 365}, 200


@equipos_bp.post("/publico/mios")
@limitar("LIMITE_PUBLICO_POR_MINUTO")
def mis_equipos():
    datos = request.get_json(silent=True) or {}
    try:
        celular = celular_del_token(datos)
    except ValueError as error:
        return {"error": str(error)}, 400
    cliente, equipos = equipos_del_celular(celular)
    return {
        "cliente": {"nombre": cliente.nombre} if cliente else None,
        "equipos": [equipo_publico_response(e) for e in equipos],
    }, 200


@equipos_bp.get("/")
@requiere_rol("AGENTE", "ADMIN", "SUPERVISOR")
def listar():
    punto_id = (
        current_user.punto_asignado_id
        if current_user.rol == "AGENTE"
        else request.args.get("punto_id", type=int)
    )
    estado = request.args.get("estado") or None
    if estado and estado not in ESTADOS_EQUIPO:
        return {"error": "Estado no válido."}, 400
    equipos = por_sede(punto_id, estado, (request.args.get("buscar") or "").strip())
    return {"equipos": [equipo_response(e) for e in equipos], "estados": ESTADOS_EQUIPO}, 200


@equipos_bp.post("/")
@requiere_rol("AGENTE")
def registrar_equipo():
    equipo = registrar_por_asesor(current_user, request.get_json(silent=True) or {})
    auditar("equipo_registrado", f"{equipo.codigo} · {equipo.marca} · {equipo.cliente.nombre}")
    return {
        "mensaje": f"Equipo {equipo.codigo} registrado.",
        "equipo": equipo_response(equipo),
    }, 201


@equipos_bp.put("/<int:equipo_id>/estado")
@requiere_rol("AGENTE")
def actualizar_estado(equipo_id):
    datos = request.get_json(silent=True) or {}
    equipo = cambiar_estado(
        current_user, equipo_id, datos.get("estado"), datos.get("nota"), datos.get("documento")
    )
    auditar("equipo_actualizado", f"{equipo.codigo} → {ESTADOS_EQUIPO[equipo.estado]}")
    return {
        "mensaje": f"{equipo.codigo}: {ESTADOS_EQUIPO[equipo.estado]}.",
        "equipo": equipo_response(equipo),
    }, 200
