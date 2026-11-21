import re
import threading
import time
from collections import defaultdict, deque
from functools import wraps

from flask import current_app, jsonify, request
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from werkzeug.security import check_password_hash, generate_password_hash

from app.errores import DatosInvalidosError

# Contraseñas


def encriptar_password(password):
    return generate_password_hash(password)


def verificar_password(password, password_hash):
    # Los clientes públicos no tienen contraseña: nunca pueden iniciar sesión.
    if not password_hash or not password:
        return False
    try:
        return check_password_hash(password_hash, password)
    except (ValueError, TypeError):
        return False


def validar_password_segura(password):
    """Mínimo 8 caracteres, con letras y números."""
    if not isinstance(password, str) or len(password) < 8:
        raise DatosInvalidosError("La contraseña debe tener al menos 8 caracteres.")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise DatosInvalidosError("La contraseña debe combinar letras y números.")


# Celular (Colombia: 10 dígitos que inician en 3)


def normalizar_celular(valor):
    digitos = re.sub(r"\D", "", str(valor or ""))
    if digitos.startswith("57") and len(digitos) == 12:
        digitos = digitos[2:]
    if not re.fullmatch(r"3\d{9}", digitos):
        raise DatosInvalidosError("Ingresa un celular válido de 10 dígitos (ej. 3001234567).")
    return digitos


def enmascarar_celular(celular):
    if not celular:
        return None
    return f"{celular[:3]}****{celular[-3:]}"


# Autorización


def requiere_token(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        return func(*args, **kwargs)

    return wrapper


def usuario_autenticado():
    """Usuario del token, validado contra la base de datos (activo y rol vigente)."""
    from flask_jwt_extended import current_user

    usuario = current_user
    if usuario is None or not usuario.activo:
        return None
    return usuario


def requiere_rol(*roles):
    """Verifica JWT y que el rol ACTUAL en base de datos esté permitido."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return current_app.make_default_options_response()
            verify_jwt_in_request()
            usuario = usuario_autenticado()
            if usuario is None:
                return jsonify({"error": "Sesión inválida. Inicia sesión de nuevo."}), 401
            if usuario.rol not in roles or get_jwt().get("rol") not in roles:
                return jsonify({"error": "No tienes permisos para realizar esta acción."}), 403
            if getattr(usuario, "debe_cambiar_clave", False):
                return (
                    jsonify(
                        {
                            "error": "Debes cambiar tu contraseña temporal antes de continuar.",
                            "codigo": "CAMBIAR_CLAVE",
                        }
                    ),
                    403,
                )
            return func(*args, **kwargs)

        return wrapper

    return decorator


# Límite de peticiones en memoria (ventana deslizante por IP)

_registros = defaultdict(deque)
_candado = threading.Lock()


def _ip_cliente():
    return request.remote_addr or "desconocida"


def limitar(clave_config, ventana_seg=60, por="ip"):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            config = current_app.config
            if not config.get("RATE_LIMIT_ACTIVO", True) or config.get("TESTING"):
                return func(*args, **kwargs)

            limite = int(config.get(clave_config, 30))
            llave = (func.__name__, _ip_cliente())
            ahora = time.monotonic()

            with _candado:
                cola = _registros[llave]
                while cola and ahora - cola[0] > ventana_seg:
                    cola.popleft()
                if len(cola) >= limite:
                    espera = int(ventana_seg - (ahora - cola[0])) + 1
                    respuesta = jsonify(
                        {"error": f"Demasiados intentos. Intenta de nuevo en {espera} segundos."}
                    )
                    respuesta.status_code = 429
                    respuesta.headers["Retry-After"] = str(espera)
                    return respuesta
                cola.append(ahora)

            return func(*args, **kwargs)

        return wrapper

    return decorator


def reiniciar_limites():
    with _candado:
        _registros.clear()
