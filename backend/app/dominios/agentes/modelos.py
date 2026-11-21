"""Modelos del dominio Agentes (atención).

La atención no crea tablas propias: trabaja sobre el turno, el asesor (usuario),
la franja, la sede y el trámite. Se reexportan aquí para que el repositorio
del dominio los use desde un solo lugar.
"""

from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.modelos import Turno
from app.dominios.usuarios.modelos import Usuario

__all__ = ["Franja", "Punto", "Tramite", "Turno", "Usuario"]
