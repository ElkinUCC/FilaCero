"""Servicios de administración de cuentas del personal (panel → Usuarios y permisos).

Reglas de negocio:
  - Solo existen los roles ADMIN, SUPERVISOR y AGENTE para el personal.
  - Las cuentas protegidas no se desactivan ni cambian de rol o correo.
  - Nadie cambia su propio rol ni desactiva su propia cuenta.
  - Siempre debe quedar al menos un administrador activo.
  - Cambiar el rol, desactivar o restablecer la clave revoca las sesiones abiertas.

Los servicios devuelven los eventos de auditoría que el controlador registra
solo cuando el cambio se guardó.
"""

from app.dominios.sedes.repositorios import obtener_por_id as obtener_sede
from app.errores import ConflictoError, DatosInvalidosError, NoEncontradoError
from app.seguridad import encriptar_password, validar_password_segura

from . import repositorios as repo
from .modelos import Usuario
from .servicios import generar_clave_temporal, liberar_modulo_si_choca

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
    """Crea la cuenta. Sin contraseña, genera una temporal que se muestra una sola vez.

    Devuelve (usuario, clave_temporal | None).
    """
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
