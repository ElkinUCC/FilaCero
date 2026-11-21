"""Servicios de franjas: disponibilidad para el listado general y para la reserva."""

from datetime import date, datetime

from app.dominios.sedes.repositorios import obtener_por_id as obtener_sede
from app.dominios.tramites.repositorios import obtener_por_id as obtener_tramite
from app.errores import DatosInvalidosError, NoEncontradoError
from app.horario import (
    ahora_local,
    asegurar_franjas,
    capacidad_sede,
    dentro_de_horario,
    ocupacion_sede_dia,
    validar_fecha_reservable,
    zona,
)

from .dtos import franja_disponibilidad_response, franja_reservable_response
from .repositorios import franjas_activas_del_dia, listar_activas, reservas_por_franja


class FechaNoReservableError(DatosInvalidosError):
    """La fecha está fuera de la ventana de reserva (pasada o demasiado lejana)."""


def consultar_disponibilidad(punto_id=None, tramite_id=None, fecha=None):
    franjas = listar_activas(punto_id, tramite_id, fecha)
    conteo = reservas_por_franja([f.id for f in franjas])
    resultado = []
    for franja in franjas:
        reservados = conteo.get(franja.id, 0)
        disponibles = max(0, franja.capacidad - reservados)
        resultado.append(franja_disponibilidad_response(franja, reservados, disponibles))
    return resultado


def franjas_reservables(sede_id, tramite_id, fecha_texto):
    """Franjas que se pueden reservar hoy por sede, trámite y fecha (YYYY-MM-DD)."""
    if not sede_id or not tramite_id or not fecha_texto:
        raise DatosInvalidosError("Debes indicar sede_id, tramite_id y fecha (YYYY-MM-DD).")
    try:
        fecha_consulta = date.fromisoformat(fecha_texto)
    except ValueError:
        raise DatosInvalidosError("La fecha debe tener formato YYYY-MM-DD.") from None
    try:
        validar_fecha_reservable(fecha_consulta)
    except ValueError as error:
        raise FechaNoReservableError(str(error)) from None

    sede = obtener_sede(sede_id)
    tramite = obtener_tramite(tramite_id)
    if not sede or not sede.activo:
        raise NoEncontradoError("La sede no existe o está inactiva.")
    if not tramite or not tramite.activo:
        raise NoEncontradoError("El trámite no existe o está inactivo.")

    asegurar_franjas(sede, tramite, fecha_consulta)
    franjas = franjas_activas_del_dia(sede_id, tramite_id, fecha_consulta)
    conteo = reservas_por_franja([f.id for f in franjas])
    cupo_sede = capacidad_sede(sede_id)
    ocupada = ocupacion_sede_dia(sede_id, fecha_consulta)

    ahora = ahora_local()
    resultado = []
    for franja in franjas:
        inicio = datetime.combine(franja.fecha, franja.hora_inicio, tzinfo=zona())
        if inicio <= ahora or not dentro_de_horario(franja.hora_inicio, franja.hora_fin):
            continue
        reservados = conteo.get(franja.id, 0)
        disponibles = max(
            0,
            min(franja.capacidad - reservados, cupo_sede - ocupada.get(franja.hora_inicio, 0)),
        )
        if disponibles:
            resultado.append(franja_reservable_response(franja, reservados, disponibles))

    return {
        "sede": sede.nombre,
        "tramite": tramite.nombre,
        "fecha": fecha_consulta.isoformat(),
        "cantidad": len(resultado),
        "franjas": resultado,
    }
