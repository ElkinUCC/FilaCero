"""Errores de dominio y formato uniforme de respuesta.

Los servicios lanzan excepciones con nombre de negocio (``SedeNoEncontradaError``,
``CredencialesInvalidasError``...) y **no** conocen HTTP. El app factory registra un
manejador global que traduce cada excepción a su código HTTP y al formato de error
del contrato:

    {"success": false, "error": "<mensaje legible>", "detalles": {...}}

Todas heredan de ``ValueError`` para que el código que ya atrapaba ``ValueError``
siga funcionando igual (compatibilidad hacia atrás).
"""

from flask import jsonify


class ErrorDeDominio(ValueError):
    """Base de todos los errores de negocio. Por defecto: 400."""

    codigo_http = 400

    def __init__(self, mensaje="Solicitud inválida.", detalles=None):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.detalles = detalles


class DatosInvalidosError(ErrorDeDominio):
    """Los datos enviados no cumplen las reglas del negocio."""

    codigo_http = 400


class CredencialesInvalidasError(ErrorDeDominio):
    """Correo o contraseña incorrectos."""

    codigo_http = 401


class PermisoDenegadoError(ErrorDeDominio):
    """El usuario está autenticado pero su rol no le permite la acción."""

    codigo_http = 403


class NoEncontradoError(ErrorDeDominio):
    """El recurso pedido no existe."""

    codigo_http = 404


class ConflictoError(ErrorDeDominio):
    """El recurso ya existe o choca con el estado actual (nombre repetido, sin cupo...)."""

    codigo_http = 409


class CuentaBloqueadaError(ErrorDeDominio):
    """Demasiados intentos fallidos: la cuenta queda bloqueada unos minutos."""

    codigo_http = 429

    def __init__(self, minutos):
        self.minutos = minutos
        super().__init__(
            f"Cuenta bloqueada por intentos fallidos. Intenta de nuevo en {minutos} min."
        )


def respuesta_error(mensaje, codigo, detalles=None):
    """Cuerpo de error del contrato (ver docs/CONTRATO-BACKEND-FRONTEND.md)."""
    cuerpo = {"success": False, "error": mensaje}
    if detalles:
        cuerpo["detalles"] = detalles
    return jsonify(cuerpo), codigo


def registrar_manejadores_de_dominio(app):
    """Un único manejador para toda la jerarquía (equivale a los errorhandler
    por excepción del proyecto de referencia, sin repetir código)."""

    @app.errorhandler(ErrorDeDominio)
    def error_de_dominio(error):
        return respuesta_error(error.mensaje, error.codigo_http, error.detalles)
