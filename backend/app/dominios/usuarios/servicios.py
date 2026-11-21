import secrets
import string
from datetime import timedelta

from flask_jwt_extended import create_access_token

from app import db
from app.dominios.sedes.repositorios import obtener_por_id as obtener_sede
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
from app.tiempo import ahora_bd

from . import repositorios as repo
from .modelos import Usuario
from .repositorios import buscar_por_celular, buscar_por_correo, buscar_por_id, guardar

ROLES_PERSONAL = ("ADMIN", "SUPERVISOR", "AGENTE")


# Excepciones de dominio (el app factory las traduce a HTTP)


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

    ahora = ahora_bd()

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


# Módulo de atención y baja definitiva del personal

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
    """Elimina una cuenta del personal conservando su historial (baja lógica)."""
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
    usuario.eliminado_en = ahora_bd()
    usuario.punto_asignado_id = None
    usuario.modulo = None
    usuario.correo = f"baja-{usuario.id}-{secrets.token_hex(4)}@eliminado.filacero.local"
    usuario.password_hash = encriptar_password(secrets.token_urlsafe(32))
    usuario.debe_cambiar_clave = False
    usuario.revocar_sesiones()
    db.session.commit()
    return usuario, correo_original


# Presencia del asesor (lo que está haciendo cuando no atiende)

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
        usuario.presencia_desde = ahora_bd(microsegundos=False)
        db.session.commit()
    return usuario


# Cédula del cliente (para dejar y recoger equipos)


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
        usuario.presencia_desde = ahora_bd()
    db.session.commit()


# Consultas para la capa de presentación (ADR-017: controlador → servicio → repositorio)


def obtener_usuario(usuario_id):
    """Usuario por id dentro de la organización activa (o None)."""
    return buscar_por_id(usuario_id)


def cliente_por_celular(celular):
    """Cliente público registrado con ese celular (o None)."""
    return buscar_por_celular(celular)


# Administración de cuentas del personal


ROLES = {"ADMIN": "Administrador", "SUPERVISOR": "Supervisor", "AGENTE": "Asesor"}


def _nombre(valor):
    nombre = " ".join(str(valor or "").split())
    if not 3 <= len(nombre) <= 100:
        raise DatosInvalidosError("El nombre debe tener entre 3 y 100 caracteres.")
    return nombre


def _correo(valor, excluir_id=None):
    correo = str(valor or "").strip().lower()
    if "@" not in correo or "." not in correo.split("@")[-1] or len(correo) > 120:
        raise DatosInvalidosError("Ingresa un correo válido.")
    if correo.endswith("@publico.filacero.local"):
        raise DatosInvalidosError("Ese dominio está reservado.")
    existente = repo.buscar_por_correo(correo)
    if existente and existente.id != excluir_id:
        raise DatosInvalidosError("Ya existe una cuenta con ese correo.")
    return correo


def _rol(valor):
    if valor not in ROLES:
        raise DatosInvalidosError("Rol no válido.")
    return valor


def _sede(valor):
    if valor in (None, ""):
        return None
    try:
        punto = obtener_sede(int(valor))
    except (TypeError, ValueError):
        raise DatosInvalidosError("Sede no válida.") from None
    if not punto or not punto.activo:
        raise DatosInvalidosError("La sede no existe o está inactiva.")
    return punto.id


def listar_personal():
    return repo.listar_personal_vigente()


def obtener_personal(usuario_id):
    usuario = repo.buscar_personal_vigente(usuario_id)
    if not usuario:
        raise NoEncontradoError("Usuario no encontrado.")
    return usuario


def crear_personal(datos):
    """Crea la cuenta."""
    try:
        rol = _rol(datos.get("rol"))
        usuario = Usuario(
            nombre=_nombre(datos.get("nombre")),
            correo=_correo(datos.get("correo")),
            rol=rol,
            activo=True,
            punto_asignado_id=_sede(datos.get("punto_id")) if rol == "AGENTE" else None,
        )
        clave = datos.get("password") or None
        temporal = clave is None
        if temporal:
            clave = generar_clave_temporal()
        validar_password_segura(clave)
        usuario.password_hash = encriptar_password(clave)
        usuario.debe_cambiar_clave = temporal
        repo.guardar(usuario)
    except ValueError:
        repo.deshacer()
        raise
    return usuario, (clave if temporal else None)


def editar_personal(usuario_id, datos, actor_id):
    """Aplica los cambios permitidos. Devuelve (usuario, cambios, eventos)."""
    usuario = obtener_personal(usuario_id)
    es_yo = usuario.id == actor_id
    if usuario.protegida and (
        ("activo" in datos and not datos["activo"])
        or ("rol" in datos and datos["rol"] != usuario.rol)
        or ("correo" in datos and str(datos["correo"]).strip().lower() != usuario.correo)
    ):
        raise ConflictoError("Cuenta protegida: no se puede desactivar ni cambiar su rol o correo.")

    cambios = []
    eventos = []  # se registran solo si todo el cambio se guarda
    try:
        if "nombre" in datos:
            usuario.nombre = _nombre(datos["nombre"])
        if "correo" in datos:
            nuevo = _correo(datos["correo"], excluir_id=usuario.id)
            if nuevo != usuario.correo:
                cambios.append(f"correo {usuario.correo} → {nuevo}")
                usuario.correo = nuevo
        if "rol" in datos and datos["rol"] != usuario.rol:
            nuevo_rol = _rol(datos["rol"])
            if es_yo:
                raise DatosInvalidosError("No puedes cambiar tu propio rol.")
            if usuario.rol == "ADMIN" and repo.contar_admins_activos(excluir_id=usuario.id) == 0:
                raise DatosInvalidosError("Debe quedar al menos un administrador activo.")
            eventos.append(
                ("rol_cambiado", f"{usuario.correo}: {ROLES[usuario.rol]} → {ROLES[nuevo_rol]}")
            )
            usuario.rol = nuevo_rol
            usuario.revocar_sesiones()
            if nuevo_rol != "AGENTE":
                usuario.punto_asignado_id = None
        if "punto_id" in datos and usuario.rol == "AGENTE":
            usuario.punto_asignado_id = _sede(datos["punto_id"])
            liberar_modulo_si_choca(usuario)
        if "activo" in datos and bool(datos["activo"]) != usuario.activo:
            activo = bool(datos["activo"])
            if es_yo and not activo:
                raise DatosInvalidosError("No puedes desactivar tu propia cuenta.")
            if (
                not activo
                and usuario.rol == "ADMIN"
                and repo.contar_admins_activos(excluir_id=usuario.id) == 0
            ):
                raise DatosInvalidosError("Debe quedar al menos un administrador activo.")
            usuario.activo = activo
            if not activo:
                usuario.revocar_sesiones()
            eventos.append(
                ("usuario_activado" if activo else "usuario_desactivado", usuario.correo)
            )
        repo.confirmar()
    except ValueError:
        repo.deshacer()
        raise
    return usuario, cambios, eventos


def restablecer_clave(usuario_id, actor_id):
    """Genera una clave temporal, desbloquea la cuenta y cierra sus sesiones."""
    usuario = obtener_personal(usuario_id)
    if usuario.id == actor_id:
        raise DatosInvalidosError("Para tu propia cuenta usa “Cambiar mi contraseña”.")
    clave = generar_clave_temporal()
    usuario.password_hash = encriptar_password(clave)
    usuario.debe_cambiar_clave = True
    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None  # restablecer también desbloquea
    usuario.revocar_sesiones()
    repo.confirmar()
    return usuario, clave
