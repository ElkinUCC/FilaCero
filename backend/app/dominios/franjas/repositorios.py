"""Acceso a datos de las franjas de atención y su ocupación."""

from datetime import datetime

from app import db
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.horario import ahora_local, zona

from .modelos import Franja


def listar_activas(punto_id=None, tramite_id=None, fecha=None):
    consulta = (
        db.session.query(Franja)
        .join(Punto, Franja.punto_id == Punto.id)
        .join(Tramite, Franja.tramite_id == Tramite.id)
        .filter(
            Franja.activa.is_(True),
            Punto.activo.is_(True),
            Tramite.activo.is_(True),
        )
    )
    if punto_id is not None:
        consulta = consulta.filter(Franja.punto_id == punto_id)
    if tramite_id is not None:
        consulta = consulta.filter(Franja.tramite_id == tramite_id)
    if fecha is not None:
        consulta = consulta.filter(Franja.fecha == fecha)

    ahora = ahora_local()
    return [
        franja
        for franja in consulta.order_by(Franja.fecha, Franja.hora_inicio).limit(500).all()
        if datetime.combine(franja.fecha, franja.hora_inicio, tzinfo=zona()) > ahora
    ]


def obtener_para_reserva(franja_id):
    return db.session.query(Franja).filter_by(id=franja_id).with_for_update().first()


def franjas_activas_del_dia(punto_id, tramite_id, fecha):
    return (
        Franja.query.filter(
            Franja.punto_id == punto_id,
            Franja.tramite_id == tramite_id,
            Franja.fecha == fecha,
            Franja.activa.is_(True),
        )
        .order_by(Franja.hora_inicio.asc())
        .all()
    )


def reservas_por_franja(ids):
    """{franja_id: reservas no canceladas} en una sola consulta (sin N+1)."""
    if not ids:
        return {}
    from app.dominios.turnos.modelos import Turno

    return dict(
        db.session.query(Turno.franja_id, db.func.count(Turno.id))
        .filter(Turno.franja_id.in_(ids), Turno.estado.notin_(("CANCELADO",)))
        .group_by(Turno.franja_id)
        .all()
    )
