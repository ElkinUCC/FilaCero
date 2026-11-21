"""Validación de entrada y forma de las respuestas del asistente."""

from app.errores import DatosInvalidosError

MAX_PREGUNTA = 500
NOMBRE = "FilaCero IA"


def leer_pregunta(cuerpo):
    """Valida el cuerpo de /preguntar y devuelve (pregunta, historial)."""
    pregunta = str(cuerpo.get("pregunta") or "").strip()
    if len(pregunta) < 2:
        raise DatosInvalidosError("Escribe una pregunta.")
    if len(pregunta) > MAX_PREGUNTA:
        raise DatosInvalidosError(f"La pregunta admite máximo {MAX_PREGUNTA} caracteres.")
    historial = cuerpo.get("historial") if isinstance(cuerpo.get("historial"), list) else []
    return pregunta, historial


def leer_parametros_gerenciales(cuerpo):
    """Periodo (1 a 92 días) y sede opcional para administrador y supervisor."""
    try:
        dias = int(cuerpo.get("dias", 7))
        punto_id = int(cuerpo["punto_id"]) if cuerpo.get("punto_id") else None
    except (TypeError, ValueError):
        raise DatosInvalidosError("Parámetros no válidos.") from None
    if not 1 <= dias <= 92:
        raise DatosInvalidosError("dias debe estar entre 1 y 92.")
    return dias, punto_id


def sugerencias_response(sugerencias, modo):
    return {"sugerencias": sugerencias, "modo": modo, "nombre": NOMBRE}
