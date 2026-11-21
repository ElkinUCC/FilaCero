"""Contratos JSON (DTO) del dominio de atención.

Los DTO definen la forma pública de los datos: el controlador solo los devuelve
y nunca arma diccionarios a partir de modelos.
"""

from app.dominios.turnos.dtos import turno_response
from app.dominios.usuarios.dtos import usuario_response
from app.horario import a_iso


def cola_response(turnos):
    return {"total_en_espera": len(turnos), "turnos": [turno_response(t) for t in turnos]}


def turno_accion_response(turno, mensaje):
    return {"mensaje": mensaje, "turno": turno_response(turno)}


def agente_admin_response(agente, turno_en_curso):
    """Asesor en el panel: datos de la cuenta + el turno que atiende ahora."""
    datos = usuario_response(agente)
    datos["turno_actual"] = turno_en_curso.codigo if turno_en_curso else None
    datos["estado_turno_actual"] = turno_en_curso.estado if turno_en_curso else None
    return datos


def historial_response(pagina, por_pagina, total, turnos):
    return {
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total": total,
        "total_paginas": (total + por_pagina - 1) // por_pagina,
        "turnos": [turno_response(t) for t in turnos],
    }


def totales_sede_response(filas):
    return {
        "sedes": [
            {
                "punto_id": f.punto_id,
                "nombre": f.nombre,
                "total_turnos": f.total,
                "en_espera": int(f.espera or 0),
                "atendidos": int(f.atendidos or 0),
            }
            for f in filas
        ]
    }


def totales_tramite_response(filas):
    return {
        "tramites": [
            {"tramite_id": f.tramite_id, "nombre": f.nombre, "total_turnos": f.total} for f in filas
        ]
    }


def turno_reciente_response(turno):
    """Reserva reciente para el resumen en vivo del panel."""
    return {
        "id": turno.id,
        "codigo": turno.codigo,
        "sede": turno.punto.nombre if turno.punto else None,
        "tramite": turno.tramite.nombre if turno.tramite else None,
        "fecha": turno.franja.fecha.isoformat(),
        "hora": f"{turno.franja.hora_inicio:%H:%M}",
        "estado": turno.estado,
        "reservado": a_iso(turno.hora_solicitud),
    }


def asesor_en_vivo_response(asesor, turno_en_curso):
    if turno_en_curso:
        estado = turno_en_curso.estado
    else:
        presencia = asesor.presencia or "DISPONIBLE"
        estado = "LIBRE" if presencia == "DISPONIBLE" else presencia
    return {
        "nombre": asesor.nombre,
        "turno": turno_en_curso.codigo if turno_en_curso else None,
        "estado": estado,
    }
