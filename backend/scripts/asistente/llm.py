"""Redacción opcional con un modelo de lenguaje (Claude de Anthropic)."""

import json
import logging
import urllib.error
import urllib.request

from flask import current_app

log = logging.getLogger("filacero.asistente")

URL = "https://api.anthropic.com/v1/messages"

INSTRUCCIONES = """Eres «FilaCero IA», el asistente de una plataforma de gestión de turnos presenciales en Colombia.
Hablas en español neutro y cercano, como un analista de operaciones experto.

Reglas obligatorias:
1. Responde SOLO con los datos del JSON <datos>. Nunca inventes cifras, nombres ni fechas.
2. Si el dato no está, dilo con honestidad y sugiere qué sí puedes responder.
3. Sé breve: máximo 120 palabras. Empieza por la respuesta directa con la cifra clave.
4. Puedes usar **negrita** y viñetas que empiecen por "- ". No uses tablas ni títulos con #.
5. Cuando aporte valor, cierra con una recomendación accionable de una línea.
6. El borrador <borrador> fue calculado por el sistema y sus cifras son correctas: úsalo como base.
{rol}"""

ROLES = {
    "gerencial": "Hablas con un administrador o supervisor que toma decisiones sobre sedes, personal y metas (meta de puntualidad: 90 %).",
    "asesor": "Hablas con un asesor en su puesto de atención: sé muy práctico, dile a quién llamar, qué alistar y cómo va su jornada.",
}


def disponible():
    cfg = current_app.config
    return bool(cfg.get("ANTHROPIC_API_KEY")) and cfg.get("IA_PROVEEDOR", "auto") != "local"


def redactar(pregunta, historial, datos, borrador, rol):
    """Devuelve el texto redactado por el modelo o None si no está disponible."""
    if not disponible():
        return None
    cfg = current_app.config
    mensajes = []
    for turno in (historial or [])[-6:]:
        quien = "assistant" if turno.get("rol") == "asistente" else "user"
        texto = str(turno.get("texto") or "")[:1200]
        if texto and (not mensajes or mensajes[-1]["role"] != quien):
            mensajes.append({"role": quien, "content": texto})
    if mensajes and mensajes[0]["role"] == "assistant":
        mensajes.pop(0)
    if mensajes and mensajes[-1]["role"] == "user":
        mensajes.pop()
    contenido = (
        f"<datos>{json.dumps(datos, ensure_ascii=False, default=str)}</datos>\n"
        f"<borrador>{borrador}</borrador>\n"
        f"Pregunta: {pregunta}"
    )
    mensajes.append({"role": "user", "content": contenido})
    cuerpo = {
        "model": cfg.get("IA_MODELO", "claude-haiku-5-5"),
        "max_tokens": 500,
        "temperature": 0.3,
        "system": INSTRUCCIONES.format(rol=ROLES.get(rol, "")),
        "messages": mensajes,
    }
    peticion = urllib.request.Request(
        URL,
        data=json.dumps(cuerpo).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": cfg["ANTHROPIC_API_KEY"],
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=cfg.get("IA_TIMEOUT_SEG", 12)) as r:
            respuesta = json.load(r)
        texto = "".join(
            b.get("text", "") for b in respuesta.get("content", []) if b.get("type") == "text"
        )
        return texto.strip() or None
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as error:
        log.warning("Asistente IA: el proveedor no respondió (%s). Se usa el motor local.", error)
        return None
