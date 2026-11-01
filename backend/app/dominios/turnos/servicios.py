import secrets
import threading
from collections import defaultdict
from datetime import datetime

from app import db
from app.dominios.franjas.repositorios import obtener_para_reserva
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.usuarios.modelos import Usuario
from app.horario import ahora_local, capacidad_sede, ocupacion_sede, zona
from .modelos import Turno
from .repositorios import ESTADOS_ACTIVOS, guardar, obtener_por_id, obtener_por_usuario

MAX_TURNOS_ACTIVOS_POR_CLIENTE = 3

# Reservas de una misma sede se procesan de a una (ver ADR-0004):
#  - candado en memoria: protege entre hilos del mismo proceso (waitress);
#  - SELECT ... FOR UPDATE sobre la sede: protege entre procesos en MySQL.
_candados_sede = defaultdict(threading.Lock)
_candado_global = threading.Lock()


def _candado_de(punto_id):
    with _candado_global:
        return _candados_sede[punto_id]


def _generar_codigo(ahora):
    for _ in range(5):
        codigo = f"FC-{ahora:%Y%m%d}-{secrets.token_hex(3).upper()}"
        if not Turno.query.filter_by(codigo=codigo).first():
            return codigo
    raise ValueError("No se pudo generar el código del turno. Intenta de nuevo.")


def crear_turno(usuario_id, tramite_id, punto_id, franja_id):
    with _candado_de(punto_id):
        return _crear_turno(usuario_id, tramite_id, punto_id, franja_id)


def _crear_turno(usuario_id, tramite_id, punto_id, franja_id):
    try:
        usuario = db.session.get(Usuario, usuario_id)
        tramite = db.session.get(Tramite, tramite_id)
        # Bloquea la sede: las reservas de una misma sede se procesan en fila
        # (en MySQL), así nunca se supera el cupo de la franja.
        punto = db.session.query(Punto).filter_by(id=punto_id).with_for_update().first()

        if not usuario or not usuario.activo:
            raise ValueError("El usuario no existe o está inactivo.")
        if not tramite or not tramite.activo:
            raise ValueError("El trámite no existe o está inactivo.")
        if not punto or not punto.activo:
            raise ValueError("La sede no existe o está inactiva.")

        # Bloqueo de fila: evita sobrecupo con reservas simultáneas (MySQL).
        franja = obtener_para_reserva(franja_id)
        if not franja or not franja.activa:
            raise ValueError("La franja no existe o está inactiva.")
        if franja.punto_id != punto_id or franja.tramite_id != tramite_id:
            raise ValueError("La franja no corresponde a la sede y trámite.")

        ahora = ahora_local()
        inicio = datetime.combine(franja.fecha, franja.hora_inicio, tzinfo=zona())
        if inicio <= ahora:
            raise ValueError("No se pueden reservar franjas que ya comenzaron.")

        reservados = Turno.query.filter(
            Turno.franja_id == franja.id, Turno.estado != "CANCELADO"
        ).count()
        if reservados >= franja.capacidad:
            raise ValueError("La franja ya no tiene cupos disponibles.")

        # Regla de puntualidad: la sede no recibe más personas por franja de
        # las que sus asesores alcanzan a atender (3 por asesor cada 30 min).
        if ocupacion_sede(punto_id, franja.fecha, franja.hora_inicio) >= capacidad_sede(punto_id):
            raise ValueError("La franja ya no tiene cupos disponibles.")

        duplicado = Turno.query.filter(
            Turno.usuario_id == usuario_id,
            Turno.franja_id == franja.id,
            Turno.estado != "CANCELADO",
        ).first()
        if duplicado:
            raise ValueError("Ya tienes una reserva activa en esta franja.")

        activos = Turno.query.filter(
            Turno.usuario_id == usuario_id, Turno.estado.in_(ESTADOS_ACTIVOS)
        ).count()
        if activos >= MAX_TURNOS_ACTIVOS_POR_CLIENTE:
            raise ValueError(
                f"Ya tienes {MAX_TURNOS_ACTIVOS_POR_CLIENTE} turnos activos. "
                "Cancela uno para reservar otro."
            )

        turno = Turno(
            codigo=_generar_codigo(ahora),
            usuario_id=usuario_id,
            tramite_id=tramite_id,
            punto_id=punto_id,
            franja_id=franja.id,
            estado="ESPERANDO",
        )
        return guardar(turno)

    except Exception:
        db.session.rollback()
        raise


def mis_turnos(usuario_id):
    return obtener_por_usuario(usuario_id)


def _cancelar(turno):
    if turno.estado != "ESPERANDO":
        raise ValueError("Solo se pueden cancelar turnos en espera.")
    turno.estado = "CANCELADO"
    db.session.commit()
    return turno


def cancelar_turno(turno_id, usuario_id):
    try:
        turno = obtener_por_id(turno_id)
        if not turno:
            raise ValueError("El turno no existe.")
        if turno.usuario_id != usuario_id:
            raise ValueError("No puedes cancelar un turno de otro usuario.")
        return _cancelar(turno)
    except Exception:
        db.session.rollback()
        raise


def cancelar_turno_publico(turno):
    try:
        return _cancelar(turno)
    except Exception:
        db.session.rollback()
        raise
