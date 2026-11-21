"""Servicio de la pantalla de sala de espera (pública, sin datos personales sensibles)."""

from datetime import timedelta

from app.dominios.sedes.repositorios import obtener_activos as sedes_activas
from app.dominios.sedes.repositorios import obtener_por_id as obtener_sede
from app.horario import ahora_local, hoy_local, info_horario
from app.tiempo import a_bd

from . import repositorios as repo
from .dtos import turno_llamado_sala_response, turno_siguiente_sala_response

MINUTOS_VISIBLES = 30


def pantalla_de_sala(sede_id):
    sedes = [{"id": p.id, "nombre": p.nombre} for p in sedes_activas()]
    sede = obtener_sede(sede_id) if sede_id else None
    if not sede or not sede.activo:
        return {"sedes": sedes, "sede": None}

    hoy = hoy_local()
    desde = a_bd(ahora_local() - timedelta(minutes=MINUTOS_VISIBLES))
    return {
        "sedes": sedes,
        "sede": {"id": sede.id, "nombre": sede.nombre, "direccion": sede.direccion},
        "horario": info_horario(),
        "llamados": [
            turno_llamado_sala_response(t) for t in repo.llamados_recientes(sede.id, hoy, desde)
        ],
        "siguientes": [
            turno_siguiente_sala_response(t) for t in repo.siguientes_en_espera(sede.id, hoy)
        ],
    }
