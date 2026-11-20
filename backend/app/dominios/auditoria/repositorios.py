"""Acceso a datos de la bitácora de auditoría."""

from app import db

from .modelos import Auditoria


def agregar(evento):
    db.session.add(evento)
    db.session.commit()
    return evento


def paginar(pagina, por_pagina, accion=None, usuario_id=None):
    """Eventos más recientes primero, con filtros opcionales por acción y usuario."""
    consulta = Auditoria.query
    if accion:
        consulta = consulta.filter(Auditoria.accion == accion)
    if usuario_id is not None:
        consulta = consulta.filter(Auditoria.usuario_id == usuario_id)
    total = consulta.count()
    eventos = (
        consulta.order_by(Auditoria.fecha.desc(), Auditoria.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return total, eventos


def deshacer():
    db.session.rollback()
