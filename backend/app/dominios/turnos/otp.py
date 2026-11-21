"""Verificación del celular con código de un solo uso."""

import hmac
import secrets
import threading
import time

from flask import current_app, request

_codigos = {}
_candado = threading.Lock()


def _enviar_sms(celular, codigo):  # pragma: no cover - integración futura
    raise RuntimeError("Proveedor SMS no configurado.")


def generar_codigo(celular, organizacion_id=1):
    config = current_app.config
    # Modo prueba: solo para peticiones desde el mismo equipo (localhost).
    modo_prueba = config.get("OTP_TEST_MODE") and request.remote_addr in ("127.0.0.1", "::1")
    codigo = f"{secrets.randbelow(1_000_000):06d}"

    with _candado:
        _codigos[(int(organizacion_id), celular)] = {
            "codigo": codigo,
            "expira": time.monotonic() + int(config.get("OTP_VIGENCIA_SEG", 300)),
            "intentos": 0,
        }

    if not modo_prueba:
        _enviar_sms(celular, codigo)
        return None
    return codigo


def verificar_codigo(celular, codigo, organizacion_id=1):
    maximo = int(current_app.config.get("OTP_MAX_INTENTOS", 5))
    with _candado:
        clave = (int(organizacion_id), celular)
        registro = _codigos.get(clave)
        if not registro:
            raise ValueError("Solicita un código de verificación primero.")
        if time.monotonic() > registro["expira"]:
            _codigos.pop(clave, None)
            raise ValueError("El código expiró. Solicita uno nuevo.")
        if registro["intentos"] >= maximo:
            _codigos.pop(clave, None)
            raise ValueError("Superaste el número de intentos. Solicita un código nuevo.")

        registro["intentos"] += 1
        if not hmac.compare_digest(registro["codigo"], str(codigo)):
            restantes = maximo - registro["intentos"]
            raise ValueError(f"Código incorrecto. Te quedan {restantes} intento(s).")

        _codigos.pop(clave, None)
        return True


def reiniciar():
    with _candado:
        _codigos.clear()


# Identidad del ciudadano a partir de su celular verificado
VIGENCIA_TOKEN_SEG = 15 * 60


def celular_del_token(datos, propositos=("reserva", "consulta_celular")):
    """Devuelve el celular de un token de verificación válido."""
    from flask import g
    from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

    from app.seguridad import normalizar_celular

    celular = normalizar_celular(datos.get("celular"))
    token = str(datos.get("token_verificacion", "")).strip()
    if not token:
        raise ValueError("Verifica tu celular para continuar.")
    serializador = URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"], salt="filacero-verificacion-celular"
    )
    try:
        datos_token = serializador.loads(token, max_age=VIGENCIA_TOKEN_SEG)
    except SignatureExpired:
        raise ValueError("La verificación expiró. Verifica tu celular nuevamente.") from None
    except BadSignature:
        raise ValueError("La verificación del celular no es válida.") from None
    if datos_token.get("org_id") != getattr(g, "organizacion_id", 1):
        raise ValueError("La verificación no corresponde a esta organización.")
    if datos_token.get("proposito", "reserva") not in propositos:
        raise ValueError("Verifica tu celular para esta operación.")
    if datos_token.get("celular") != celular:
        raise ValueError("El celular verificado no coincide.")
    return celular
