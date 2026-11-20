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
    NoEncontradoError,
)
from app.seguridad import (
    encriptar_password,
    normalizar_celular,
    validar_password_segura,
    verificar_password,
)

from .modelos import Usuario
from .repositorios import buscar_por_celular, buscar_por_correo, buscar_por_id, guardar

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
        additional_claims={
            "rol": usuario.rol,
            "ver": usuario.version_sesion or 0,
            # El tenant queda firmado en el JWT; nunca se toma del body del cliente.
            "org_id": usuario.organizacion_id,
        },
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
    if usuario.rol == "AGENTE":
        # Al ingresar, el asesor queda disponible para atender.
        usuario.presencia = "DISPONIBLE"
        usuario.presencia_desde = ahora
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


# ---------------------------------------------------------------------
# Módulo de atención y baja definitiva del personal
# ---------------------------------------------------------------------

MODULO_MAX = 40


def normalizar_modulo(valor):
    """'  módulo   2 ' -> 'módulo 2'. Vacío -> None (sin módulo)."""
    modulo = " ".join(str(valor or "").split())
    if not modulo:
        return None
    if len(modulo) > MODULO_MAX:
        raise DatosInvalidosError(f"El módulo admite máximo {MODULO_MAX} caracteres.")
    return modulo


def modulo_ocupado(modulo, punto_id, excluir_id=None):
    """Otro asesor activo de la misma sede ya usa ese módulo."""
    if not modulo or not punto_id:
        return None
    consulta = Usuario.query.filter(
        Usuario.rol == "AGENTE",
        Usuario.activo.is_(True),
        Usuario.eliminado_en.is_(None),
        Usuario.punto_asignado_id == punto_id,
        db.func.lower(Usuario.modulo) == modulo.lower(),
    )
    if excluir_id:
        consulta = consulta.filter(Usuario.id != excluir_id)
    return consulta.first()


def asignar_modulo(usuario, modulo):
    """Valida y asigna el módulo; dos asesores de una sede no lo comparten."""
    modulo = normalizar_modulo(modulo)
    otro = modulo_ocupado(modulo, usuario.punto_asignado_id, excluir_id=usuario.id)
    if otro:
        raise ConflictoError(f"{modulo} ya está asignado a {otro.nombre} en esa sede.")
    usuario.modulo = modulo
    return usuario


def liberar_modulo_si_choca(usuario):
    """Tras un cambio de sede, suelta el módulo si allá ya lo usa otro asesor."""
    if modulo_ocupado(usuario.modulo, usuario.punto_asignado_id, excluir_id=usuario.id):
        usuario.modulo = None
    return usuario


def dar_de_baja(usuario_id, actor_id, roles=ROLES_PERSONAL):
    """Elimina una cuenta del personal conservando su historial (baja lógica).

    La cuenta deja de aparecer en los listados, no puede volver a ingresar y
    su correo queda libre para crear una cuenta nueva. Los turnos que atendió
    y su bitácora siguen apuntando a ella: los indicadores no cambian.
    Devuelve (usuario, correo_original).
    """
    from app.dominios.turnos.modelos import Turno

    usuario = db.session.get(Usuario, usuario_id)
    if not usuario or usuario.rol not in roles or usuario.eliminado:
        raise NoEncontradoError("La cuenta no existe o ya fue eliminada.")
    if usuario.id == actor_id:
        raise ConflictoError("No puedes eliminar tu propia cuenta.")
    if usuario.protegida:
        raise ConflictoError("Cuenta protegida: no se puede eliminar.")
    if usuario.rol == "ADMIN":
        otros = Usuario.query.filter(
            Usuario.rol == "ADMIN",
            Usuario.activo.is_(True),
            Usuario.eliminado_en.is_(None),
            Usuario.id != usuario.id,
        ).count()
        if otros == 0:
            raise ConflictoError("Debe quedar al menos un administrador activo.")
    en_curso = Turno.query.filter(
        Turno.agente_id == usuario.id, Turno.estado.in_(("LLAMADO", "EN_ATENCION"))
    ).first()
    if en_curso:
        raise ConflictoError(
            "Tiene un turno en curso. Espera a que lo finalice o devuélvelo a la cola."
        )

    correo_original = usuario.correo
    usuario.activo = False
    usuario.eliminado_en = datetime.now(UTC).replace(tzinfo=None)
    usuario.punto_asignado_id = None
    usuario.modulo = None
    usuario.correo = f"baja-{usuario.id}-{secrets.token_hex(4)}@eliminado.filacero.local"
    usuario.password_hash = encriptar_password(secrets.token_urlsafe(32))
    usuario.debe_cambiar_clave = False
    usuario.revocar_sesiones()
    db.session.commit()
    return usuario, correo_original


# ---------------------------------------------------------------------
# Presencia del asesor (lo que está haciendo cuando no atiende)
# ---------------------------------------------------------------------

PRESENCIAS = {
    "DISPONIBLE": "Disponible",
    "PAUSA": "En pausa",
    "ALMUERZO": "En almuerzo",
    "AUSENTE": "Fuera de turno",
}


def cambiar_presencia(usuario, presencia, tiene_turno_en_curso=False):
    presencia = str(presencia or "").upper()
    if presencia not in PRESENCIAS:
        raise DatosInvalidosError("Estado no válido.")
    if presencia != "DISPONIBLE" and tiene_turno_en_curso:
        raise ConflictoError("Termina o devuelve el turno en curso antes de salir a pausa.")
    if usuario.presencia != presencia:
        usuario.presencia = presencia
        usuario.presencia_desde = datetime.now(UTC).replace(tzinfo=None, microsecond=0)
        db.session.commit()
    return usuario


# ---------------------------------------------------------------------
# Cédula del cliente (para dejar y recoger equipos)
# ---------------------------------------------------------------------


def normalizar_documento(valor):
    """Cédula colombiana: solo dígitos, entre 6 y 12."""
    import re

    digitos = re.sub(r"\D", "", str(valor or ""))
    if not 6 <= len(digitos) <= 12:
        raise DatosInvalidosError("Escribe la cédula del cliente (entre 6 y 12 dígitos).")
    return digitos


def documento_enmascarado(documento):
    """La cédula nunca viaja completa a la interfaz: solo los últimos 4 dígitos."""
    return f"···{documento[-4:]}" if documento else None


def verificar_o_asignar_documento(cliente, valor):
    """Si el cliente ya tiene cédula, debe coincidir; si no, se registra."""
    documento = normalizar_documento(valor)
    if cliente.documento and cliente.documento != documento:
        raise ConflictoError("La cédula no coincide con la registrada para este cliente.")
    if not cliente.documento:
        cliente.documento = documento
    return documento


def revocar_todas_las_sesiones(usuario):
    """Cierre de sesión: invalida todos sus tokens; el asesor queda "fuera de turno"."""
    usuario.revocar_sesiones()
    if usuario.rol == "AGENTE":
        usuario.presencia = "AUSENTE"
        usuario.presencia_desde = datetime.now(UTC).replace(tzinfo=None)
    db.session.commit()


# ----------------------------------------------------------------------
# Consultas para la capa de presentación (ADR-017: controlador → servicio → repositorio)
# ----------------------------------------------------------------------


def obtener_usuario(usuario_id):
    """Usuario por id dentro de la organización activa (o None)."""
    return buscar_por_id(usuario_id)


def cliente_por_celular(celular):
    """Cliente público registrado con ese celular (o None)."""
    return buscar_por_celular(celular)
