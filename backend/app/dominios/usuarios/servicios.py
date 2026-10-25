from flask_jwt_extended import create_access_token

from app import db
from app.seguridad import encriptar_password, verificar_password
from .modelos import Usuario
from .repositorios import buscar_por_correo, guardar


def registrar_usuario(nombre, correo, password):
    if buscar_por_correo(correo):
        raise ValueError("El correo ya está registrado")

    usuario = Usuario(
        nombre=nombre,
        correo=correo,
        password_hash=encriptar_password(password),
        rol="CLIENTE",
    )
    return guardar(usuario)


def iniciar_sesion(correo, password):
    usuario = buscar_por_correo(correo)

    if not usuario:
        raise ValueError("Credenciales inválidas")

    if not usuario.activo:
        raise ValueError("El usuario está inactivo")

    if not verificar_password(password, usuario.password_hash):
        raise ValueError("Credenciales inválidas")

    token = create_access_token(
        identity=str(usuario.id),
        additional_claims={"rol": usuario.rol},
    )

    return usuario, token

def registrar_cliente_publico(nombre, celular):
    nombre = nombre.strip() if nombre else ""
    celular = celular.strip() if celular else ""

    if not nombre:
        raise ValueError("El nombre es obligatorio")

    if not celular:
        raise ValueError("El celular es obligatorio")

    from .repositorios import buscar_por_celular

    usuario = buscar_por_celular(celular)

    if usuario:
        return usuario

    usuario = Usuario(
        nombre=nombre,
        correo=f"cliente_{celular}@publico.filacero.local",
        password_hash="",
        rol="CLIENTE",
        celular=celular,
    )

    return guardar(usuario)

