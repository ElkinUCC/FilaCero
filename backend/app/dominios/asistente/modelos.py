"""Modelos del dominio Asistente.

El asistente no tiene tablas propias: solo lee las entidades de otros dominios.
Se reexportan aquí para que la capa de repositorio del dominio las use desde un solo lugar.
"""

from app.dominios.franjas.modelos import Franja
from app.dominios.reclamos.modelos import Reclamo
from app.dominios.turnos.modelos import Turno

__all__ = ["Franja", "Reclamo", "Turno"]
