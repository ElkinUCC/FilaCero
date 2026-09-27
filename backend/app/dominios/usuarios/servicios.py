from flask_jwt_extended import create_access_token

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
        rol="CLIENTE"
    )

    return guardar(usuario)


def iniciar_sesion(correo, password):

    usuario = buscar_por_correo(correo)

    if not usuario:
        raise ValueError("Credenciales inválidas")

    if not usuario.activo:
        raise ValueError("El usuario está inactivo")

    if not verificar_password(
        password,
        usuario.password_hash
    ):
        raise ValueError("Credenciales inválidas")

    token = create_access_token(
        identity=str(usuario.id),
        additional_claims={
            "rol": usuario.rol
        }
    )

    return usuario, token