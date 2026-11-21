from app.horario import a_iso
from app.seguridad import enmascarar_celular

from .preparacion import preparacion_response


def _equipo(turno, publica=False):
    if not turno.equipo:
        return None
    from app.dominios.equipos.dtos import equipo_publico_response, equipo_response

    return equipo_publico_response(turno.equipo) if publica else equipo_response(turno.equipo)


def _reclamo(turno, publica=False):
    if not turno.reclamo:
        return None
    from app.dominios.reclamos.dtos import reclamo_response

    return reclamo_response(turno.reclamo, publica=publica)


def turno_response(turno):
    return {
        "id": turno.id,
        "codigo": turno.codigo,
        "codigo_corto": turno.codigo_corto,
        "fecha": turno.franja.fecha.isoformat(),
        "hora_inicio": turno.franja.hora_inicio.strftime("%H:%M"),
        "hora_fin": turno.franja.hora_fin.strftime("%H:%M"),
        "hora_solicitud": a_iso(turno.hora_solicitud),
        "estado": turno.estado,
        "detalle_necesidad": turno.detalle_necesidad,
        "respuestas_solicitud": turno.respuestas_solicitud or [],
        "usuario_id": turno.usuario_id,
        "usuario_nombre": turno.usuario.nombre if turno.usuario else None,
        "usuario_celular": turno.usuario.celular if turno.usuario else None,
        "usuario_documento": (
            f"···{turno.usuario.documento[-4:]}"
            if turno.usuario and turno.usuario.documento
            else None
        ),
        "tramite_id": turno.tramite_id,
        "tramite_nombre": turno.tramite.nombre if turno.tramite else None,
        "tiempo_estimado": turno.tramite.tiempo_estimado if turno.tramite else None,
        "punto_id": turno.punto_id,
        "punto_nombre": turno.punto.nombre if turno.punto else None,
        "franja_id": turno.franja_id,
        "agente_id": turno.agente_id,
        "agente_nombre": turno.agente.nombre if turno.agente else None,
        "fecha_llamado": a_iso(turno.fecha_llamado),
        "fecha_inicio": a_iso(turno.fecha_inicio),
        "fecha_fin": a_iso(turno.fecha_fin),
        "agente_modulo": turno.agente.modulo if turno.agente else None,
        "requiere_preparacion": bool(turno.tramite and turno.tramite.requiere_preparacion),
        "preparacion": preparacion_response(turno),
        "tramite_flujo": getattr(turno.tramite, "tipo_flujo", None) or "GENERAL",
        "equipo": _equipo(turno),
        "reclamo": _reclamo(turno),
    }


def turno_publico_response(turno):
    """Versión para el ciudadano sin sesión: sin IDs internos y celular enmascarado."""
    return {
        "codigo": turno.codigo,
        "estado": turno.estado,
        "fecha": turno.franja.fecha.isoformat(),
        "hora_inicio": turno.franja.hora_inicio.strftime("%H:%M"),
        "hora_fin": turno.franja.hora_fin.strftime("%H:%M"),
        "sede": turno.punto.nombre if turno.punto else None,
        "direccion": turno.punto.direccion if turno.punto else None,
        "tramite": turno.tramite.nombre if turno.tramite else None,
        "nombre": turno.usuario.nombre if turno.usuario else None,
        "celular": enmascarar_celular(turno.usuario.celular) if turno.usuario else None,
        "preparacion": preparacion_response(turno, publica=True),
        "instrucciones": turno.tramite.instrucciones_preparacion if turno.tramite else None,
        "codigo_corto": turno.codigo_corto,
        "tramite_flujo": getattr(turno.tramite, "tipo_flujo", None) or "GENERAL",
        "equipo": _equipo(turno, publica=True),
        "reclamo": _reclamo(turno, publica=True),
    }


# ---------------------------------------------------------------------
# Pantalla de sala (pública): nunca incluye el celular
# ---------------------------------------------------------------------


def _nombre_corto(nombre):
    partes = (nombre or "").split()
    if not partes:
        return ""
    return partes[0] + (f" {partes[1][0]}." if len(partes) > 1 else "")


def nombre_para_sala(nombre):
    """Nombre que se muestra y se anuncia en la sala de espera.

    Por defecto, completo (la persona se reconoce sin ambigüedad cuando hay
    nombres repetidos). Con SALA_NOMBRE_COMPLETO=false se abrevia (ADR-008).
    """
    from flask import current_app

    if current_app.config.get("SALA_NOMBRE_COMPLETO", True):
        return " ".join((nombre or "").split())
    return _nombre_corto(nombre)


def turno_llamado_sala_response(turno):
    return {
        "id": turno.id,
        "codigo": turno.codigo_corto,
        "nombre": nombre_para_sala(turno.usuario.nombre if turno.usuario else ""),
        "asesor": " ".join((turno.agente.nombre if turno.agente else "").split()),
        "modulo": turno.agente.modulo if turno.agente else None,
        "estado": turno.estado,
        "llamado": a_iso(turno.fecha_llamado),
    }


def turno_siguiente_sala_response(turno):
    return {
        "codigo": turno.codigo_corto,
        "nombre": nombre_para_sala(turno.usuario.nombre if turno.usuario else ""),
        "hora": f"{turno.franja.hora_inicio:%H:%M}",
    }
