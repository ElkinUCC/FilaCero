from functools import wraps

from flask import jsonify
from flask_jwt_extended import (
    get_jwt,
    verify_jwt_in_request
)
from werkzeug.security import (
    check_password_hash,
    generate_password_hash
)


def encriptar_password(password):
    return generate_password_hash(password)


def verificar_password(password, password_hash):
    return check_password_hash(
        password_hash,
        password
    )


def requiere_token(func):

    @wraps(func)
    def wrapper(*args, **kwargs):

        verify_jwt_in_request()

        return func(*args, **kwargs)

    return wrapper


def requiere_rol(*roles):

    def decorator(func):

        @wraps(func)
        def wrapper(*args, **kwargs):

            verify_jwt_in_request()

            claims = get_jwt()
            rol = claims.get("rol")

            if rol not in roles:

                return jsonify({
                    "error": "No tienes permisos para realizar esta acción"
                }), 403

            return func(*args, **kwargs)

        return wrapper

    return decorator