from flask import Blueprint, request

from .dtos import (
    LoginSchema,
    RegistroUsuarioSchema,
    usuario_response
)

from .servicios import (
    iniciar_sesion,
    registrar_usuario
)


usuarios_bp = Blueprint(
    "usuarios",
    __name__
)

registro_schema = RegistroUsuarioSchema()
login_schema = LoginSchema()


@usuarios_bp.post("/registro")
def registro():

    datos = registro_schema.load(
        request.get_json()
    )

    try:

        usuario = registrar_usuario(
            datos["nombre"],
            datos["correo"],
            datos["password"]
        )

        return {
            "mensaje": "Usuario registrado correctamente",
            "usuario": usuario_response(usuario)
        }, 201

    except ValueError as error:

        return {
            "error": str(error)
        }, 400


@usuarios_bp.post("/login")
def login():

    datos = login_schema.load(
        request.get_json()
    )

    try:

        usuario, token = iniciar_sesion(
            datos["correo"],
            datos["password"]
        )

        return {
            "mensaje": "Inicio de sesión exitoso",
            "usuario": usuario_response(usuario),
            "access_token": token
        }

    except ValueError as error:

        return {
            "error": str(error)
        }, 401