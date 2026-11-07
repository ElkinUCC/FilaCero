from datetime import UTC, datetime

from app import db
from app.dominios.sedes.modelos import Punto
from app.horario import _config_operativa, ahora_local, apertura, cierre, dia_habil

from .repositorios import (
    obtener_agente,
    obtener_cola,
    obtener_siguiente_bloqueado,
    obtener_turno_activo,
    obtener_turno_bloqueado,
)


def _utc_ahora():
    return datetime.now(UTC).replace(tzinfo=None)


def en_horario_de_atencion():
    ahora = ahora_local()
    return dia_habil(ahora.date()) and apertura() <= ahora.time() < cierre()


def _validar_horario():
    if not _config_operativa("RESTRINGIR_ATENCION_HORARIO", True):
        return
    if not en_horario_de_atencion():
        raise ValueError(f"Fuera del horario de atención ({apertura():%H:%M} a {cierre():%H:%M}).")


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


def _validar_turno_propio(agente, turno):
    if not turno:
        raise ValueError("El turno no existe.")
    if turno.punto_id != agente.punto_asignado_id:
        raise ValueError("El turno pertenece a otra sede.")
    if turno.agente_id != agente.id:
        raise ValueError("El turno no está asignado a este agente.")


def consultar_cola(usuario_id):
    agente = _validar_agente(usuario_id)
    return obtener_cola(agente.punto_asignado_id)


def cambiar_sede_propia(usuario_id, punto_id):
    """Rotación: el asesor elige en qué sede atiende hoy.

    El cupo de ambas sedes se recalcula solo (cupo = 3 x asesores activos).
    No se permite cambiar con un turno llamado o en atención.
    """
    from app.errores import ConflictoError, DatosInvalidosError, NoEncontradoError

    if not isinstance(punto_id, int) or isinstance(punto_id, bool):
        raise DatosInvalidosError("Elige una sede válida.")
    agente = obtener_agente(usuario_id)
    if not agente:
        raise NoEncontradoError("El asesor no existe o está inactivo.")
    punto = db.session.get(Punto, punto_id)
    if not punto or not punto.activo:
        raise NoEncontradoError("La sede no existe o está inactiva.")
    if agente.punto_asignado_id == punto.id:
        return agente, None
    if obtener_turno_activo(usuario_id):
        raise ConflictoError(
            "Termina o devuelve a la cola el turno en curso antes de cambiar de sede."
        )
    anterior = agente.punto_asignado.nombre if agente.punto_asignado else "sin sede"
    agente.punto_asignado_id = punto.id
    from app.dominios.usuarios.servicios import liberar_modulo_si_choca

    liberar_modulo_si_choca(agente)
    db.session.commit()
    return agente, anterior


def turno_activo(usuario_id):
    return obtener_turno_activo(usuario_id)


def llamar_siguiente(usuario_id):
    try:
        agente = _validar_agente(usuario_id)
        _validar_horario()

        activo = obtener_turno_activo(agente.id)
        if activo:
            raise ValueError(
                f"Ya tienes un turno en curso ({activo.codigo}). Finalízalo antes de llamar otro."
            )

        turno = obtener_siguiente_bloqueado(agente.punto_asignado_id)
        if not turno:
            raise ValueError("No hay turnos pendientes.")

        turno.estado = "LLAMADO"
        turno.agente_id = agente.id
        turno.fecha_llamado = _utc_ahora()
        agente.presencia = "DISPONIBLE"  # llamar a alguien implica estar atendiendo
        db.session.commit()
        return turno
    except Exception:
        db.session.rollback()
        raise


def llamar_turno(usuario_id, turno_id):
    """El asesor elige a una persona concreta de la cola (p. ej. adelantar)."""
    try:
        agente = _validar_agente(usuario_id)
        _validar_horario()
        activo = obtener_turno_activo(agente.id)
        if activo:
            raise ValueError(
                f"Ya tienes un turno en curso ({activo.codigo}). Finalízalo antes de llamar otro."
            )
        turno = obtener_turno_bloqueado(turno_id)
        if not turno:
            raise ValueError("El turno no existe.")
        if turno.punto_id != agente.punto_asignado_id:
            raise ValueError("El turno pertenece a otra sede.")
        if turno.estado != "ESPERANDO":
            raise ValueError("Ese turno ya no está en espera.")
        turno.estado = "LLAMADO"
        turno.agente_id = agente.id
        turno.fecha_llamado = _utc_ahora()
        agente.presencia = "DISPONIBLE"  # llamar a alguien implica estar atendiendo
        db.session.commit()
        return turno
    except Exception:
        db.session.rollback()
        raise


def iniciar_atencion(usuario_id, turno_id):
    try:
        agente = _validar_agente(usuario_id)
        turno = obtener_turno_bloqueado(turno_id)
        _validar_turno_propio(agente, turno)
        if turno.estado != "LLAMADO":
            raise ValueError("El turno debe estar en estado LLAMADO.")
        turno.estado = "EN_ATENCION"
        turno.fecha_inicio = _utc_ahora()
        db.session.commit()
        return turno
    except Exception:
        db.session.rollback()
        raise


def finalizar_atencion(usuario_id, turno_id):
    try:
        agente = _validar_agente(usuario_id)
        turno = obtener_turno_bloqueado(turno_id)
        _validar_turno_propio(agente, turno)
        if turno.estado != "EN_ATENCION":
            raise ValueError("Solo se pueden finalizar turnos en atención.")
        turno.estado = "ATENDIDO"
        turno.fecha_fin = _utc_ahora()
        db.session.commit()
        return turno
    except Exception:
        db.session.rollback()
        raise


def marcar_no_asistio(usuario_id, turno_id):
    try:
        agente = _validar_agente(usuario_id)
        turno = obtener_turno_bloqueado(turno_id)
        _validar_turno_propio(agente, turno)
        if turno.estado != "LLAMADO":
            raise ValueError("Solo puedes marcar ausente un turno llamado.")
        turno.estado = "NO_ASISTIO"
        turno.fecha_fin = _utc_ahora()
        db.session.commit()
        return turno
    except Exception:
        db.session.rollback()
        raise


def devolver_a_cola(usuario_id, turno_id):
    """El agente llamó por error: el turno vuelve a la cola."""
    try:
        agente = _validar_agente(usuario_id)
        turno = obtener_turno_bloqueado(turno_id)
        _validar_turno_propio(agente, turno)
        if turno.estado != "LLAMADO":
            raise ValueError("Solo puedes devolver a la cola un turno llamado.")
        turno.estado = "ESPERANDO"
        turno.agente_id = None
        turno.fecha_llamado = None
        db.session.commit()
        return turno
    except Exception:
        db.session.rollback()
        raise
