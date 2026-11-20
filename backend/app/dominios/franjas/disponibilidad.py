"""Controlador público de disponibilidad: franjas reservables por sede, trámite y fecha."""

from flask import Blueprint, jsonify, request

from app.seguridad import limitar

from .servicios import FechaNoReservableError, franjas_reservables

disponibilidad_bp = Blueprint("disponibilidad", __name__)


@disponibilidad_bp.get("/disponibles")
@limitar("LIMITE_PUBLICO_POR_MINUTO")
def consultar_disponibilidad():
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
