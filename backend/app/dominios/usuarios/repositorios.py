"""Acceso a datos de las cuentas (personal y ciudadanos)."""

from app import db

from .modelos import Usuario

ROLES_DEL_PERSONAL = ("ADMIN", "SUPERVISOR", "AGENTE")


def buscar_por_correo(correo):
    return Usuario.query.filter_by(correo=(correo or "").strip().lower()).first()


def buscar_por_celular(celular):
    return (
        Usuario.query.filter_by(celular=celular, rol="CLIENTE").order_by(Usuario.id.asc()).first()
    )


def buscar_por_id(usuario_id):
    return db.session.get(Usuario, usuario_id)


def buscar_personal_vigente(usuario_id):
    """Cuenta del personal no eliminada (las eliminadas no se pueden editar)."""
    return Usuario.query.filter(
        Usuario.id == usuario_id,
        Usuario.rol.in_(ROLES_DEL_PERSONAL),
        Usuario.eliminado_en.is_(None),
    ).first()


def listar_personal_vigente():
    return (
        Usuario.query.filter(Usuario.rol.in_(ROLES_DEL_PERSONAL), Usuario.eliminado_en.is_(None))
        .order_by(Usuario.rol.asc(), Usuario.nombre.asc())
        .all()
    )


def contar_admins_activos(excluir_id=None):
    consulta = Usuario.query.filter_by(rol="ADMIN", activo=True)
    if excluir_id:
        consulta = consulta.filter(Usuario.id != excluir_id)
    return consulta.count()


def guardar(usuario):
    db.session.add(usuario)
    db.session.commit()
    return usuario


def confirmar():
    db.session.commit()


def deshacer():
    db.session.rollback()
