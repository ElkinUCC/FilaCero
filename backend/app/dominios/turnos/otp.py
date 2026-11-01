"""Verificación del celular con código de un solo uso.

Almacén en memoria (una instancia). En producción conecte un proveedor SMS
en `_enviar_sms` y, si hay varias instancias, guarde los códigos en Redis.
"""
import hmac
import secrets
import threading
import time

from flask import current_app

_codigos = {}
_candado = threading.Lock()


def _enviar_sms(celular, codigo):  # pragma: no cover - integración futura
    raise RuntimeError("Proveedor SMS no configurado.")


def generar_codigo(celular):
    config = current_app.config
    codigo = f"{secrets.randbelow(1_000_000):06d}"
    with _candado:
        _codigos[celular] = {
            "codigo": codigo,
            "expira": time.monotonic() + int(config.get("OTP_VIGENCIA_SEG", 300)),
            "intentos": 0,
        }

    if not config.get("OTP_TEST_MODE"):
        _enviar_sms(celular, codigo)
        return None
    return codigo


def verificar_codigo(celular, codigo):
    maximo = int(current_app.config.get("OTP_MAX_INTENTOS", 5))
    with _candado:
        registro = _codigos.get(celular)
        if not registro:
            raise ValueError("Solicita un código de verificación primero.")
        if time.monotonic() > registro["expira"]:
            _codigos.pop(celular, None)
            raise ValueError("El código expiró. Solicita uno nuevo.")
        if registro["intentos"] >= maximo:
            _codigos.pop(celular, None)
            raise ValueError("Superaste el número de intentos. Solicita un código nuevo.")

        registro["intentos"] += 1
        if not hmac.compare_digest(registro["codigo"], str(codigo)):
            restantes = maximo - registro["intentos"]
            raise ValueError(f"Código incorrecto. Te quedan {restantes} intento(s).")

        _codigos.pop(celular, None)
        return True


def reiniciar():
    with _candado:
        _codigos.clear()
