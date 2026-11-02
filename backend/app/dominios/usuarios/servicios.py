import secrets
import string
from datetime import UTC, datetime, timedelta

from flask_jwt_extended import create_access_token

from app import db
from app.errores import (
    ConflictoError,
    CredencialesInvalidasError,
    CuentaBloqueadaError,
    DatosInvalidosError,
)
from app.seguridad import (
    encriptar_password,
    normalizar_celular,
    validar_password_segura,
    verificar_password,
)

from .modelos import Usuario
from .repositorios import buscar_por_celular, buscar_por_correo, guardar

ROLES_PERSONAL = ("ADMIN", "SUPERVISOR", "AGENTE")


# --- Excepciones de dominio (el app factory las traduce a HTTP) ---


class CorreoYaRegistradoError(ConflictoError):
    pass


class ClaveActualIncorrectaError(DatosInvalidosError):
    pass


# Nombre anterior, se conserva por compatibilidad.
CuentaBloqueada = CuentaBloqueadaError


def emitir_token(usuario):
    return create_access_token(
        identity=str(usuario.id),
        additional_claims={"rol": usuario.rol, "ver": usuario.version_sesion or 0},
    )


# Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe
# (evita descubrir correos registrados midiendo tiempos).
_HASH_FICTICIO = encriptar_password("filacero-tiempo-constante")


def registrar_usuario(nombre, correo, password, rol="CLIENTE", punto_id=None):
    correo = (correo or "").strip().lower()
    if buscar_por_correo(correo):
        raise CorreoYaRegistradoError("El correo ya está registrado.")
    validar_password_segura(password)

    usuario = Usuario(
        nombre=nombre.strip(),
        correo=correo,
        password_hash=encriptar_password(password),
        rol=rol,
        punto_asignado_id=punto_id,
    )
    return guardar(usuario)


def iniciar_sesion(correo, password):
    correo = (correo or "").strip().lower()
    usuario = buscar_por_correo(correo)

    from app.dominios.auditoria.servicios import registrar

    if not usuario:
        verificar_password(password, _HASH_FICTICIO)
        registrar("login_fallido", f"Correo no registrado: {correo[:80]}", usuario_id=None)
        raise CredencialesInvalidasError("Correo o contraseña incorrectos.")

    from flask import current_app

    ahora = datetime.now(UTC).replace(tzinfo=None)

    if usuario.bloqueado_hasta and usuario.bloqueado_hasta > ahora:
        minutos = int((usuario.bloqueado_hasta - ahora).total_seconds() // 60) + 1
        registrar(
            "login_bloqueado",
            f"Intento durante bloqueo ({minutos} min restantes)",
            usuario_id=usuario.id,
        )
        raise CuentaBloqueadaError(minutos)

    valida = verificar_password(password, usuario.password_hash)

    # Mismo mensaje para inactivo / contraseña errada: no revela qué falló.
    if not valida or not usuario.activo:
        motivo = "Contraseña incorrecta" if not valida else "Cuenta desactivada"
        if not valida:
            usuario.intentos_fallidos = (usuario.intentos_fallidos or 0) + 1
            if usuario.intentos_fallidos >= int(current_app.config.get("MAX_INTENTOS_LOGIN", 5)):
                bloqueo = int(current_app.config.get("MINUTOS_BLOQUEO", 15))
                usuario.bloqueado_hasta = ahora + timedelta(minutes=bloqueo)
                usuario.intentos_fallidos = 0
                motivo += f"; cuenta bloqueada {bloqueo} min"
            db.session.commit()
        registrar("login_fallido", motivo, usuario_id=usuario.id)
        raise CredencialesInvalidasError("Correo o contraseña incorrectos.")

    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None
    usuario.ultimo_acceso = ahora
    db.session.commit()
    registrar("login", usuario.rol, usuario_id=usuario.id)

    return usuario, emitir_token(usuario)


def registrar_cliente_publico(nombre, celular):
    nombre = " ".join((nombre or "").split())
    if len(nombre) < 3:
        raise DatosInvalidosError("Ingresa tu nombre completo.")
    if len(nombre) > 100:
        raise DatosInvalidosError("El nombre es demasiado largo.")

    celular = normalizar_celular(celular)
    usuario = buscar_por_celular(celular)

    if usuario:
        if usuario.nombre != nombre:
            usuario.nombre = nombre
            guardar(usuario)
        return usuario

    usuario = Usuario(
        nombre=nombre,
        correo=f"cliente_{celular}@publico.filacero.local",
        password_hash="",  # sin contraseña: nunca puede iniciar sesión
        rol="CLIENTE",
        celular=celular,
    )
    return guardar(usuario)


def generar_clave_temporal(longitud=12):
    """Contraseña aleatoria con letras y números (sin caracteres confusos)."""
    alfabeto = "".join(c for c in string.ascii_letters + string.digits if c not in "O0Il1")
    while True:
        clave = "".join(secrets.choice(alfabeto) for _ in range(longitud))
        if any(c.isdigit() for c in clave) and any(c.isalpha() for c in clave):
            return clave


def cambiar_clave_propia(usuario, actual, nueva):
    if not verificar_password(actual or "", usuario.password_hash):
        raise ClaveActualIncorrectaError("La contraseña actual no es correcta.")
    if actual == nueva:
        raise DatosInvalidosError("La nueva contraseña debe ser distinta a la actual.")
    validar_password_segura(nueva)
    usuario.password_hash = encriptar_password(nueva)
    usuario.debe_cambiar_clave = False
    usuario.revocar_sesiones()  # cierra las demás sesiones abiertas
    db.session.commit()
    return usuario
