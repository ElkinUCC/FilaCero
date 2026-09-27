from app import db
from .modelos import Turno


def guardar(turno):
    db.session.add(turno)
    db.session.commit()
    return turno


def obtener_por_usuario(usuario_id):
    return Turno.query.filter_by(
        usuario_id=usuario_id
    ).order_by(Turno.hora_solicitud.desc()).all()


def obtener_por_id(turno_id):
    return Turno.query.get(turno_id)