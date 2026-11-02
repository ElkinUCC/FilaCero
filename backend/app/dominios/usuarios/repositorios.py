from app import db

from .modelos import Usuario


def buscar_por_correo(correo):
    return Usuario.query.filter_by(correo=(correo or "").strip().lower()).first()


def buscar_por_celular(celular):
    return (
        Usuario.query.filter_by(celular=celular, rol="CLIENTE").order_by(Usuario.id.asc()).first()
    )


def buscar_por_id(usuario_id):
    return db.session.get(Usuario, usuario_id)


def guardar(usuario):
    db.session.add(usuario)
    db.session.commit()
    return usuario
