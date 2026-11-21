"""Zona horaria en la que se GUARDAN las fechas/horas en la base de datos.

Todas las columnas DATETIME se guardan en hora de Colombia (America/Bogota,
UTC-5, sin horario de verano) y sin zona ("naive"), para que al abrir la base
de datos se lean igual que en la app. Al enviarlas al navegador se agrega el
desfase (-05:00) para que el frontend las interprete sin ambigüedad.

Este módulo no depende de Flask ni de la BD: lo usan los modelos y servicios.
"""

import os
from datetime import datetime
from zoneinfo import ZoneInfo

ZONA_BD = ZoneInfo(os.getenv("ZONA_HORARIA", "America/Bogota"))


def ahora_bd(microsegundos=True):
    """Fecha y hora actual en hora Colombia, sin zona (como se guarda)."""
    ahora = datetime.now(ZONA_BD).replace(tzinfo=None)
    return ahora if microsegundos else ahora.replace(microsecond=0)


def a_bd(valor):
    """datetime con zona -> hora Colombia sin zona (para guardar o filtrar)."""
    if valor is None:
        return None
    if valor.tzinfo is None:
        return valor
    return valor.astimezone(ZONA_BD).replace(tzinfo=None)


def desde_bd(valor):
    """Fecha guardada (hora Colombia sin zona) -> datetime con zona."""
    if valor is None:
        return None
    return valor.replace(tzinfo=ZONA_BD)


def a_iso(valor):
    """Fecha guardada -> ISO 8601 con desfase, p. ej. 2026-11-21T08:30:00-05:00."""
    if valor is None:
        return None
    return desde_bd(valor.replace(microsecond=0)).isoformat()
