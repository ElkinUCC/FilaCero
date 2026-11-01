from app import db
from .modelos import Tramite


def obtener_activos():
    return Tramite.query.filter_by(activo=True).all()


def obtener_por_id(tramite_id):
    return db.session.get(Tramite, tramite_id)
