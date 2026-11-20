"""Contexto de datos del asistente IA.

El asistente nunca consulta la base de datos por su cuenta ni ejecuta SQL:
reutiliza los mismos servicios que alimentan el tablero, la vista "en vivo"
y la consola del asesor. Así respeta el aislamiento multiempresa, los
permisos por rol y las reglas de negocio ya probadas.
"""

from collections import Counter
from datetime import timedelta

from sqlalchemy.orm import contains_eager

from app.dominios.franjas.modelos import Franja
from app.dominios.reclamos.modelos import Reclamo
from app.dominios.turnos.modelos import Turno
from app.horario import hoy_local, info_horario


def _reservas_manana(punto_id=None):
    manana = hoy_local() + timedelta(days=1)
    consulta = (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .options(contains_eager(Turno.franja))
        .filter(Franja.fecha == manana, Turno.estado == "ESPERANDO")
    )
    if punto_id:
        consulta = consulta.filter(Turno.punto_id == punto_id)
    turnos = consulta.all()
    por_sede = Counter(t.punto.nombre for t in turnos if t.punto)
    por_hora = Counter(t.franja.hora_inicio.hour for t in turnos)
    pico = max(por_hora.items(), key=lambda x: x[1]) if por_hora else None
    return {
        "fecha": manana.isoformat(),
        "total": len(turnos),
        "por_sede": dict(por_sede.most_common()),
        "hora_pico": {"hora": pico[0], "total": pico[1]} if pico else None,
    }


def contexto_gerencial(dias=7, punto_id=None):
    """Datos para administrador y supervisor."""
    from app.dominios.agentes.consultas import construir_en_vivo
    from app.dominios.agentes.tablero import construir_tablero

    tablero = construir_tablero(dias=dias, punto_id=punto_id)
    vivo = construir_en_vivo()
    if punto_id:
        vivo["sedes"] = [s for s in vivo["sedes"] if s["punto_id"] == punto_id]
    return {
        "rol": "gerencial",
        "tablero": tablero,
        "vivo": vivo,
        "manana": _reservas_manana(punto_id),
        "horario": info_horario(),
    }


def contexto_asesor(agente):
    """Datos para el asesor: su consola, su cola y su bandeja de reclamos."""
    from app.dominios.agentes.consultas import construir_panel

    panel = construir_panel(agente)
    reclamos = Reclamo.query
    if agente.punto_asignado_id:
        reclamos = reclamos.filter(Reclamo.punto_id == agente.punto_asignado_id)
    estados = Counter(estado for (estado,) in reclamos.with_entities(Reclamo.estado))
    return {
        "rol": "asesor",
        "panel": panel,
        "reclamos": {
            "sin_atender": estados.get("RADICADO", 0),
            "en_gestion": estados.get("EN_GESTION", 0),
        },
        "horario": info_horario(),
    }


# ----------------------------------------------------------------------
# Versión resumida y sin datos personales para el modelo de lenguaje
# ----------------------------------------------------------------------


def _primer_nombre(nombre):
    return (nombre or "").split(" ")[0] or "Cliente"


def resumen_para_modelo(ctx):
    """Reduce el contexto a lo necesario y quita datos personales (celular,
    cédula, apellidos) antes de enviarlo a un proveedor externo."""
    if ctx["rol"] == "gerencial":
        t = ctx["tablero"]
        return {
            "periodo": t["periodo"],
            "periodo_anterior": t["anterior"],
            "kpis": t["kpis"],
            "kpis_periodo_anterior": t["kpis_anterior"],
            "turnos_por_dia": t["por_dia"],
            "turnos_por_hora": t["por_hora"],
            "por_tramite": t["por_tramite"],
            "por_sede": t["por_sede"],
            "taller_equipos": t["equipos"],
            "reclamos": t["reclamos"],
            "hallazgos_automaticos": t["hallazgos"],
            "operacion_ahora": [
                {
                    "sede": s["nombre"],
                    "franja_actual": s["franja_actual"],
                    "esperan_hoy": s["en_espera_hoy"],
                    "en_riesgo": s["en_riesgo"],
                    "asesores": Counter(a["estado"] for a in s["asesores"]),
                }
                for s in ctx["vivo"]["sedes"]
            ],
            "reservas_manana": ctx["manana"],
            "horario": ctx["horario"],
        }
    p = ctx["panel"]

    def anonimo(texto):
        texto = str(texto or "")
        for t in [p["actual"], *p["cola"]]:
            if t and t.get("usuario_nombre"):
                texto = texto.replace(t["usuario_nombre"], _primer_nombre(t["usuario_nombre"]))
        return texto

    return {
        "ahora": p["ahora"],
        "sede": p["agente"]["sede"],
        "modulo": p["agente"]["modulo"],
        "presencia": p["agente"]["presencia"],
        "franja_actual": p["franja_actual"],
        "recomendacion_despacho": {
            k: anonimo((p["recomendacion"] or {}).get(k))
            for k in ("accion", "titulo", "motivo", "nivel")
        },
        "turno_actual": (
            {
                "cliente": _primer_nombre(p["actual"]["usuario_nombre"]),
                "tramite": p["actual"]["tramite_nombre"],
                "estado": p["actual"]["estado"],
            }
            if p["actual"]
            else None
        ),
        "cola": [
            {
                "cliente": _primer_nombre(t["usuario_nombre"]),
                "codigo": t.get("codigo_corto"),
                "tramite": t["tramite_nombre"],
                "hora_reservada": t["hora_inicio"],
                "inicio_proyectado": t["inicio_proyectado"],
                "puntualidad": t["puntualidad"],
                "es_hoy": t["es_hoy"],
                "requiere_preparacion": bool(t.get("requiere_preparacion")),
                "preparacion": (t.get("preparacion") or {}).get("estado"),
                "equipo": (
                    f"{t['equipo']['marca']} {t['equipo']['modelo']} · {t['equipo']['estado_texto']}"
                    if t.get("equipo")
                    else None
                ),
            }
            for t in p["cola"][:25]
        ],
        "mi_jornada": p["resumen"],
        "reclamos_sede": ctx["reclamos"],
        "horario": ctx["horario"],
    }
