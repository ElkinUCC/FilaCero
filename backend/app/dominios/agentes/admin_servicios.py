"""Servicios del panel administrativo para asesores, historial y métricas.

Contienen las reglas de negocio y las validaciones que antes estaban en el
controlador (deuda R-07, corregida): el controlador solo traduce HTTP.
Lanzan errores de dominio (``app.errores``); ninguno conoce Flask.
"""

from dataclasses import dataclass
from datetime import date

from app.dominios.turnos.repositorios import ESTADOS
from app.dominios.usuarios.servicios import (
    asignar_modulo,
    liberar_modulo_si_choca,
    modulo_ocupado,
    normalizar_modulo,
    registrar_usuario,
)
from app.errores import DatosInvalidosError, NoEncontradoError
from app.horario import ahora_local, duracion_max_atencion_min
from app.seguridad import encriptar_password, validar_password_segura

from . import repositorios as repo
from .consultas import promedio_segundos
from .despacho import cumplimiento

CAMPOS_FILTRO = ("desde", "hasta", "punto_id", "tramite_id", "estado")


# ---------------------------------------------------------------------
# Filtros del historial y de las métricas
# ---------------------------------------------------------------------


@dataclass(frozen=True)
class FiltrosTurnos:
    desde: date | None = None
    hasta: date | None = None
    punto_id: int | None = None
    tramite_id: int | None = None
    estado: str | None = None
    buscar: str | None = None

    @property
    def tiene_fechas(self):
        return bool(self.desde or self.hasta)


def _entero_positivo(nombre, valor):
    if valor in (None, ""):
        return None
    try:
        identificador = int(valor)
    except (TypeError, ValueError):
        raise DatosInvalidosError(f"{nombre} debe ser un entero positivo.") from None
    if identificador <= 0:
        raise DatosInvalidosError(f"{nombre} debe ser un entero positivo.")
    return identificador


def leer_filtros(args):
    """Valida los parámetros de la URL y devuelve filtros tipados."""
    try:
        desde = date.fromisoformat(args["desde"]) if args.get("desde") else None
        hasta = date.fromisoformat(args["hasta"]) if args.get("hasta") else None
    except ValueError:
        raise DatosInvalidosError("Las fechas deben usar formato YYYY-MM-DD.") from None
    if desde and hasta and desde > hasta:
        raise DatosInvalidosError("La fecha inicial no puede superar la fecha final.")

    estado = args.get("estado") or None
    if estado and estado not in ESTADOS:
        raise DatosInvalidosError("Estado de turno no válido.")

    buscar = (args.get("buscar") or "").strip()[:40] or None
    return FiltrosTurnos(
        desde=desde,
        hasta=hasta,
        punto_id=_entero_positivo("punto_id", args.get("punto_id")),
        tramite_id=_entero_positivo("tramite_id", args.get("tramite_id")),
        estado=estado,
        buscar=buscar,
    )


def metricas(args):
    filtros = leer_filtros(args)
    turnos = repo.con_franja_cargada(repo.consulta_turnos_admin(filtros)).all()
    por_estado = {estado: sum(t.estado == estado for t in turnos) for estado in ESTADOS}
    return {
        "total_turnos": len(turnos),
        "por_estado": por_estado,
        "atendidos": por_estado["ATENDIDO"],
        "cancelados": por_estado["CANCELADO"],
        "no_asistio": por_estado["NO_ASISTIO"],
        "en_espera": por_estado["ESPERANDO"],
        "en_proceso": por_estado["LLAMADO"] + por_estado["EN_ATENCION"],
        "promedio_atencion_segundos": promedio_segundos(turnos),
        "max_atencion_seg": duracion_max_atencion_min() * 60,
        **cumplimiento(turnos),
        "agentes_activos": repo.contar_agentes_activos(),
        "filtros": {k: args.get(k) for k in CAMPOS_FILTRO},
    }


def historial(args):
    """Página del historial. Sin fechas, muestra solo lo que ya ocurrió."""
    try:
        pagina = int(args.get("pagina", 1))
        por_pagina = int(args.get("por_pagina", 20))
    except (TypeError, ValueError):
        raise DatosInvalidosError("La paginación debe usar números enteros.") from None
    if pagina < 1:
        raise DatosInvalidosError("pagina debe ser mayor que cero.")
    if not 1 <= por_pagina <= 100:
        raise DatosInvalidosError("por_pagina debe estar entre 1 y 100.")

    filtros = leer_filtros(args)
    consulta = repo.consulta_turnos_admin(filtros)
    if not filtros.tiene_fechas:
        consulta = repo.solo_hasta(consulta, ahora_local())
    total, turnos = repo.paginar_historial(consulta, pagina, por_pagina)
    return pagina, por_pagina, total, turnos


def totales_por_sede(args):
    return repo.totales_por_sede(repo.consulta_turnos_admin(leer_filtros(args)))


