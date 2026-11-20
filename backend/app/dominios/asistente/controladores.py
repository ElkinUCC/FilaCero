"""API del asistente FilaCero IA.

    GET  /api/v1/asistente/sugerencias   preguntas iniciales según el rol
    POST /api/v1/asistente/preguntar     { pregunta, historial?, dias?, punto_id? }

Administrador y supervisor reciben el asistente gerencial (tablero, sedes en
vivo, taller, reclamos y proyección de mañana). El asesor recibe el copiloto
de su consola (cola, franja, preparación y jornada). El rol sale del JWT:
nadie puede pedir datos de otro rol cambiando el cuerpo de la petición.
"""

import logging

from flask import Blueprint, current_app, jsonify, request

from app.dominios.usuarios.servicios import obtener_usuario
from app.seguridad import limitar, requiere_rol, usuario_autenticado

from . import llm
from .contexto import contexto_asesor, contexto_gerencial, resumen_para_modelo
from .motor import SUGERENCIAS_INICIALES, responder

asistente_bp = Blueprint("asistente", __name__)
log = logging.getLogger("filacero.asistente")

MAX_PREGUNTA = 500


def _contexto(usuario, cuerpo):
    if usuario.rol == "AGENTE":
        return contexto_asesor(obtener_usuario(usuario.id))
    dias = cuerpo.get("dias", 7)
    punto_id = cuerpo.get("punto_id") or None
    try:
        dias = int(dias)
        punto_id = int(punto_id) if punto_id else None
    except (TypeError, ValueError):
        raise ValueError("Parámetros no válidos.") from None
    if not 1 <= dias <= 92:
        raise ValueError("dias debe estar entre 1 y 92.")
    return contexto_gerencial(dias, punto_id)


@asistente_bp.get("/sugerencias")
@requiere_rol("ADMIN", "SUPERVISOR", "AGENTE")
def sugerencias():
    usuario = usuario_autenticado()
    rol = "asesor" if usuario.rol == "AGENTE" else "gerencial"
    return (
        jsonify(
            {
                "sugerencias": SUGERENCIAS_INICIALES[rol],
                "modo": "ia" if llm.disponible() else "local",
                "nombre": "FilaCero IA",
            }
        ),
        200,
    )


@asistente_bp.post("/preguntar")
@requiere_rol("ADMIN", "SUPERVISOR", "AGENTE")
@limitar("LIMITE_ASISTENTE_POR_MINUTO")
def preguntar():
    cuerpo = request.get_json(silent=True) or {}
    pregunta = str(cuerpo.get("pregunta") or "").strip()
    if len(pregunta) < 2:
        return jsonify({"error": "Escribe una pregunta."}), 400
    if len(pregunta) > MAX_PREGUNTA:
        return jsonify({"error": f"La pregunta admite máximo {MAX_PREGUNTA} caracteres."}), 400
    historial = cuerpo.get("historial") if isinstance(cuerpo.get("historial"), list) else []

    usuario = usuario_autenticado()
    try:
        ctx = _contexto(usuario, cuerpo)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    resultado = responder(pregunta, ctx)
    if llm.disponible():
        texto = llm.redactar(
            pregunta, historial, resumen_para_modelo(ctx), resultado["respuesta"], ctx["rol"]
        )
        if texto:
            resultado["respuesta"] = texto
            resultado["fuente"] = "ia"
    if current_app.config.get("DEBUG"):
        log.debug("Asistente %s: %s -> %s", usuario.rol, pregunta, resultado["intenciones"])
    return jsonify(resultado), 200
