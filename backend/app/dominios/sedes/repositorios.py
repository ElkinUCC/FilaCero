from app import db

from .modelos import Punto


def obtener_activos():
    return db.session.query(Punto).filter_by(activo=True).order_by(Punto.nombre.asc()).all()


def obtener_por_id(punto_id):
    return db.session.get(Punto, punto_id)