def totales_por_tramite(args):
    return repo.totales_por_tramite(repo.consulta_turnos_admin(leer_filtros(args)))


def leer_parametros_tablero(args):
    """Parámetros del tablero ejecutivo: periodo (1 a 92 días o fechas) y sede."""
    from .tablero import parsear_fecha

    try:
        dias = int(args["dias"]) if args.get("dias") else None
        punto_id = int(args["punto_id"]) if args.get("punto_id") else None
    except ValueError:
        raise DatosInvalidosError("Parámetros no válidos.") from None
    if dias is not None and not 1 <= dias <= 92:
        raise DatosInvalidosError("dias debe estar entre 1 y 92.")
    return parsear_fecha(args.get("desde")), parsear_fecha(args.get("hasta")), dias, punto_id


# ---------------------------------------------------------------------
# Asesores
# ---------------------------------------------------------------------


def listar_agentes():
    """Asesores vigentes con el turno que atienden en este momento."""
    return [(a, repo.obtener_turno_activo(a.id)) for a in repo.listar_agentes_vigentes()]


def turno_en_curso(agente):
    return repo.obtener_turno_activo(agente.id)


def _nombre(valor):
    nombre = " ".join(str(valor or "").split())
    if len(nombre) < 3 or len(nombre) > 100:
        raise DatosInvalidosError("El nombre debe tener entre 3 y 100 caracteres.")
    return nombre


def _sede_valida(punto_id):
    """None si no se envía sede; si se envía, debe existir y estar activa."""
    if punto_id in (None, ""):
        return None
    if isinstance(punto_id, bool):
        raise DatosInvalidosError("punto_id debe ser un entero.")
    try:
        punto_id = int(punto_id)
    except (TypeError, ValueError):
        raise DatosInvalidosError("punto_id debe ser un entero.") from None
    punto = repo.obtener_sede(punto_id)
    if not punto or not punto.activo:
        raise DatosInvalidosError("La sede no existe o está inactiva.")
    return punto.id


def crear_agente(datos):
    nombre = _nombre(datos.get("nombre"))
    correo = str(datos.get("correo", "")).strip().lower()
    if "@" not in correo or len(correo) > 120:
        raise DatosInvalidosError("Ingresa un correo válido.")
    punto_id = _sede_valida(datos.get("punto_id"))
    modulo = normalizar_modulo(datos.get("modulo"))
    otro = modulo_ocupado(modulo, punto_id)
    if otro:
        raise DatosInvalidosError(f"{modulo} ya está asignado a {otro.nombre} en esa sede.")
    agente = registrar_usuario(
        nombre, correo, datos.get("password", ""), rol="AGENTE", punto_id=punto_id
    )
    if modulo:
        agente.modulo = modulo
        repo.confirmar()
    return agente


def actualizar_agente(usuario_id, datos):
    agente = repo.obtener_agente_vigente(usuario_id)
    if not agente:
        raise NoEncontradoError("Agente no encontrado.")
    try:
        revocar_sesiones = False
        if "nombre" in datos:
            agente.nombre = _nombre(datos["nombre"])
        if "punto_id" in datos:
            agente.punto_asignado_id = _sede_valida(datos["punto_id"])
            if "modulo" not in datos:
                liberar_modulo_si_choca(agente)
        if "modulo" in datos:
            asignar_modulo(agente, datos["modulo"])
        if "activo" in datos:
            if agente.protegida and not datos["activo"]:
                raise DatosInvalidosError("Cuenta protegida: no se puede desactivar.")
            agente.activo = bool(datos["activo"])
            revocar_sesiones = not agente.activo
        if datos.get("password"):
            validar_password_segura(datos["password"])
            agente.password_hash = encriptar_password(datos["password"])
            revocar_sesiones = True
        if revocar_sesiones:
            agente.revocar_sesiones()
        repo.confirmar()
    except ValueError:
        repo.deshacer()
        raise
    return agente


def asignar_sede(usuario_id, punto_id):
    if not isinstance(punto_id, int) or isinstance(punto_id, bool):
        raise DatosInvalidosError("punto_id debe ser un entero.")
    agente = repo.obtener_agente(usuario_id)
    if not agente:
        raise NoEncontradoError("No existe un agente activo con ese ID.")
    punto = repo.obtener_sede(punto_id)
    if not punto or not punto.activo:
        raise NoEncontradoError("La sede no existe o está inactiva.")
    agente.punto_asignado_id = punto.id
    repo.confirmar()
    return agente


def desasignar_sede(usuario_id):
    agente = repo.obtener_agente_cualquiera(usuario_id)
    if not agente:
        raise NoEncontradoError("Agente no encontrado.")
    if agente.punto_asignado_id is None:
        raise DatosInvalidosError("El agente no tiene una sede asignada.")
    agente.punto_asignado_id = None
    repo.confirmar()
    return agente
