from app import db
from app.dominios.franjas.modelos import Franja
from app.horario import _config_operativa, hoy_local

from .modelos import Turno

ESTADOS = ("ESPERANDO", "LLAMADO", "EN_ATENCION", "ATENDIDO", "CANCELADO", "NO_ASISTIO")
ESTADOS_ACTIVOS = ("ESPERANDO", "LLAMADO", "EN_ATENCION")


def guardar(turno):
    db.session.add(turno)
    db.session.commit()
    return turno


def obtener_por_usuario(usuario_id):
    return Turno.query.filter_by(usuario_id=usuario_id).order_by(Turno.hora_solicitud.desc()).all()


def obtener_por_id(turno_id):
    return db.session.get(Turno, turno_id)


def obtener_por_codigo(codigo):
    return Turno.query.filter_by(codigo=(codigo or "").strip().upper()).first()


def obtener_por_celular(celular, limite=10):
    """Turnos recientes asociados al celular, dentro de la organización activa."""
    from app.dominios.usuarios.modelos import Usuario

    return (
        Turno.query.join(Usuario, Turno.usuario_id == Usuario.id)
        .filter(Usuario.celular == celular)
        .order_by(Turno.hora_solicitud.desc(), Turno.id.desc())
        .limit(limite)
        .all()
    )


def consulta_cola(punto_id):
    """Turnos en espera de una sede, desde hoy, en orden de la hora de su franja."""
    return (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(
            Turno.punto_id == punto_id,
            Turno.estado == "ESPERANDO",
            (
                Franja.fecha == hoy_local()
                if _config_operativa("COLA_SOLO_HOY", False)
                else Franja.fecha >= hoy_local()
            ),
        )
        .order_by(
            Franja.fecha.asc(),
            Franja.hora_inicio.asc(),
            Turno.hora_solicitud.asc(),
            Turno.id.asc(),
        )
    )


def posicion_en_cola(turno):
    """Cuántos turnos en espera hay antes de este en la misma sede."""
    if turno.estado != "ESPERANDO":
        return 0
    ids = [t.id for t in consulta_cola(turno.punto_id).with_entities(Turno.id).all()]
    return ids.index(turno.id) if turno.id in ids else 0
