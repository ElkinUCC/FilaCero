from datetime import date

from flask import Blueprint, request

from .servicios import consultar_disponibilidad

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
