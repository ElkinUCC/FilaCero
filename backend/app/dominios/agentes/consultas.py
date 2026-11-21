"""Servicios de consulta del dominio de atención (solo lectura).

Arman las vistas compuestas que pide la SPA en una sola llamada: la consola del
asesor y la foto "en vivo" del panel. También las reutiliza el asistente
FilaCero IA, que así responde con los mismos datos y permisos que ve la persona.
"""

from datetime import datetime, time, timedelta

from app.dominios.turnos.dtos import turno_response
from app.dominios.turnos.preparacion import pendientes
from app.horario import (
    a_iso,
    ahora_local,
    duracion_max_atencion_min,
    hoy_local,
    info_horario,
    zona,
)
from app.tiempo import a_bd

from . import repositorios as repo
from .despacho import cumplimiento, estado_franja_actual, proyectar_cola, recomendar
from .dtos import asesor_en_vivo_response, turno_reciente_response
from .servicios import consultar_cola, en_horario_de_atencion, turno_activo


def rango_bd_de_hoy():
    """Inicio y fin del día local en la zona de la BD, sin zona (como se guardan)."""
    inicio = a_bd(datetime.combine(hoy_local(), time.min, tzinfo=zona()))
    return inicio, inicio + timedelta(days=1)


def promedio_segundos(turnos):
    """Duración media de las atenciones cerradas (None si no hay ninguna)."""
    duraciones = [
        (t.fecha_fin - t.fecha_inicio).total_seconds()
        for t in turnos
        if t.estado == "ATENDIDO"
        and t.fecha_inicio
        and t.fecha_fin
        and t.fecha_fin >= t.fecha_inicio
    ]
    return round(sum(duraciones) / len(duraciones), 1) if duraciones else None


def construir_panel(agente):
    """Consola del asesor en una sola llamada: reloj, franja, cola con proyección
    de puntualidad, recomendación del asistente y resumen de su jornada."""
    activo = turno_activo(agente.id)
    ahora = ahora_local()

    error = None
    proyeccion = []
    try:
        consultar_cola(agente.id)  # valida sede asignada y activa
        proyeccion = proyectar_cola(agente.punto_asignado_id, ahora)
    except ValueError as e:
        error = str(e)

    desde, hasta = rango_bd_de_hoy()
    mios_hoy = repo.turnos_cerrados_del_agente(agente.id, desde, hasta)
    recientes = sorted(
        [t for t in mios_hoy if t.estado in ("ATENDIDO", "NO_ASISTIO")],
        key=lambda t: t.fecha_fin,
        reverse=True,
    )[:5]

    cola = []
    for p in proyeccion:
        datos = turno_response(p["turno"])
        datos.update(
            {
                "puntualidad": p["puntualidad"],
                "inicio_proyectado": p["inicio_proyectado"].strftime("%H:%M"),
                "duracion_estimada_seg": p["duracion_estimada_seg"],
                "margen_seg": p["margen_seg"],
                "es_hoy": p["turno"].franja.fecha == ahora.date(),
            }
        )
        cola.append(datos)

    sede = agente.punto_asignado
    return {
        "ahora": ahora.isoformat(timespec="seconds"),
        "agente": {
            "nombre": agente.nombre,
            "sede_id": agente.punto_asignado_id,
            "sede": sede.nombre if sede else None,
            "sede_direccion": sede.direccion if sede else None,
            "modulo": agente.modulo,
            "presencia": agente.presencia or "DISPONIBLE",
            "presencia_desde": a_iso(agente.presencia_desde),
        },
        "error": error,
        "en_horario": en_horario_de_atencion(),
        "horario": info_horario(),
        "max_atencion_seg": duracion_max_atencion_min() * 60,
        "franja_actual": (
            estado_franja_actual(agente.punto_asignado_id, ahora)
            if agente.punto_asignado_id
            else None
        ),
        "actual": turno_response(activo) if activo else None,
        "recomendacion": (recomendar(agente, activo, proyeccion, ahora) if not error else None),
        "cola": cola,
        "resumen": {
            "en_espera": len(cola),
            "en_espera_hoy": sum(1 for t in cola if t["es_hoy"]),
            "en_riesgo": sum(1 for t in cola if t["puntualidad"] in ("en_riesgo", "atrasado")),
            "por_preparar": len(pendientes([p["turno"] for p in proyeccion])),
            "atendidos_hoy": sum(1 for t in mios_hoy if t.estado == "ATENDIDO"),
            "no_asistio_hoy": sum(1 for t in mios_hoy if t.estado == "NO_ASISTIO"),
            "promedio_hoy_segundos": promedio_segundos(mios_hoy),
            **cumplimiento(mios_hoy),
        },
        "recientes": [turno_response(t) for t in recientes],
    }


def construir_en_vivo():
    """Foto de la operación en este momento: cada sede activa con su franja,
    personas en espera, asesores y las últimas reservas que llegaron."""
    ahora = ahora_local()
    resultado = []
    for sede in repo.sedes_activas():
        proyeccion = proyectar_cola(sede.id, ahora)
        hoy = [p for p in proyeccion if p["turno"].franja.fecha == ahora.date()]
        # Próxima franja de hoy con personas esperando (para que se vea que
        # los turnos sí llegaron aunque la franja en curso esté vacía).
        proxima = None
        if hoy:
            primero = hoy[0]["turno"].franja
            proxima = {
                "hora": f"{primero.hora_inicio:%H:%M}",
                "cantidad": sum(
                    1 for p in hoy if p["turno"].franja.hora_inicio == primero.hora_inicio
                ),
            }
        resultado.append(
            {
                "punto_id": sede.id,
                "nombre": sede.nombre,
                "franja_actual": estado_franja_actual(sede.id, ahora),
                "proxima": proxima,
                "en_espera_hoy": len(hoy),
                "en_riesgo": sum(1 for p in hoy if p["puntualidad"] in ("en_riesgo", "atrasado")),
                "asesores": [
                    asesor_en_vivo_response(a, repo.obtener_turno_activo(a.id))
                    for a in repo.asesores_activos_de_sede(sede.id)
                ],
            }
        )

    return {
        "ahora": ahora.isoformat(timespec="seconds"),
        "sedes": resultado,
        "recientes": [turno_reciente_response(t) for t in repo.turnos_recientes(8)],
    }
