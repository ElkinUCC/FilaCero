"""Controladores HTTP del dominio Franjas: consulta, disponibilidad pública y administración."""

from datetime import date

from flask import Blueprint, jsonify, request

from app.seguridad import limitar, requiere_rol

from .dtos import franja_response
from .servicios import (
    FechaNoReservableError,
    cambiar_estado_franja,
    consultar_disponibilidad,
    crear_franja,
    franjas_reservables,
)

franjas_bp = Blueprint("franjas", __name__)


@franjas_bp.get("/")
def obtener_franjas():
    try:
        punto_id = request.args.get("punto_id", type=int)
        tramite_id = request.args.get("tramite_id", type=int)
        fecha_texto = request.args.get("fecha")

        fecha = None
        if fecha_texto:
            fecha = date.fromisoformat(fecha_texto)

        franjas = consultar_disponibilidad(punto_id=punto_id, tramite_id=tramite_id, fecha=fecha)

        return {"franjas": franjas}, 200

    except ValueError:
        return {"error": "La fecha debe tener formato AAAA-MM-DD."}, 400


# Administración de franjas (/api/v1/admin/franjas)


admin_franjas_bp = Blueprint("admin_franjas", __name__)


@admin_franjas_bp.post("/")
@requiere_rol("ADMIN")
def crear():
    try:
        franja = crear_franja(request.get_json(silent=True) or {})
        return {"franja": franja_response(franja)}, 201
    except ValueError as error:
        return {"error": str(error)}, 400


@admin_franjas_bp.patch("/<int:franja_id>")
@requiere_rol("ADMIN")
def cambiar_estado(franja_id):
    datos = request.get_json(silent=True) or {}
    if not isinstance(datos.get("activa"), bool):
        return {"error": "El campo activa debe ser true o false."}, 400
    try:
        franja = cambiar_estado_franja(franja_id, datos["activa"])
        return {"franja": franja_response(franja)}, 200
    except ValueError as error:
        return {"error": str(error)}, 400


# Disponibilidad pública de franjas reservables (/api/v1/franjas/disponibles)


disponibilidad_bp = Blueprint("disponibilidad", __name__)


@disponibilidad_bp.get("/disponibles")
@limitar("LIMITE_PUBLICO_POR_MINUTO")
def franjas_disponibles():
    """GET /api/v1/franjas/disponibles?sede_id=&tramite_id=&fecha=YYYY-MM-DD"""
    try:
        datos = franjas_reservables(
            request.args.get("sede_id", type=int),
            request.args.get("tramite_id", type=int),
            request.args.get("fecha", ""),
        )
    except FechaNoReservableError as error:
        return jsonify({"success": False, "error": str(error), "cantidad": 0, "franjas": []}), 400
    except ValueError as error:
        return jsonify({"success": False, "error": str(error)}), getattr(error, "codigo_http", 400)
    return jsonify(datos), 200
