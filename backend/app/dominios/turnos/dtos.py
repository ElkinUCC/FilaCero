from app.horario import a_iso_utc
from app.seguridad import enmascarar_celular


def turno_response(turno):
    return {
        "id": turno.id,
        "codigo": turno.codigo,
        "fecha": turno.franja.fecha.isoformat(),
        "hora_inicio": turno.franja.hora_inicio.strftime("%H:%M"),
        "hora_fin": turno.franja.hora_fin.strftime("%H:%M"),
        "hora_solicitud": a_iso_utc(turno.hora_solicitud),
        "estado": turno.estado,
        "usuario_id": turno.usuario_id,
        "usuario_nombre": turno.usuario.nombre if turno.usuario else None,
        "usuario_celular": turno.usuario.celular if turno.usuario else None,
        "tramite_id": turno.tramite_id,
        "tramite_nombre": turno.tramite.nombre if turno.tramite else None,
        "tiempo_estimado": turno.tramite.tiempo_estimado if turno.tramite else None,
        "punto_id": turno.punto_id,
        "punto_nombre": turno.punto.nombre if turno.punto else None,
        "franja_id": turno.franja_id,
        "agente_id": turno.agente_id,
        "agente_nombre": turno.agente.nombre if turno.agente else None,
        "fecha_llamado": a_iso_utc(turno.fecha_llamado),
        "fecha_inicio": a_iso_utc(turno.fecha_inicio),
        "fecha_fin": a_iso_utc(turno.fecha_fin),
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
    }
