"""Reglas de horario de atención y generación automática de franjas."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from flask import current_app
from sqlalchemy.exc import IntegrityError

from app import db
from app.errores import DatosInvalidosError


def zona():
    return ZoneInfo(current_app.config.get("ZONA_HORARIA", "America/Bogota"))


def ahora_local():
    return datetime.now(zona())


def hoy_local():
    return ahora_local().date()


def apertura():
    return time(int(current_app.config.get("HORA_APERTURA", 8)), 0)


def cierre():
    hora = int(current_app.config.get("HORA_CIERRE", 18))
    return time(23, 59) if hora >= 24 else time(hora, 0)


def dia_habil(fecha):
    dias = current_app.config.get("DIAS_ATENCION", list(range(7)))
    return fecha.weekday() in dias


def dentro_de_horario(hora_inicio, hora_fin):
    return apertura() <= hora_inicio and hora_fin <= cierre() and hora_fin > hora_inicio


def info_horario():
    nombres = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
    dias = current_app.config.get("DIAS_ATENCION", list(range(7)))
    return {
        "hora_apertura": apertura().strftime("%H:%M"),
        "hora_cierre": cierre().strftime("%H:%M"),
        "dias": [nombres[d] for d in sorted(dias)],
        "todos_los_dias": len(dias) == 7,
        "duracion_franja_min": int(current_app.config.get("DURACION_FRANJA_MIN", 30)),
        "dias_max_reserva": int(current_app.config.get("DIAS_MAX_RESERVA", 30)),
        "duracion_max_atencion_min": duracion_max_atencion_min(),
        "cupos_por_asesor": cupos_por_asesor(),
        "zona_horaria": current_app.config.get("ZONA_HORARIA"),
    }


def duracion_franja_min():
    return int(current_app.config.get("DURACION_FRANJA_MIN", 30))


def duracion_max_atencion_min():
    return int(current_app.config.get("DURACION_MAX_ATENCION_MIN", 10))


def cupos_por_asesor():
    """Personas que un asesor alcanza a atender en una franja (30/10 = 3)."""
    fijo = int(current_app.config.get("CUPOS_POR_ASESOR_FRANJA", 0) or 0)
    if fijo > 0:
        return fijo
    return max(1, duracion_franja_min() // max(1, duracion_max_atencion_min()))


def asesores_activos(punto_id):
    from app.dominios.usuarios.modelos import Usuario

    return Usuario.query.filter_by(rol="AGENTE", activo=True, punto_asignado_id=punto_id).count()


def capacidad_sede(punto_id):
    """Cupos de la SEDE por franja, sumando todos los trámites."""
    return cupos_por_asesor() * max(1, asesores_activos(punto_id))


def ocupacion_sede(punto_id, fecha, hora_inicio):
    """Turnos no cancelados de la sede en esa franja (todos los trámites)."""
    from app.dominios.franjas.modelos import Franja
    from app.dominios.turnos.modelos import Turno

    return (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(
            Turno.punto_id == punto_id,
            Franja.fecha == fecha,
            Franja.hora_inicio == hora_inicio,
            Turno.estado != "CANCELADO",
        )
        .count()
    )


def ocupacion_sede_dia(punto_id, fecha):
    """{hora_inicio: ocupados} para todas las franjas de la sede ese día."""
    from app.dominios.franjas.modelos import Franja
    from app.dominios.turnos.modelos import Turno

    filas = (
        db.session.query(Franja.hora_inicio, db.func.count(Turno.id))
        .join(Turno, Turno.franja_id == Franja.id)
        .filter(Turno.punto_id == punto_id, Franja.fecha == fecha, Turno.estado != "CANCELADO")
        .group_by(Franja.hora_inicio)
        .all()
    )
    return {hora: total for hora, total in filas}


def asegurar_franjas(punto, tramite, fecha):
    """Crea las franjas del día si no existe ninguna para sede+trámite+fecha."""
    from app.dominios.franjas.modelos import Franja

    if not current_app.config.get("FRANJAS_AUTOMATICAS", True):
        return 0
    if not dia_habil(fecha):
        return 0

    existentes = Franja.query.filter_by(
        punto_id=punto.id, tramite_id=tramite.id, fecha=fecha
    ).count()
    if existentes:
        return 0

    duracion = timedelta(minutes=int(current_app.config.get("DURACION_FRANJA_MIN", 30)))
    capacidad = capacidad_sede(punto.id)
    actual = datetime.combine(fecha, apertura())
    limite = datetime.combine(fecha, cierre())
    creadas = 0

    while actual + duracion <= limite:
        db.session.add(
            Franja(
                punto_id=punto.id,
                tramite_id=tramite.id,
                fecha=fecha,
                hora_inicio=actual.time(),
                hora_fin=(actual + duracion).time(),
                capacidad=capacidad,
                activa=True,
            )
        )
        actual += duracion
        creadas += 1

    try:
        db.session.commit()
    except IntegrityError:
        # Otra petición concurrente las creó primero.
        db.session.rollback()
        return 0
    return creadas


def validar_fecha_reservable(fecha):
    hoy = hoy_local()
    if fecha < hoy:
        raise DatosInvalidosError("No se pueden reservar fechas pasadas.")
    maximo = int(current_app.config.get("DIAS_MAX_RESERVA", 30))
    if fecha > hoy + timedelta(days=maximo):
        raise DatosInvalidosError(f"Solo puedes reservar con hasta {maximo} días de anticipación.")
    if not dia_habil(fecha):
        raise DatosInvalidosError("No hay atención ese día.")


def a_iso_utc(valor):
    """Fechas guardadas en UTC sin zona -> ISO con sufijo Z para el navegador."""
    if valor is None:
        return None
    return valor.replace(microsecond=0).isoformat() + "Z"
