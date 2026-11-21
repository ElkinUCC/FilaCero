"""Tablero ejecutivo: indicadores del periodo comparados con el periodo anterior.

Lo consumen el administrador y el supervisor (este último solo lectura).
Todo se calcula en una pasada sobre los turnos del rango, sin consultas por fila.
"""

from collections import Counter
from datetime import date, timedelta

from sqlalchemy.orm import contains_eager, joinedload

from app.dominios.equipos.modelos import Equipo
from app.dominios.franjas.modelos import Franja
from app.dominios.reclamos.modelos import Reclamo
from app.dominios.turnos.modelos import Turno
from app.horario import hoy_local

from .despacho import cumplimiento

MAX_DIAS = 92
ESTADOS_EQUIPO = ("POR_RECIBIR", "RECIBIDO", "EN_REPARACION", "LISTO", "ENTREGADO")


def _rango(desde, hasta, dias):
    hasta = hasta or hoy_local()
    desde = desde or hasta - timedelta(days=(dias or 7) - 1)
    if desde > hasta:
        raise ValueError("La fecha inicial no puede superar la fecha final.")
    if (hasta - desde).days + 1 > MAX_DIAS:
        raise ValueError(f"El tablero admite máximo {MAX_DIAS} días.")
    return desde, hasta


def _turnos(desde, hasta, punto_id):
    consulta = (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .options(contains_eager(Turno.franja), joinedload(Turno.tramite), joinedload(Turno.punto))
        .filter(Franja.fecha >= desde, Franja.fecha <= hasta)
    )
    if punto_id:
        consulta = consulta.filter(Turno.punto_id == punto_id)
    return consulta.all()


def _kpis(turnos):
    total = len(turnos)
    estados = Counter(t.estado for t in turnos)
    cerrados = estados["ATENDIDO"] + estados["NO_ASISTIO"]
    duraciones = [
        (t.fecha_fin - t.fecha_inicio).total_seconds()
        for t in turnos
        if t.estado == "ATENDIDO"
        and t.fecha_inicio
        and t.fecha_fin
        and t.fecha_fin >= t.fecha_inicio
    ]
    preparables = [t for t in turnos if t.estado_preparacion]
    listos = sum(1 for t in preparables if t.estado_preparacion == "LISTO")
    return {
        "total": total,
        "atendidos": estados["ATENDIDO"],
        "cancelados": estados["CANCELADO"],
        "no_asistio": estados["NO_ASISTIO"],
        "en_curso": estados["ESPERANDO"] + estados["LLAMADO"] + estados["EN_ATENCION"],
        "asistencia_pct": round(100 * estados["ATENDIDO"] / cerrados, 1) if cerrados else None,
        "cancelacion_pct": round(100 * estados["CANCELADO"] / total, 1) if total else None,
        "atencion_promedio_seg": round(sum(duraciones) / len(duraciones)) if duraciones else None,
        "preparados_pct": round(100 * listos / len(preparables), 1) if preparables else None,
        **cumplimiento(turnos),
    }


def _serie_diaria(turnos, desde, hasta):
    dias = {desde + timedelta(days=i): Counter() for i in range((hasta - desde).days + 1)}
    for t in turnos:
        dias[t.franja.fecha][t.estado] += 1
    return [
        {
            "fecha": d.isoformat(),
            "total": sum(c.values()),
            "atendidos": c["ATENDIDO"],
            "no_asistio": c["NO_ASISTIO"],
            "cancelados": c["CANCELADO"],
        }
        for d, c in dias.items()
    ]


def _por_hora(turnos):
    horas = Counter(t.franja.hora_inicio.hour for t in turnos if t.estado != "CANCELADO")
    if not horas:
        return []
    return [{"hora": h, "total": horas.get(h, 0)} for h in range(min(horas), max(horas) + 1)]


def _ranking(turnos, clave, nombre):
    grupos = {}
    for t in turnos:
        objeto = getattr(t, clave)
        if objeto is None:
            continue
        g = grupos.setdefault(objeto.id, {"id": objeto.id, "nombre": nombre(objeto), "items": []})
        g["items"].append(t)
    filas = []
    for g in grupos.values():
        k = _kpis(g.pop("items"))
        filas.append(
            {
                **g,
                "total": k["total"],
                "atendidos": k["atendidos"],
                "asistencia_pct": k["asistencia_pct"],
                "puntualidad_pct": k["puntualidad_pct"],
                "atencion_promedio_seg": k["atencion_promedio_seg"],
            }
        )
    return sorted(filas, key=lambda f: f["total"], reverse=True)


def _taller(punto_id, desde_utc, hasta_utc):
    equipos = Equipo.query
    reclamos = Reclamo.query
    if punto_id:
        equipos = equipos.filter(Equipo.punto_id == punto_id)
        reclamos = reclamos.filter(Reclamo.punto_id == punto_id)
    por_estado = Counter(estado for (estado,) in equipos.with_entities(Equipo.estado))
    entregados = equipos.filter(
        Equipo.fecha_entrega >= desde_utc, Equipo.fecha_entrega < hasta_utc
    ).count()
    recibidos = equipos.filter(
        Equipo.fecha_registro >= desde_utc, Equipo.fecha_registro < hasta_utc
    ).count()

    rec = reclamos.with_entities(
        Reclamo.estado, Reclamo.fecha_creacion, Reclamo.fecha_respuesta
    ).all()
    estados_rec = Counter(r.estado for r in rec)
    horas = [
        (r.fecha_respuesta - r.fecha_creacion).total_seconds() / 3600
        for r in rec
        if r.estado == "RESUELTO"
        and r.fecha_respuesta
        and r.fecha_creacion
        and r.fecha_respuesta >= r.fecha_creacion
    ]
    return {
        "equipos": {
            "por_estado": {e: por_estado.get(e, 0) for e in ESTADOS_EQUIPO},
            "en_taller": sum(por_estado.get(e, 0) for e in ("RECIBIDO", "EN_REPARACION")),
            "listos_por_recoger": por_estado.get("LISTO", 0),
            "recibidos_periodo": recibidos,
            "entregados_periodo": entregados,
        },
        "reclamos": {
            "abiertos": estados_rec["RADICADO"] + estados_rec["EN_GESTION"],
            "sin_atender": estados_rec["RADICADO"],
            "resueltos": estados_rec["RESUELTO"],
            "respuesta_promedio_horas": round(sum(horas) / len(horas), 1) if horas else None,
        },
    }


