from .modelos import Tramite


def obtener_activos():
    return Tramite.query.filter_by(activo=True).all()


def obtener_por_id(tramite_id):
    return Tramite.query.get(tramite_id)