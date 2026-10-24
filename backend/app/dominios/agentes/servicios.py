from datetime import datetime, timezone

from app import db
from app.dominios.sedes.modelos import Punto
from .repositorios import (
    obtener_agente,
    obtener_cola,
    obtener_siguiente_bloqueado,
    obtener_turno_bloqueado,
)


def _validar_agente(usuario_id):
    agente = obtener_agente(usuario_id)

    if not agente:
        raise ValueError("El agente no existe o está inactivo.")

    if not agente.punto_asignado_id:
        raise ValueError("El agente no tiene una sede asignada.")

    punto = db.session.get(Punto, agente.punto_asignado_id)

    if not punto or not punto.activo:
        raise ValueError("La sede asignada no existe o está inactiva.")

    return agente


def consultar_cola(usuario_id):
    agente = _validar_agente(usuario_id)
    return obtener_cola(agente.punto_asignado_id)


def llamar_siguiente(usuario_id):
    try:
        agente = _validar_agente(usuario_id)

        turno = obtener_siguiente_bloqueado(
            agente.punto_asignado_id
        )

        if not turno:
            raise ValueError("No hay turnos pendientes.")

        turno.estado = "LLAMADO"
        turno.agente_id = agente.id

        db.session.commit()
        return turno

    except Exception:
        db.session.rollback()
        raise


def iniciar_atencion(usuario_id, turno_id):
    try:
        agente = _validar_agente(usuario_id)
        turno = obtener_turno_bloqueado(turno_id)

        if not turno:
            raise ValueError("El turno no existe.")

        if turno.punto_id != agente.punto_asignado_id:
            raise ValueError("El turno pertenece a otra sede.")

        if turno.agente_id != agente.id:
            raise ValueError("El turno no está asignado a este agente.")

        if turno.estado != "LLAMADO":
            raise ValueError("El turno debe estar en estado LLAMADO.")

        turno.estado = "EN_ATENCION"
        turno.fecha_inicio = datetime.now(timezone.utc).replace(
            tzinfo=None
        )

        db.session.commit()
        return turno

    except Exception:
        db.session.rollback()
        raise


def finalizar_atencion(usuario_id, turno_id):
    try:
        agente = _validar_agente(usuario_id)
        turno = obtener_turno_bloqueado(turno_id)

        if not turno:
            raise ValueError("El turno no existe.")

        if turno.punto_id != agente.punto_asignado_id:
            raise ValueError("El turno pertenece a otra sede.")

        if turno.agente_id != agente.id:
            raise ValueError("El turno no está asignado a este agente.")

        if turno.estado != "EN_ATENCION":
            raise ValueError(
                "Solo se pueden finalizar turnos en atención."
            )

        turno.estado = "ATENDIDO"
        turno.fecha_fin = datetime.now(timezone.utc).replace(
            tzinfo=None
        )

        db.session.commit()
        return turno

    except Exception:
        db.session.rollback()
        raise