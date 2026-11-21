"""Servicios del asistente FilaCero IA.

Orquesta los scripts del asistente (scripts/asistente): arma el contexto de datos,
calcula la respuesta con el motor de reglas y, si hay modelo de lenguaje, la redacta.
"""

import logging

from app.dominios.usuarios.servicios import obtener_usuario
from scripts.asistente import llm
from scripts.asistente.contexto import contexto_asesor, contexto_gerencial, resumen_para_modelo
from scripts.asistente.motor import SUGERENCIAS_INICIALES, responder

from .dtos import leer_parametros_gerenciales, sugerencias_response

log = logging.getLogger("filacero.asistente")


def _rol(usuario):
    return "asesor" if usuario.rol == "AGENTE" else "gerencial"


def sugerencias(usuario):
    modo = "ia" if llm.disponible() else "local"
    return sugerencias_response(SUGERENCIAS_INICIALES[_rol(usuario)], modo)


def _contexto(usuario, cuerpo):
    if usuario.rol == "AGENTE":
        return contexto_asesor(obtener_usuario(usuario.id))
    return contexto_gerencial(*leer_parametros_gerenciales(cuerpo))


def preguntar(usuario, pregunta, historial, cuerpo):
    ctx = _contexto(usuario, cuerpo)
    resultado = responder(pregunta, ctx)
    if llm.disponible():
        texto = llm.redactar(
            pregunta, historial, resumen_para_modelo(ctx), resultado["respuesta"], ctx["rol"]
        )
        if texto:
            resultado["respuesta"] = texto
            resultado["fuente"] = "ia"
    log.debug("Asistente %s: %s -> %s", usuario.rol, pregunta, resultado["intenciones"])
    return resultado
