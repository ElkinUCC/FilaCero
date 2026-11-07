from app import db

from .modelos import Reclamo


def obtener(reclamo_id):
    return db.session.get(Reclamo, reclamo_id)


def por_cliente(cliente_id, limite=10):
    return (
        Reclamo.query.filter_by(cliente_id=cliente_id)
        .order_by(Reclamo.fecha_creacion.desc())
        .limit(limite)
        .all()
    )


def por_sede(punto_id=None, estado=None, limite=200):
    consulta = Reclamo.query
    if punto_id:
        consulta = consulta.filter(Reclamo.punto_id == punto_id)
    if estado:
        consulta = consulta.filter(Reclamo.estado == estado)
    return consulta.order_by(Reclamo.fecha_creacion.desc()).limit(limite).all()


def existe_radicado(radicado):
    return Reclamo.query.filter_by(radicado=radicado).first() is not None


def por_radicado(radicado):
    return Reclamo.query.filter_by(radicado=str(radicado or "").strip().upper()).first()
