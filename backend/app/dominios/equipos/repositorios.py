from app import db
from app.dominios.usuarios.modelos import Usuario

from .modelos import Equipo


def obtener(equipo_id):
    return db.session.get(Equipo, equipo_id)


def por_cliente(cliente_id):
    return (
        Equipo.query.filter_by(cliente_id=cliente_id)
        .order_by(Equipo.fecha_actualizacion.desc())
        .all()
    )


def por_sede(punto_id=None, estado=None, buscar=None, limite=200):
    consulta = Equipo.query.join(Usuario, Equipo.cliente_id == Usuario.id)
    if punto_id:
        consulta = consulta.filter(Equipo.punto_id == punto_id)
    if estado:
        consulta = consulta.filter(Equipo.estado == estado)
    if buscar:
        patron = f"%{buscar[:40]}%"
        consulta = consulta.filter(
            db.or_(
                Equipo.codigo.ilike(patron),
                Equipo.marca.ilike(patron),
                Equipo.serial.ilike(patron),
                Usuario.nombre.ilike(patron),
                Usuario.celular.ilike(patron),
            )
        )
    return consulta.order_by(Equipo.fecha_actualizacion.desc()).limit(limite).all()


def existe_codigo(codigo):
    return Equipo.query.filter_by(codigo=codigo).first() is not None
