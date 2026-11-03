"""Consulta y configuración controlada de la organización activa."""
import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from flask import Blueprint, g, request
from flask_jwt_extended import current_user, jwt_required

from app import db
from app.seguridad import requiere_rol

organizaciones_bp = Blueprint("organizaciones", __name__)


def _respuesta(organizacion):
    return {
        "id": organizacion.id,
        "nombre": organizacion.nombre,
        "slug": organizacion.slug,
        "industria": organizacion.industria,
        "pais": organizacion.pais,
        "zona_horaria": organizacion.zona_horaria,
        "idioma": organizacion.idioma,
        "moneda": organizacion.moneda,
        "plan": organizacion.plan,
        "estado": organizacion.estado,
        "configuracion": organizacion.configuracion or {},
    }


@organizaciones_bp.get("/actual")
@jwt_required()
def obtener_actual():
    if not current_user or current_user.organizacion_id != g.organizacion_id:
        return {"error": "No se pudo validar la organización de la sesión."}, 401
    return {"organizacion": _respuesta(g.organizacion)}, 200


@organizaciones_bp.patch("/actual")
@requiere_rol("ADMIN")
def actualizar_actual():
    datos = request.get_json(silent=True) or {}
    permitidos = {"nombre", "industria", "pais", "zona_horaria", "idioma", "moneda", "configuracion"}
    no_permitidos = set(datos) - permitidos
    if no_permitidos:
        return {"error": "Hay campos que no se pueden modificar.", "campos": sorted(no_permitidos)}, 400

    validaciones = {
        "nombre": (160, r".{2,160}"),
        "industria": (60, r"[a-zA-Z0-9_-]{2,60}"),
        "pais": (2, r"[A-Z]{2}"),
        "zona_horaria": (64, r"[A-Za-z_+-]+(?:/[A-Za-z0-9_+.-]+)*"),
        "idioma": (10, r"[a-z]{2}(?:-[A-Z]{2})?"),
        "moneda": (3, r"[A-Z]{3}"),
    }
    for campo, (maximo, patron) in validaciones.items():
        if campo not in datos:
            continue
        valor = datos[campo]
        if not isinstance(valor, str) or len(valor) > maximo or not re.fullmatch(patron, valor.strip()):
            return {"error": f"El campo {campo} no tiene un formato válido."}, 400
        if campo == "zona_horaria":
            try:
                ZoneInfo(valor.strip())
            except ZoneInfoNotFoundError:
                return {"error": "La zona horaria no existe en la base IANA."}, 400
        setattr(g.organizacion, campo, valor.strip())

    if "configuracion" in datos:
        configuracion = datos["configuracion"]
        if not isinstance(configuracion, dict):
            return {"error": "La configuración debe ser un objeto JSON."}, 400
        # No se permite almacenar credenciales ni secretos en este JSON.
        claves_prohibidas = {"password", "secret", "token", "api_key", "apikey", "private_key", "credential"}

        def contiene_secreto(valor):
            if isinstance(valor, dict):
                for clave, contenido in valor.items():
                    nombre = str(clave).lower()
                    if nombre in claves_prohibidas or any(
                        fragmento in nombre for fragmento in ("password", "secret", "token", "api_key", "private_key", "credential")
                    ):
                        return True
                    if contiene_secreto(contenido):
                        return True
            elif isinstance(valor, list):
                return any(contiene_secreto(elemento) for elemento in valor)
            return False

        if contiene_secreto(configuracion):
            return {"error": "Las credenciales deben gestionarse mediante un almacén de secretos."}, 400

        horario = configuracion.get("horario", {})
        if not isinstance(horario, dict):
            return {"error": "configuracion.horario debe ser un objeto JSON."}, 400
        campos_horario = {
            "apertura", "cierre", "dias_atencion", "duracion_franja_min",
            "dias_max_reserva", "duracion_max_atencion_min",
            "cupos_por_asesor_franja", "franjas_automaticas",
            "restringir_atencion_horario", "cola_solo_hoy",
        }
        if set(horario) - campos_horario:
            return {"error": "La configuración de horario contiene campos desconocidos."}, 400
        for campo in ("apertura", "cierre"):
            if campo in horario and (type(horario[campo]) is not int or not 0 <= horario[campo] <= 24):
                return {"error": f"horario.{campo} debe ser un entero entre 0 y 24."}, 400
        if "apertura" in horario and "cierre" in horario and horario["cierre"] <= horario["apertura"]:
            return {"error": "La hora de cierre debe ser posterior a la apertura."}, 400
        for campo, minimo, maximo in (
            ("duracion_franja_min", 5, 240),
            ("dias_max_reserva", 1, 365),
            ("duracion_max_atencion_min", 1, 240),
            ("cupos_por_asesor_franja", 0, 500),
        ):
            if campo in horario and (
                type(horario[campo]) is not int or not minimo <= horario[campo] <= maximo
            ):
                return {"error": f"horario.{campo} debe estar entre {minimo} y {maximo}."}, 400
        if "dias_atencion" in horario and (
            not isinstance(horario["dias_atencion"], list)
            or not horario["dias_atencion"]
            or any(type(dia) is not int or dia not in range(7) for dia in horario["dias_atencion"])
            or len(set(horario["dias_atencion"])) != len(horario["dias_atencion"])
        ):
            return {"error": "horario.dias_atencion debe contener días únicos entre 0 y 6."}, 400
        for campo in ("franjas_automaticas", "restringir_atencion_horario", "cola_solo_hoy"):
            if campo in horario and not isinstance(horario[campo], bool):
                return {"error": f"horario.{campo} debe ser booleano."}, 400

        g.organizacion.configuracion = configuracion

    db.session.commit()
    return {"mensaje": "Configuración de organización actualizada.", "organizacion": _respuesta(g.organizacion)}, 200
