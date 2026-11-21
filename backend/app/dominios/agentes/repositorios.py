"""Acceso a datos del dominio de atención (consola del asesor y panel administrativo)."""

from sqlalchemy import func

from app import db
from app.dominios.turnos.repositorios import consulta_cola

from .modelos import Franja, Punto, Tramite, Turno, Usuario

ESTADOS_EN_CURSO = ("LLAMADO", "EN_ATENCION")


# Asesores


def obtener_agente(usuario_id):
    """Asesor activo (puede atender)."""
    return Usuario.query.filter_by(id=usuario_id, rol="AGENTE", activo=True).first()


def obtener_agente_vigente(usuario_id):
    """Asesor no eliminado (activo o inactivo): el que se puede editar en el panel."""
    return Usuario.query.filter(
        Usuario.id == usuario_id, Usuario.rol == "AGENTE", Usuario.eliminado_en.is_(None)
    ).first()


def obtener_agente_cualquiera(usuario_id):
    return Usuario.query.filter_by(id=usuario_id, rol="AGENTE").first()


def obtener_usuario(usuario_id):
    return db.session.get(Usuario, usuario_id)


def listar_agentes_vigentes():
    return (
        Usuario.query.filter(Usuario.rol == "AGENTE", Usuario.eliminado_en.is_(None))
        .order_by(Usuario.nombre.asc())
        .all()
    )


def contar_agentes_activos():
    return Usuario.query.filter_by(rol="AGENTE", activo=True).count()


def asesores_activos_de_sede(punto_id):
    return Usuario.query.filter_by(rol="AGENTE", activo=True, punto_asignado_id=punto_id).all()


# Sedes


def obtener_sede(punto_id):
    return db.session.get(Punto, punto_id)


def sedes_activas():
    return Punto.query.filter_by(activo=True).order_by(Punto.nombre).all()


# Turnos de la consola


def obtener_cola(punto_id):
    return consulta_cola(punto_id).all()


def obtener_siguiente_bloqueado(punto_id):
    return consulta_cola(punto_id).with_for_update().first()


def obtener_turno_bloqueado(turno_id):
    return Turno.query.filter_by(id=turno_id).with_for_update().first()


def obtener_turno_activo(agente_id):
    """Turno que el asesor tiene llamado o en atención (como máximo uno)."""
    return (
        Turno.query.filter(Turno.agente_id == agente_id, Turno.estado.in_(ESTADOS_EN_CURSO))
        .order_by(Turno.id.desc())
        .first()
    )


def turnos_cerrados_del_agente(agente_id, desde_utc, hasta_utc):
    """Turnos que el asesor cerró (atendido o no asistió) en el rango UTC dado."""
    return Turno.query.filter(
        Turno.agente_id == agente_id,
        Turno.fecha_fin >= desde_utc,
        Turno.fecha_fin < hasta_utc,
    ).all()


def turnos_recientes(limite=8):
    return Turno.query.order_by(Turno.hora_solicitud.desc(), Turno.id.desc()).limit(limite).all()


# Turnos del panel administrativo (historial y métricas)


def consulta_turnos_admin(filtros):
    """Consulta base del historial y las métricas con los filtros ya validados."""
    consulta = Turno.query.join(Franja, Turno.franja_id == Franja.id)
    if filtros.desde:
        consulta = consulta.filter(Franja.fecha >= filtros.desde)
    if filtros.hasta:
        consulta = consulta.filter(Franja.fecha <= filtros.hasta)
    if filtros.punto_id:
        consulta = consulta.filter(Turno.punto_id == filtros.punto_id)
    if filtros.tramite_id:
        consulta = consulta.filter(Turno.tramite_id == filtros.tramite_id)
    if filtros.estado:
        consulta = consulta.filter(Turno.estado == filtros.estado)
    if filtros.buscar:
        patron = f"%{filtros.buscar}%"
        consulta = consulta.join(Usuario, Turno.usuario_id == Usuario.id).filter(
            db.or_(
                Turno.codigo.ilike(patron),
                Usuario.nombre.ilike(patron),
                Usuario.celular.ilike(patron),
            )
        )
    return consulta


def con_franja_cargada(consulta):
    """La franja ya viene en el JOIN: se carga en la misma consulta (sin N+1)."""
    from sqlalchemy.orm import contains_eager

    return consulta.options(contains_eager(Turno.franja))


def solo_hasta(consulta, ahora):
    """Excluye citas futuras: el historial muestra lo que ya ocurrió o está ocurriendo."""
    return consulta.filter(
        db.or_(
            Franja.fecha < ahora.date(),
            db.and_(Franja.fecha == ahora.date(), Franja.hora_inicio <= ahora.time()),
        )
    )


def paginar_historial(consulta, pagina, por_pagina):
    total = consulta.count()
    turnos = (
        consulta.order_by(Franja.fecha.desc(), Franja.hora_inicio.desc(), Turno.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return total, turnos


def totales_por_sede(consulta):
    return (
        consulta.join(Punto, Turno.punto_id == Punto.id)
        .with_entities(
            Turno.punto_id,
            Punto.nombre,
            func.count(Turno.id).label("total"),
            func.sum(db.case((Turno.estado == "ESPERANDO", 1), else_=0)).label("espera"),
            func.sum(db.case((Turno.estado == "ATENDIDO", 1), else_=0)).label("atendidos"),
        )
        .group_by(Turno.punto_id, Punto.nombre)
        .order_by(func.count(Turno.id).desc())
        .all()
    )


def totales_por_tramite(consulta):
    return (
        consulta.join(Tramite, Turno.tramite_id == Tramite.id)
        .with_entities(Turno.tramite_id, Tramite.nombre, func.count(Turno.id).label("total"))
        .group_by(Turno.tramite_id, Tramite.nombre)
        .order_by(func.count(Turno.id).desc())
        .all()
    )


def confirmar():
    db.session.commit()


def deshacer():
    db.session.rollback()
