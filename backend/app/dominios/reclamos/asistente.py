"""Asistente automático del minichat (reglas, sin servicios externos).

Responde al instante las preguntas frecuentes con datos reales del sistema
(horario, estado del equipo, requisitos de entrega y garantía) y deja claro
que un asesor humano continúa la conversación. No inventa precios ni
diagnósticos: eso lo confirma el asesor.
"""

import unicodedata

from app.horario import info_horario

NOMBRE = "Asistente FilaCero"


def _plano(texto):
    t = unicodedata.normalize("NFD", str(texto or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def _tiene(t, *palabras):
    return any(p in t for p in palabras)


def _estado_equipos(reclamo):
    from app.dominios.equipos.dtos import ESTADOS_EQUIPO
    from app.dominios.equipos.modelos import Equipo

    equipos = (
        [reclamo.equipo]
        if reclamo.equipo
        else (
            Equipo.query.filter(
                Equipo.cliente_id == reclamo.cliente_id, Equipo.estado != "ENTREGADO"
            ).all()
        )
    )
    if not equipos:
        return None
    return " · ".join(
        f"{e.marca} {e.modelo or ''} ({e.codigo}): {ESTADOS_EQUIPO.get(e.estado, e.estado)}".replace(
            "  ", " "
        )
        for e in equipos[:3]
    )


def responder(reclamo, texto):
    """Devuelve la respuesta automática para el mensaje del ciudadano."""
    t = _plano(texto)
    sede = reclamo.punto.nombre if reclamo.punto else "la sede"
    partes = []
    if _tiene(
        t, "listo", "estado", "como va", "cuando", "avance", "mi equipo", "mi tv", "televisor"
    ):
        estado = _estado_equipos(reclamo)
        if estado:
            partes.append(
                f"Así va tu equipo: {estado}. Cuando esté listo puedes reservar la entrega en «Reservar turno»."
            )
    if _tiene(t, "precio", "cuanto", "vale", "valor", "costo", "cobr", "pagar"):
        partes.append(
            "El valor exacto lo confirma tu asesor por este chat; si ya te dio un valor, ese es el vigente."
        )
    if _tiene(t, "horario", "hora", "abren", "cierran", "atienden"):
        h = info_horario()
        dias = "todos los días" if h["todos_los_dias"] else ", ".join(h["dias"])
        partes.append(
            f"Atendemos {dias} de {h['hora_apertura']} a {h['hora_cierre']}, con franjas de {h['duracion_franja_min']} minutos."
        )
    if _tiene(t, "garantia"):
        partes.append(
            "La garantía cubre 1 año desde la compra: trae el televisor, la factura y tu cédula."
        )
    if _tiene(t, "cedula", "documento", "recoger", "reclamar", "retirar"):
        partes.append(
            "Para recibir un equipo trae tu cédula original: sin ella no podemos entregarlo."
        )
    if _tiene(t, "turno", "cita", "reservar", "ir a", "llevar", "visitar"):
        partes.append(
            "Puedes reservar en «Reservar turno»: eliges sede, día y hora y te atendemos en tu franja, sin fila."
        )
    if not partes:
        partes.append("Recibimos tu mensaje.")
    partes.append(f"Un asesor de {sede} lo revisa y te responde por aquí.")
    return " ".join(partes)