def _var(actual, anterior):
    if actual is None or not anterior:
        return None
    return round((actual - anterior) / anterior * 100, 1)


def hallazgos(datos):
    """Asistente de métricas: convierte los números del tablero en lecturas accionables.

    Reglas explícitas y explicables (sin modelos externos): cada hallazgo dice
    qué pasó, cuánto y qué hacer. Tono: bien | atencion | alerta | info.
    """
    k, a = datos["kpis"], datos["kpis_anterior"]
    out = []

    def add(tono, titulo, detalle):
        out.append({"tono": tono, "titulo": titulo, "detalle": detalle})

    v = _var(k["total"], a["total"])
    if v is not None and abs(v) >= 5:
        add(
            "info",
            f"La demanda {'subió' if v > 0 else 'bajó'} {abs(v)} %",
            f"{k['total']:,} turnos frente a {a['total']:,} del periodo anterior.".replace(
                ",", "."
            ),
        )
    p = k.get("puntualidad_pct")
    if p is not None:
        if p >= 90:
            add(
                "bien",
                f"Promesa cumplida: {p} % atendidos en su franja",
                "Por encima de la meta de 90 %.",
            )
        else:
            add(
                "alerta",
                f"Puntualidad en {p} %, bajo la meta de 90 %",
                "Revisa sedes con más turnos en riesgo y la duración de las atenciones.",
            )
    if datos["por_hora"]:
        pico = max(datos["por_hora"], key=lambda h: h["total"])
        add(
            "info",
            f"Hora pico: {pico['hora']:02d}:00 – {pico['hora'] + 1:02d}:00",
            f"{pico['total']} turnos. Programa más asesores en esa franja y deja las horas bajas para alistar entregas.",
        )
    sedes = [s for s in datos["por_sede"] if s["asistencia_pct"] is not None]
    if len(sedes) > 1:
        peor = min(sedes, key=lambda s: s["asistencia_pct"])
        mejor = max(sedes, key=lambda s: s["asistencia_pct"])
        if mejor["asistencia_pct"] - peor["asistencia_pct"] >= 2:
            add(
                "atencion",
                f"{peor['nombre']}: asistencia más baja ({peor['asistencia_pct']} %)",
                f"{mejor['nombre']} llega a {mejor['asistencia_pct']} %. Considera recordatorios previos a la cita.",
            )
    c = k.get("cancelacion_pct")
    if c is not None and c >= 10:
        add(
            "atencion",
            f"Cancelaciones en {c} %",
            "Muchos cupos se liberan: revisa franjas con más cancelaciones.",
        )
    r = datos["reclamos"]
    if r["sin_atender"]:
        add(
            "alerta",
            f"{r['sin_atender']} reclamos sin atender",
            "Asigna un asesor para responderlos: el cliente ve la respuesta al consultar con su celular.",
        )
    e = datos["equipos"]
    if e["listos_por_recoger"] >= 20:
        add(
            "atencion",
            f"{e['listos_por_recoger']} equipos listos sin recoger",
            "Invita a los clientes a reservar la entrega para liberar espacio en el taller.",
        )
    orden = {"alerta": 0, "atencion": 1, "info": 2, "bien": 3}
    return sorted(out, key=lambda h: orden[h["tono"]])[:6]


def construir_tablero(desde=None, hasta=None, dias=None, punto_id=None):
    from datetime import datetime, time

    from app.horario import zona
    from app.tiempo import a_bd

    desde, hasta = _rango(desde, hasta, dias)
    largo = (hasta - desde).days + 1
    prev_hasta = desde - timedelta(days=1)
    prev_desde = prev_hasta - timedelta(days=largo - 1)

    actuales = _turnos(desde, hasta, punto_id)
    anteriores = _turnos(prev_desde, prev_hasta, punto_id)

    def a_bd_dia(d):
        return a_bd(datetime.combine(d, time.min, tzinfo=zona()))

    datos = {
        "periodo": {"desde": desde.isoformat(), "hasta": hasta.isoformat(), "dias": largo},
        "anterior": {"desde": prev_desde.isoformat(), "hasta": prev_hasta.isoformat()},
        "kpis": _kpis(actuales),
        "kpis_anterior": _kpis(anteriores),
        "por_dia": _serie_diaria(actuales, desde, hasta),
        "por_dia_anterior": [d["total"] for d in _serie_diaria(anteriores, prev_desde, prev_hasta)],
        "por_hora": _por_hora(actuales),
        "por_tramite": _ranking(actuales, "tramite", lambda o: o.nombre),
        "por_sede": _ranking(actuales, "punto", lambda o: o.nombre),
        **_taller(punto_id, a_bd_dia(desde), a_bd_dia(hasta + timedelta(days=1))),
    }
    datos["hallazgos"] = hallazgos(datos)
    return datos


def parsear_fecha(valor):
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValueError("Las fechas deben usar formato YYYY-MM-DD.") from None
