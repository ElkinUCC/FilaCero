"""Motor conversacional local del asistente FilaCero IA."""

import re
import unicodedata

# Utilidades de lenguaje y formato


def plano(texto):
    t = unicodedata.normalize("NFD", str(texto or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9ñ%:\s]", " ", t)).strip()


def _tiene(t, *claves):
    return any(re.search(rf"\b{c}", t) for c in claves)


def num(valor):
    if valor is None:
        return "—"
    if isinstance(valor, float) and not valor.is_integer():
        return f"{valor:,.1f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{int(valor):,}".replace(",", ".")


def pct(valor):
    return "sin dato" if valor is None else f"{num(valor)}\u00a0%"


def minutos(seg):
    if seg is None:
        return "sin dato"
    m, s = divmod(int(round(seg)), 60)
    return f"{m} min {s:02d} s" if m else f"{s} s"


def variacion(actual, anterior, puntos=False):
    """Texto corto: '+12 % frente al periodo anterior' o '' si no aplica."""
    if actual is None or anterior in (None, 0):
        return ""
    if puntos:
        d = actual - anterior
        if abs(d) < 0.05:
            return "igual que el periodo anterior"
        return f"{'+' if d > 0 else '−'}{num(abs(round(d, 1)))} pts frente al periodo anterior"
    d = (actual - anterior) / anterior * 100
    if abs(d) < 0.5:
        return "igual que el periodo anterior"
    return f"{'+' if d > 0 else '−'}{num(abs(round(d, 1)))} % frente al periodo anterior"


DIAS = ("lun", "mar", "mié", "jue", "vie", "sáb", "dom")
MESES = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")


def fecha(iso):
    """'2026-11-09' -> 'lun 9 nov'."""
    from datetime import date

    try:
        d = date.fromisoformat(str(iso)[:10])
    except ValueError:
        return str(iso)
    return f"{DIAS[d.weekday()]} {d.day} {MESES[d.month - 1]}"


def _tono_meta(valor, meta=90):
    if valor is None:
        return "info"
    return "bien" if valor >= meta else "atencion" if valor >= meta - 10 else "alerta"


def _franja_hora(h):
    return f"{h:02d}:00–{h + 1:02d}:00"


def _primer_nombre(nombre):
    return (nombre or "").split(" ")[0]


class Respuesta:
    def __init__(self):
        self.partes, self.tarjetas, self.acciones, self.sugerencias = [], [], [], []
        self.intenciones = []

    def texto(self, t):
        self.partes.append(t)

    def tarjeta(self, etiqueta, valor, tono="info"):
        if len(self.tarjetas) < 6 and all(x["etiqueta"] != etiqueta for x in self.tarjetas):
            self.tarjetas.append({"etiqueta": etiqueta, "valor": valor, "tono": tono})

    def accion(self, **a):
        if len(self.acciones) < 3 and a not in self.acciones:
            self.acciones.append(a)

    def sugerir(self, *preguntas):
        for p in preguntas:
            if p not in self.sugerencias:
                self.sugerencias.append(p)

    def a_dict(self, pregunta):
        vistas = plano(pregunta)
        sugerencias = [s for s in self.sugerencias if plano(s) != vistas][:4]
        return {
            "respuesta": "\n\n".join(self.partes),
            "tarjetas": self.tarjetas,
            "acciones": self.acciones,
            "sugerencias": sugerencias,
            "intenciones": self.intenciones,
            "fuente": "local",
        }


# ASISTENTE GERENCIAL (administrador y supervisor)

INTENCIONES_GERENCIALES = [
    (
        "saludo",
        ("hola", "buen", "hey", "que tal", "ayuda", "que puedes", "que sabes", "como funcionas"),
    ),
    (
        "resumen",
        (
            "resum",
            "como vamos",
            "como va",
            "como estamos",
            "estado general",
            "informe",
            "reporte",
            "panorama",
            "balance",
            "general",
        ),
    ),
    (
        "recomendaciones",
        (
            "recomend",
            "recomi",
            "suger",
            "que hago",
            "que hacemos",
            "que deberia",
            "que debemos",
            "mejorar",
            "accion",
            "plan",
            "consejo",
            "priorid",
        ),
    ),
    (
        "en_vivo",
        (
            "ahora",
            "en este momento",
            "en vivo",
            "actual",
            "libres",
            "atendiendo",
            "ocupad",
            "quien esta",
        ),
    ),
    ("manana", ("manana", "pronost", "proyecc", "predic", "proxim dia", "siguiente dia")),
    (
        "demanda",
        (
            "demanda",
            "cuantos turnos",
            "turnos",
            "reserva",
            "volumen",
            "flujo",
            "cuanta gente",
            "clientes",
        ),
    ),
    (
        "puntualidad",
        (
            "puntual",
            "a tiempo",
            "promesa",
            "dentro de su franja",
            "franja",
            "cumplimiento",
            "meta",
            "retras",
            "atras",
        ),
    ),
    (
        "asistencia",
        ("asistencia", "no asist", "ausen", "faltar", "no vinieron", "no llegaron", "inasist"),
    ),
    ("cancelaciones", ("cancel",)),
    (
        "tiempo",
        (
            "promedio",
            "duracion",
            "cuanto tarda",
            "cuanto dura",
            "tiempo de atencion",
            "demora",
            "rapid",
            "lent",
        ),
    ),
    (
        "hora_pico",
        (
            "hora pico",
            "pico",
            "a que hora",
            "horas",
            "horario mas",
            "congestion",
            "mas gente",
            "mas llen",
        ),
    ),
    ("sedes", ("sede", "sucursal", "punto", "mejor", "peor", "compar", "ranking")),
    ("tramites", ("tramite", "servicio", "mas pedid", "mas solicit")),
    ("taller", ("equipo", "taller", "televisor", "tv", "reparac", "listos", "recoger", "entreg")),
    ("reclamos", ("reclamo", "queja", "pqr", "inconform")),
    ("asesores", ("asesor", "personal", "agente", "empleado", "staff", "equipo humano")),
    ("preparacion", ("prepar", "alist")),
]


def _detectar(t, tabla):
    encontradas = [nombre for nombre, claves in tabla if _tiene(t, *claves)]
    return encontradas


def _buscar_entidad(t, nombres):
    """Devuelve el nombre cuyo texto distintivo aparece en la pregunta."""
    for nombre in nombres:
        palabras = [
            p
            for p in plano(nombre).split()
            if len(p) > 3 and p not in ("sede", "de", "del", "para")
        ]
        if palabras and all(p in t for p in palabras[:2]):
            return nombre
    for nombre in nombres:
        palabras = [p for p in plano(nombre).split() if len(p) > 4 and p not in ("sede",)]
        if any(p in t for p in palabras):
            return nombre
    return None


def responder_gerencial(pregunta, ctx):
    t = plano(pregunta)
    tab = ctx["tablero"]
    k, a = tab["kpis"], tab["kpis_anterior"]
    per = tab["periodo"]
    r = Respuesta()

    sedes = [s["nombre"] for s in tab["por_sede"]] + [s["nombre"] for s in ctx["vivo"]["sedes"]]
    sede = _buscar_entidad(t, list(dict.fromkeys(sedes)))
    tramite = _buscar_entidad(t, [x["nombre"] for x in tab["por_tramite"]])

    intenciones = _detectar(t, INTENCIONES_GERENCIALES)
    if sede and "sedes" not in intenciones:
        intenciones.append("sedes")
    if tramite and "tramites" not in intenciones:
        intenciones.append("tramites")
    # "turnos" aparece en casi todo: si hay algo más específico, manda lo específico.
    if (
        len(intenciones) > 1
        and "demanda" in intenciones
        and not _tiene(t, "demanda", "cuantos", "volumen")
    ):
        intenciones.remove("demanda")
    for general in ("saludo", "resumen"):
        if len(intenciones) > 1 and general in intenciones:
            intenciones.remove(general)
    if "sedes" in intenciones and "en_vivo" in intenciones and not sede:
        intenciones.remove("sedes")
    if not intenciones:
        intenciones = ["desconocida"]
    r.intenciones = intenciones[:3]
    periodo_txt = "hoy" if per["dias"] == 1 else f"los últimos {per['dias']} días"

    for intencion in r.intenciones:
        if intencion == "saludo":
            r.texto(
                "¡Hola! Soy el **asistente FilaCero IA**. Leo en tiempo real los turnos, las sedes, "
                "el taller y los reclamos de tu organización, y te los explico en lenguaje sencillo. "
                "Pregúntame por ejemplo cómo vamos, qué sede necesita apoyo, cuál es la hora pico "
                "o qué esperar mañana."
            )
            r.sugerir(
                "¿Cómo vamos esta semana?",
                "¿Qué me recomiendas hacer hoy?",
                "¿Cómo están las sedes ahora?",
            )

        elif intencion == "resumen":
            r.texto(
                f"**Resumen de {periodo_txt}** ({fecha(per['desde'])} a {fecha(per['hasta'])}):\n"
                f"- {num(k['total'])} turnos reservados ({variacion(k['total'], a['total']) or 'sin periodo previo para comparar'}).\n"
                f"- {num(k['atendidos'])} atendidos, asistencia de {pct(k['asistencia_pct'])}.\n"
                f"- {pct(k.get('puntualidad_pct'))} atendidos dentro de su franja (meta 90 %).\n"
                f"- Atención promedio de {minutos(k['atencion_promedio_seg'])}; cancelaciones {pct(k['cancelacion_pct'])}."
            )
            alertas = [h for h in tab["hallazgos"] if h["tono"] in ("alerta", "atencion")]
            if alertas:
                r.texto(
                    f"Lo más importante ahora: **{alertas[0]['titulo']}**. {alertas[0]['detalle']}"
                )
            r.tarjeta("Turnos", num(k["total"]))
            r.tarjeta(
                "En su franja", pct(k.get("puntualidad_pct")), _tono_meta(k.get("puntualidad_pct"))
            )
            r.tarjeta("Asistencia", pct(k["asistencia_pct"]), _tono_meta(k["asistencia_pct"]))
            r.tarjeta("Atención prom.", minutos(k["atencion_promedio_seg"]))
            r.sugerir(
                "¿Qué me recomiendas hacer?", "¿Cuál sede está peor?", "¿Cuál es la hora pico?"
            )

        elif intencion == "recomendaciones":
            recs = _recomendaciones_gerenciales(ctx)
            r.texto("**Esto haría yo, en orden de impacto:**\n" + "\n".join(f"- {x}" for x in recs))
            r.accion(tipo="navegar", destino="/admin/agentes", texto="Programar asesores")
            r.sugerir("¿Cómo están las sedes ahora?", "¿Qué esperar mañana?", "¿Cómo va el taller?")

        elif intencion == "en_vivo":
            _en_vivo(r, ctx, sede)

        elif intencion == "manana":
            m = ctx["manana"]
            prom = sum(d["total"] for d in tab["por_dia"]) / max(1, len(tab["por_dia"]))
            texto = f"Para **mañana ({fecha(m['fecha'])})** ya hay **{num(m['total'])} turnos reservados**"
            texto += f" y el promedio diario del periodo es de {num(round(prom))}."
            if m["hora_pico"]:
                texto += f" La franja más cargada por ahora es {_franja_hora(m['hora_pico']['hora'])} con {m['hora_pico']['total']} reservas."
            if m["por_sede"]:
                top = list(m["por_sede"].items())[:4]
                texto += "\n" + "\n".join(f"- {n}: {c} reservas" for n, c in top)
            if tab["por_hora"]:
                pico = max(tab["por_hora"], key=lambda h: h["total"])
                texto += f"\n\nCon el histórico, la hora pico suele ser **{_franja_hora(pico['hora'])}**: programa a tus asesores para estar completos en esa franja."
            r.texto(texto)
            r.tarjeta("Reservas mañana", num(m["total"]))
            r.tarjeta("Promedio diario", num(round(prom)))
            r.sugerir("¿Cuál es la hora pico?", "¿Cuántos asesores hay ahora?")

        elif intencion == "demanda":
            dias = tab["por_dia"]
            texto = f"En {periodo_txt} se reservaron **{num(k['total'])} turnos**"
            v = variacion(k["total"], a["total"])
            texto += f" ({v})." if v else "."
            if len(dias) > 1:
                mx = max(dias, key=lambda d: d["total"])
                mn = min(dias, key=lambda d: d["total"])
                texto += f" El día de más demanda fue el {fecha(mx['fecha'])} ({num(mx['total'])}) y el de menos el {fecha(mn['fecha'])} ({num(mn['total'])})."
            texto += f" Hay {num(k['en_curso'])} turnos todavía en curso o por atender."
            r.texto(texto)
            r.tarjeta("Turnos", num(k["total"]))
            r.tarjeta("Atendidos", num(k["atendidos"]), "bien")
            r.tarjeta("En curso", num(k["en_curso"]))
            r.sugerir("¿Qué esperar mañana?", "¿Qué trámite es el más pedido?")

        elif intencion == "puntualidad":
            p = k.get("puntualidad_pct")
            texto = f"El **{pct(p)}** de las atenciones empezó dentro de la franja reservada"
            v = variacion(p, a.get("puntualidad_pct"), puntos=True)
            texto += f" ({v})." if v else "."
            texto += f" Además, {pct(k.get('dentro_tiempo_max_pct'))} se resolvió dentro del tope de tiempo por atención."
            peores = sorted(
                [s for s in tab["por_sede"] if s.get("puntualidad_pct") is not None],
                key=lambda s: s["puntualidad_pct"],
            )
            if peores and peores[0]["puntualidad_pct"] < 90:
                texto += f" La sede con más retraso es **{peores[0]['nombre']}** ({pct(peores[0]['puntualidad_pct'])})."
            elif p is not None and p >= 90:
                texto += " Vamos por encima de la meta de 90 %: la promesa de “llega a tu hora” se está cumpliendo."
            r.texto(texto)
            r.tarjeta("En su franja", pct(p), _tono_meta(p))
            r.tarjeta(
                "Dentro del tope",
                pct(k.get("dentro_tiempo_max_pct")),
                _tono_meta(k.get("dentro_tiempo_max_pct")),
            )
            r.sugerir("¿Qué sede tiene más retrasos?", "¿Cuánto dura una atención?")

        elif intencion == "asistencia":
            texto = f"La asistencia fue de **{pct(k['asistencia_pct'])}**: {num(k['no_asistio'])} personas no se presentaron"
            v = variacion(k["asistencia_pct"], a["asistencia_pct"], puntos=True)
            texto += f" ({v})." if v else "."
            sedes_a = [s for s in tab["por_sede"] if s["asistencia_pct"] is not None]
            if len(sedes_a) > 1:
                peor = min(sedes_a, key=lambda s: s["asistencia_pct"])
                texto += f" La sede con más inasistencia es **{peor['nombre']}** ({pct(peor['asistencia_pct'])}). Un recordatorio por SMS el día anterior suele reducir las ausencias."
            r.texto(texto)
            r.tarjeta("Asistencia", pct(k["asistencia_pct"]), _tono_meta(k["asistencia_pct"]))
            r.tarjeta(
                "No asistieron", num(k["no_asistio"]), "atencion" if k["no_asistio"] else "bien"
            )
            r.sugerir("¿Y las cancelaciones?", "¿Qué me recomiendas hacer?")

        elif intencion == "cancelaciones":
            c = k["cancelacion_pct"]
            texto = f"Se cancelaron **{num(k['cancelados'])} turnos** ({pct(c)} del total)"
            v = variacion(c, a["cancelacion_pct"], puntos=True)
            texto += f", {v}." if v else "."
            texto += " Cada cancelación libera el cupo para otra persona automáticamente."
            if c is not None and c >= 10:
                texto += (
                    " Es un nivel alto: conviene revisar qué franjas concentran las cancelaciones."
                )
            r.texto(texto)
            r.tarjeta("Cancelaciones", pct(c), "atencion" if (c or 0) >= 10 else "bien")
            r.sugerir("¿Cuál es la asistencia?", "¿Qué esperar mañana?")

        elif intencion == "tiempo":
            texto = f"Una atención dura en promedio **{minutos(k['atencion_promedio_seg'])}**"
            v = variacion(k["atencion_promedio_seg"], a["atencion_promedio_seg"])
            texto += f" ({v})." if v else "."
            con_tiempo = [x for x in tab["por_tramite"] if x["atencion_promedio_seg"]]
            if con_tiempo:
                lento = max(con_tiempo, key=lambda x: x["atencion_promedio_seg"])
                rapido = min(con_tiempo, key=lambda x: x["atencion_promedio_seg"])
                texto += f" El trámite más largo es {lento['nombre']} ({minutos(lento['atencion_promedio_seg'])}) y el más ágil {rapido['nombre']} ({minutos(rapido['atencion_promedio_seg'])})."
            r.texto(texto)
            r.tarjeta("Atención prom.", minutos(k["atencion_promedio_seg"]))
            r.sugerir("¿Qué trámite es el más pedido?", "¿Cómo va la puntualidad?")

        elif intencion == "hora_pico":
            horas = tab["por_hora"]
            if not horas:
                r.texto("Aún no hay turnos suficientes en este periodo para calcular la hora pico.")
            else:
                orden = sorted(horas, key=lambda h: h["total"], reverse=True)
                pico = orden[0]
                bajas = sorted([h for h in horas if h["total"] > 0], key=lambda h: h["total"])[:2]
                texto = f"La hora pico es **{_franja_hora(pico['hora'])}** con {num(pico['total'])} turnos en {periodo_txt}."
                if len(orden) > 2:
                    texto += f" Le siguen {_franja_hora(orden[1]['hora'])} ({num(orden[1]['total'])}) y {_franja_hora(orden[2]['hora'])} ({num(orden[2]['total'])})."
                if bajas:
                    texto += (
                        " Las horas más tranquilas ("
                        + ", ".join(_franja_hora(b["hora"]) for b in bajas)
                        + ") son ideales para alistar entregas y garantías."
                    )
                r.texto(texto)
                r.tarjeta("Hora pico", _franja_hora(pico["hora"]), "atencion")
                r.tarjeta("Turnos en el pico", num(pico["total"]))
            r.sugerir("¿Cuántos asesores hay ahora?", "¿Qué esperar mañana?")

        elif intencion == "sedes":
            _sedes(r, tab, sede)

        elif intencion == "tramites":
            filas = tab["por_tramite"]
            if tramite:
                x = next(f for f in filas if f["nombre"] == tramite)
                r.texto(
                    f"**{x['nombre']}**: {num(x['total'])} turnos ({pct(round(100 * x['total'] / max(1, k['total']), 1))} de la demanda), "
                    f"asistencia {pct(x['asistencia_pct'])}, {pct(x['puntualidad_pct'])} dentro de su franja y atención promedio de {minutos(x['atencion_promedio_seg'])}."
                )
                r.tarjeta("Turnos", num(x["total"]))
                r.tarjeta(
                    "En su franja", pct(x["puntualidad_pct"]), _tono_meta(x["puntualidad_pct"])
                )
            elif filas:
                top = filas[:5]
                r.texto(
                    "**Trámites más pedidos:**\n"
                    + "\n".join(
                        f"- {f['nombre']}: {num(f['total'])} ({pct(round(100 * f['total'] / max(1, k['total']), 1))})"
                        for f in top
                    )
                )
                r.tarjeta("Más pedido", top[0]["nombre"])
            r.sugerir("¿Cuánto dura una atención?", "¿Cuál es la hora pico?")

        elif intencion == "taller":
            e = tab["equipos"]
            pe = e["por_estado"]
            texto = (
                f"En el taller hay **{num(e['en_taller'])} equipos** ({num(pe.get('RECIBIDO', 0))} recibidos y "
                f"{num(pe.get('EN_REPARACION', 0))} en reparación) y **{num(e['listos_por_recoger'])} listos por recoger**. "
                f"En {periodo_txt} entraron {num(e['recibidos_periodo'])} y se entregaron {num(e['entregados_periodo'])}."
            )
            if e["listos_por_recoger"] >= 20:
                texto += " Hay muchos equipos esperando: invita a esos clientes a reservar la entrega para liberar espacio."
            r.texto(texto)
            r.tarjeta("En taller", num(e["en_taller"]))
            r.tarjeta(
                "Listos por recoger",
                num(e["listos_por_recoger"]),
                "atencion" if e["listos_por_recoger"] >= 20 else "bien",
            )
            r.sugerir("¿Cómo van los reclamos?", "¿Qué me recomiendas hacer?")

        elif intencion == "reclamos":
            rc = tab["reclamos"]
            texto = (
                f"Hay **{num(rc['abiertos'])} reclamos abiertos**, de los cuales **{num(rc['sin_atender'])} siguen sin atender**. "
                f"Se han resuelto {num(rc['resueltos'])}"
            )
            texto += (
                f" con un tiempo de respuesta promedio de {num(rc['respuesta_promedio_horas'])} h."
                if rc["respuesta_promedio_horas"] is not None
                else "."
            )
            if rc["sin_atender"]:
                texto += " Prioriza los más antiguos: cada asesor los ve en su pestaña «Reclamos»."
            r.texto(texto)
            r.tarjeta(
                "Sin atender", num(rc["sin_atender"]), "alerta" if rc["sin_atender"] else "bien"
            )
            r.tarjeta("Resueltos", num(rc["resueltos"]), "bien")
            r.sugerir("¿Cómo va el taller?", "¿Qué me recomiendas hacer?")

        elif intencion == "asesores":
            _en_vivo(r, ctx, sede, enfoque="asesores")

        elif intencion == "preparacion":
            r.texto(
                f"El **{pct(k['preparados_pct'])}** de las entregas y garantías se alistó antes de que el cliente llegara. "
                "Alistar con anticipación acorta la atención en sede y evita que el cliente espere."
            )
            r.tarjeta("Alistados", pct(k["preparados_pct"]), _tono_meta(k["preparados_pct"], 80))
            r.sugerir("¿Cuánto dura una atención?", "¿Cómo va el taller?")

        else:  # desconocida
            r.texto(
                "No estoy seguro de haber entendido. Puedo responderte sobre **demanda, puntualidad, asistencia, "
                "cancelaciones, hora pico, sedes, trámites, taller, reclamos, asesores en vivo y lo que viene mañana**."
            )
            r.sugerir(
                "¿Cómo vamos esta semana?",
                "¿Cómo están las sedes ahora?",
                "¿Qué me recomiendas hacer?",
            )

    r.sugerir("¿Cómo vamos esta semana?", "¿Qué me recomiendas hacer?")
    return r.a_dict(pregunta)


def _sedes(r, tab, sede):
    filas = tab["por_sede"]
    if not filas:
        r.texto("No hay turnos en el periodo para comparar sedes.")
        return
    if sede:
        x = next((f for f in filas if f["nombre"] == sede), None)
        if not x:
            r.texto(f"{sede} no tiene turnos en este periodo.")
            return
        posicion = [f["nombre"] for f in filas].index(sede) + 1
        r.texto(
            f"**{x['nombre']}** atendió {num(x['atendidos'])} de {num(x['total'])} turnos "
            f"(puesto {posicion} de {len(filas)} en demanda). Asistencia {pct(x['asistencia_pct'])}, "
            f"{pct(x['puntualidad_pct'])} dentro de su franja y atención promedio de {minutos(x['atencion_promedio_seg'])}."
        )
        r.tarjeta("Turnos", num(x["total"]))
        r.tarjeta("Asistencia", pct(x["asistencia_pct"]), _tono_meta(x["asistencia_pct"]))
        r.tarjeta("En su franja", pct(x["puntualidad_pct"]), _tono_meta(x["puntualidad_pct"]))
        r.sugerir(f"¿Cómo está {x['nombre']} ahora?", "¿Cuál sede está peor?")
        return
    con = [f for f in filas if f["asistencia_pct"] is not None]
    texto = "**Sedes ordenadas por demanda:**\n" + "\n".join(
        f"- {f['nombre']}: {num(f['total'])} turnos · asistencia {pct(f['asistencia_pct'])} · en franja {pct(f['puntualidad_pct'])}"
        for f in filas
    )
    if len(con) > 1:

        def puntaje(f):
            return (f["asistencia_pct"] or 0) + (f["puntualidad_pct"] or 0)

        mejor, peor = max(con, key=puntaje), min(con, key=puntaje)
        texto += f"\n\nLa de mejor desempeño es **{mejor['nombre']}** y la que más necesita apoyo es **{peor['nombre']}**."
        r.tarjeta("Mejor sede", mejor["nombre"], "bien")
        r.tarjeta("Necesita apoyo", peor["nombre"], "atencion")
        r.sugerir(f"¿Cómo está {peor['nombre']}?")
    r.texto(texto)
    r.sugerir("¿Cómo están las sedes ahora?")


def _en_vivo(r, ctx, sede=None, enfoque="sedes"):
    sedes = ctx["vivo"]["sedes"]
    if sede:
        sedes = [s for s in sedes if s["nombre"] == sede] or sedes
    asesores = [a for s in sedes for a in s["asesores"]]
    atendiendo = sum(1 for a in asesores if a["estado"] in ("EN_ATENCION", "LLAMADO"))
    libres = sum(1 for a in asesores if a["estado"] == "LIBRE")
    pausa = sum(1 for a in asesores if a["estado"] in ("PAUSA", "ALMUERZO"))
    esperan = sum(s["en_espera_hoy"] for s in sedes)
    riesgo = sum(s["en_riesgo"] for s in sedes)
    lineas = []
    for s in sedes:
        f = s["franja_actual"]
        franja = (
            f"franja {f['inicio']}–{f['fin']}: {f['reservados']}/{f['capacidad']} cupos"
            if f
            else "fuera de horario"
        )
        proxima = f", próximo turno {s['proxima']['hora']}" if s.get("proxima") else ""
        lineas.append(
            f"- **{s['nombre']}**: {len(s['asesores'])} asesores, {s['en_espera_hoy']} esperan hoy{proxima}; {franja}"
            + (f"; ⚠ {s['en_riesgo']} en riesgo" if s["en_riesgo"] else "")
        )
    titulo = (
        "**Así está la operación en este momento:**"
        if enfoque == "sedes"
        else "**Tu equipo de asesores ahora mismo:**"
    )
    r.texto(
        f"{titulo} {len(asesores)} asesores en sede ({atendiendo} atendiendo, {libres} libres, {pausa} en pausa) "
        f"y {esperan} personas por atender hoy.\n" + "\n".join(lineas)
    )
    if riesgo:
        r.texto(
            f"Hay **{riesgo} turnos en riesgo** de salirse de su franja: conviene mover un asesor libre a esa sede."
        )
    r.tarjeta("Asesores en sede", num(len(asesores)))
    r.tarjeta("Atendiendo", num(atendiendo))
    r.tarjeta("Libres", num(libres), "bien" if libres else "atencion")
    r.tarjeta("En riesgo", num(riesgo), "alerta" if riesgo else "bien")
    r.accion(tipo="navegar", destino="/admin/agentes", texto="Ver asesores")
    r.sugerir("¿Qué esperar mañana?", "¿Cuál es la hora pico?")


def _recomendaciones_gerenciales(ctx):
    tab = ctx["tablero"]
    k = tab["kpis"]
    recs = []
    riesgo = sum(s["en_riesgo"] for s in ctx["vivo"]["sedes"])
    if riesgo:
        sedes = ", ".join(s["nombre"] for s in ctx["vivo"]["sedes"] if s["en_riesgo"])
        recs.append(
            f"Hay {riesgo} turnos en riesgo ahora en {sedes}: refuerza esa sede con un asesor libre."
        )
    if tab["reclamos"]["sin_atender"]:
        recs.append(
            f"Asigna los {tab['reclamos']['sin_atender']} reclamos sin atender; el tiempo de respuesta impacta la satisfacción."
        )
    p = k.get("puntualidad_pct")
    if p is not None and p < 90:
        recs.append(
            f"La puntualidad está en {pct(p)}, bajo la meta: revisa la duración de las atenciones y la cantidad de asesores en la hora pico."
        )
    sedes = [s for s in tab["por_sede"] if s["asistencia_pct"] is not None]
    if sedes:
        peor = min(sedes, key=lambda s: s["asistencia_pct"])
        if peor["asistencia_pct"] < 95:
            recs.append(
                f"{peor['nombre']} tiene la asistencia más baja ({pct(peor['asistencia_pct'])}): activa recordatorios el día anterior."
            )
    if tab["por_hora"]:
        pico = max(tab["por_hora"], key=lambda h: h["total"])
        recs.append(
            f"Programa al equipo completo en la hora pico {_franja_hora(pico['hora'])} y usa las horas bajas para alistar entregas."
        )
    if tab["equipos"]["listos_por_recoger"] >= 20:
        recs.append(
            f"{tab['equipos']['listos_por_recoger']} equipos están listos sin recoger: contacta a esos clientes para que reserven la entrega."
        )
    c = k.get("cancelacion_pct")
    if c is not None and c >= 10:
        recs.append(
            f"Las cancelaciones están en {pct(c)}: revisa si hay franjas poco convenientes."
        )
    if ctx["manana"]["total"]:
        recs.append(
            f"Mañana ya hay {ctx['manana']['total']} reservas: confirma la programación de asesores hoy."
        )
    return recs[:5] or [
        "Todo está dentro de las metas. Mantén la programación actual y revisa el tablero en la hora pico."
    ]


# COPILOTO DEL ASESOR

INTENCIONES_ASESOR = [
    ("saludo", ("hola", "buen", "hey", "ayuda", "que puedes", "que sabes")),
    (
        "recomendacion",
        (
            "que hago",
            "que debo",
            "que sigue hacer",
            "recomend",
            "recomi",
            "suger",
            "consejo",
            "ahora que",
        ),
    ),
    (
        "siguiente",
        ("quien sigue", "siguiente", "proxim", "a quien llamo", "a quien llamar", "llamar"),
    ),
    ("actual", ("atendiendo", "cliente actual", "quien tengo", "turno actual", "en el puesto")),
    ("riesgo", ("riesgo", "atrasad", "tarde", "retras", "urgente", "prioridad")),
    ("preparar", ("prepar", "alist", "pendiente")),
    (
        "jornada",
        (
            "como voy",
            "mi jornada",
            "rendimiento",
            "estadistic",
            "cuantos he",
            "cuantos atend",
            "mis numeros",
            "desempeno",
            "promedio",
        ),
    ),
    ("franja", ("franja", "cuanto queda", "tiempo queda", "cuantos minutos", "hora")),
    (
        "cola",
        ("cola", "cuantos hay", "cuanta gente", "esperando", "personas", "manana", "proximos dias"),
    ),
    ("reclamos", ("reclamo", "mensaje", "queja", "chat")),
    ("pausa", ("pausa", "descanso", "almuerzo", "break")),
    ("horario", ("horario", "abren", "cierran")),
]


def _buscar_persona(t, cola):
    for turno in cola:
        partes = [p for p in plano(turno["usuario_nombre"]).split() if len(p) > 2]
        if len(partes) >= 2 and partes[0] in t and partes[1] in t:
            return turno
        codigo = plano(turno.get("codigo_corto") or "").replace(" ", "")
        if codigo and codigo[-6:] in t.replace(" ", ""):
            return turno
    for turno in cola:
        nombre = plano(turno["usuario_nombre"]).split()
        if nombre and re.search(rf"\b{re.escape(nombre[0])}\b", t) and len(nombre[0]) > 3:
            return turno
    return None


def _describir_turno(t):
    texto = (
        f"**{t['usuario_nombre']}** ({t.get('codigo_corto')}) · {t['tramite_nombre']}, reservó "
        f"{t['hora_inicio']}–{t['hora_fin']}"
    )
    if t.get("inicio_proyectado") and t.get("es_hoy"):
        texto += f"; inicio proyectado {t['inicio_proyectado']}"
    if t.get("equipo"):
        e = t["equipo"]
        texto += (
            f". Equipo: {e['marca']} {e['modelo']} ({e['codigo']}), {e['estado_texto'].lower()}"
        )
    if t.get("preparacion"):
        texto += f". Preparación: {t['preparacion'].get('texto', t['preparacion'].get('estado'))}"
    elif t.get("requiere_preparacion"):
        texto += ". Requiere preparación previa y aún no se ha alistado"
    if t.get("detalle_necesidad"):
        texto += f". Necesidad: «{t['detalle_necesidad']}»"
    return texto + "."


ETIQUETA_PUNTUALIDAD = {
    "a_tiempo": "a tiempo",
    "en_riesgo": "en riesgo",
    "atrasado": "atrasado",
    "proxima": "próxima franja",
}


def responder_asesor(pregunta, ctx):
    t = plano(pregunta)
    p = ctx["panel"]
    cola = p["cola"]
    hoy = [x for x in cola if x["es_hoy"]]
    res = p["resumen"]
    rec = p["recomendacion"]
    actual = p["actual"]
    r = Respuesta()

    persona = _buscar_persona(t, ([actual] if actual else []) + cola)
    intenciones = _detectar(t, INTENCIONES_ASESOR)
    if persona:
        intenciones = ["persona"] + [i for i in intenciones if i not in ("siguiente", "cola")]
    if len(intenciones) > 1 and "saludo" in intenciones:
        intenciones.remove("saludo")
    if not intenciones:
        intenciones = ["desconocida"]
    r.intenciones = intenciones[:3]

    if p.get("error"):
        r.texto(f"Antes de empezar: {p['error']} Elige tu sede en la barra superior.")

    for intencion in r.intenciones:
        if intencion == "saludo":
            nombre = _primer_nombre(p["agente"]["nombre"])
            r.texto(
                f"¡Hola, {nombre}! Soy tu **copiloto FilaCero IA**. Conozco tu cola, la franja en curso, "
                "los equipos por entregar y tu jornada. Pregúntame a quién llamar, qué alistar o cómo vas."
            )
            r.sugerir("¿Quién sigue?", "¿Qué debo hacer ahora?", "¿Cómo voy hoy?")

        elif intencion == "persona":
            r.texto(_describir_turno(persona))
            if persona.get("puntualidad"):
                r.tarjeta(
                    "Puntualidad",
                    ETIQUETA_PUNTUALIDAD.get(persona["puntualidad"], persona["puntualidad"]),
                    (
                        "alerta"
                        if persona["puntualidad"] == "atrasado"
                        else "atencion" if persona["puntualidad"] == "en_riesgo" else "bien"
                    ),
                )
            if persona.get("estado") == "ESPERANDO" and persona.get("es_hoy") and not actual:
                r.accion(
                    tipo="llamar",
                    turno_id=persona["id"],
                    texto=f"Llamar a {_primer_nombre(persona['usuario_nombre'])}",
                )
            if persona.get("requiere_preparacion") or persona.get("preparacion"):
                r.accion(tipo="preparar", turno_id=persona["id"], texto="Preparar pedido")
            r.sugerir("¿Quién sigue?", "¿Qué tengo que alistar?")

        elif intencion == "recomendacion":
            if rec:
                r.texto(f"**{rec['titulo']}.** {rec['motivo']}")
                if rec.get("turno_id") and rec["accion"] in (
                    "llamar",
                    "adelantar",
                    "pausa",
                    "preparar",
                ):
                    if rec["accion"] == "preparar":
                        r.accion(
                            tipo="preparar",
                            turno_id=rec["turno_id"],
                            texto=f"Alistar lo de {_primer_nombre(rec.get('turno_nombre'))}",
                        )
                    else:
                        r.accion(
                            tipo="llamar",
                            turno_id=rec["turno_id"],
                            texto=f"Llamar a {_primer_nombre(rec.get('turno_nombre'))}",
                        )
            else:
                r.texto(
                    "No tengo una recomendación en este momento. Revisa que tengas sede asignada y estés en horario."
                )
            r.sugerir("¿Quién sigue?", "¿Hay alguien en riesgo?")

        elif intencion == "siguiente":
            if actual:
                r.texto(
                    f"Primero termina con **{actual['usuario_nombre']}** ({actual['tramite_nombre']})."
                )
            if hoy:
                s = hoy[0]
                r.texto("Sigue " + _describir_turno(s))
                r.tarjeta("Inicio proyectado", s["inicio_proyectado"])
                r.tarjeta(
                    "Puntualidad",
                    ETIQUETA_PUNTUALIDAD.get(s["puntualidad"], s["puntualidad"]),
                    (
                        "alerta"
                        if s["puntualidad"] == "atrasado"
                        else "atencion" if s["puntualidad"] == "en_riesgo" else "bien"
                    ),
                )
                if not actual:
                    r.accion(
                        tipo="llamar",
                        turno_id=s["id"],
                        texto=f"Llamar a {_primer_nombre(s['usuario_nombre'])}",
                    )
                if len(hoy) > 1:
                    r.texto(
                        "Después: "
                        + ", ".join(f"{x['usuario_nombre']} ({x['hora_inicio']})" for x in hoy[1:4])
                        + "."
                    )
            elif not actual and cola:
                r.texto(
                    f"No hay más turnos para hoy. El próximo es el {fecha(cola[0]['fecha'])}: "
                    + _describir_turno(cola[0])
                )
                r.tarjeta("Próximos días", num(len(cola)))
            elif not actual:
                r.texto("Tu cola está vacía por ahora. Te aviso apenas llegue una reserva.")
            r.sugerir("¿Qué tengo que alistar?", "¿Cómo voy hoy?")

        elif intencion == "actual":
            if actual:
                r.texto("Estás con " + _describir_turno(actual))
                if actual["estado"] == "EN_ATENCION":
                    r.texto(
                        f"Recuerda el tope de {round(p['max_atencion_seg'] / 60)} minutos por atención para no afectar la franja."
                    )
            else:
                r.texto("No tienes a nadie en el puesto en este momento.")
            r.sugerir("¿Quién sigue?")

        elif intencion == "riesgo":
            riesgo = [x for x in hoy if x["puntualidad"] in ("en_riesgo", "atrasado")]
            if riesgo:
                r.texto(
                    f"**{len(riesgo)} turnos en riesgo** de salirse de su franja:\n"
                    + "\n".join(
                        f"- {x['usuario_nombre']} · {x['hora_inicio']} · {ETIQUETA_PUNTUALIDAD[x['puntualidad']]}"
                        for x in riesgo[:5]
                    )
                )
                if not actual:
                    r.accion(
                        tipo="llamar",
                        turno_id=riesgo[0]["id"],
                        texto=f"Llamar a {_primer_nombre(riesgo[0]['usuario_nombre'])}",
                    )
            else:
                r.texto("Nadie está en riesgo: todos los turnos de hoy van a tiempo. 👌")
            r.tarjeta("En riesgo", num(len(riesgo)), "alerta" if riesgo else "bien")
            r.sugerir("¿Quién sigue?", "¿Puedo tomar una pausa?")

        elif intencion == "preparar":
            pendientes = [
                x
                for x in cola
                if x.get("requiere_preparacion")
                and (
                    not x.get("preparacion")
                    or x["preparacion"].get("estado") in ("PENDIENTE", "NOVEDAD")
                )
            ]
            if pendientes:
                r.texto(
                    f"Tienes **{len(pendientes)} pedidos por alistar** antes de que lleguen:\n"
                    + "\n".join(
                        f"- {x['usuario_nombre']} · {x['tramite_nombre']} · {'hoy' if x['es_hoy'] else fecha(x['fecha'])} {x['hora_inicio']}"
                        + (
                            f" · {x['equipo']['marca']} {x['equipo']['modelo']}"
                            if x.get("equipo")
                            else ""
                        )
                        for x in pendientes[:5]
                    )
                )
                r.accion(
                    tipo="preparar",
                    turno_id=pendientes[0]["id"],
                    texto=f"Alistar lo de {_primer_nombre(pendientes[0]['usuario_nombre'])}",
                )
            else:
                r.texto("No tienes pedidos pendientes por alistar. ¡Todo listo!")
            r.tarjeta("Por alistar", num(len(pendientes)), "atencion" if pendientes else "bien")
            r.sugerir("¿Quién sigue?", "¿Cómo voy hoy?")

        elif intencion == "jornada":
            punt = res.get("puntualidad_pct")
            r.texto(
                f"Hoy llevas **{num(res.get('atendidos_hoy', 0))} atenciones**"
                + (
                    f" y {num(res['no_asistio_hoy'])} {'persona no asistió' if res['no_asistio_hoy'] == 1 else 'personas no asistieron'}. "
                    if res.get("no_asistio_hoy")
                    else ". "
                )
                + f"Tu promedio es de {minutos(res.get('promedio_hoy_segundos'))} por persona y el {pct(punt)} empezó dentro de su franja."
                + (
                    " ¡Vas muy bien, por encima de la meta!"
                    if punt is not None and punt >= 90
                    else ""
                )
            )
            r.tarjeta("Atendidos", num(res.get("atendidos_hoy", 0)), "bien")
            r.tarjeta("Promedio", minutos(res.get("promedio_hoy_segundos")))
            r.tarjeta("En su franja", pct(punt), _tono_meta(punt))
            r.sugerir("¿Quién sigue?", "¿Hay alguien en riesgo?")

        elif intencion == "franja":
            f = p["franja_actual"]
            if f:
                m, s = divmod(int(f["restante_seg"]), 60)
                r.texto(
                    f"Estás en la franja **{f['inicio']}–{f['fin']}**: quedan {m} min {s:02d} s. "
                    f"Van {f['atendidos']} de {f['reservados']} atendidos (cupo {f['capacidad']}, {f['asesores']} asesores en sede)."
                )
                r.tarjeta(
                    "Queda de franja",
                    f"{m}:{s:02d}",
                    "atencion" if f["restante_seg"] < 300 else "info",
                )
            else:
                h = p["horario"]
                r.texto(
                    f"Ahora estás fuera del horario de atención ({h['hora_apertura']}–{h['hora_cierre']})."
                )
            r.sugerir("¿Quién sigue?", "¿Puedo tomar una pausa?")

        elif intencion == "cola":
            proximos = [x for x in cola if not x["es_hoy"]]
            r.texto(
                f"En tu cola hay **{len(hoy)} personas para hoy** y {len(proximos)} en los próximos días."
                + (
                    f" La primera de hoy es {hoy[0]['usuario_nombre']} a las {hoy[0]['hora_inicio']}."
                    if hoy
                    else ""
                )
            )
            r.tarjeta("Hoy", num(len(hoy)))
            r.tarjeta("Próximos días", num(len(proximos)))
            r.sugerir("¿Quién sigue?", "¿Qué tengo que alistar?")

        elif intencion == "reclamos":
            rc = ctx["reclamos"]
            r.texto(
                f"En tu sede hay **{rc['sin_atender']} reclamos sin atender** y {rc['en_gestion']} en gestión. "
                "Respóndelos en la pestaña «Reclamos»: el cliente ve tu última respuesta en «Consultar mi turno»."
            )
            r.accion(tipo="seccion", destino="reclamos", texto="Abrir reclamos")
            r.tarjeta(
                "Sin atender", num(rc["sin_atender"]), "alerta" if rc["sin_atender"] else "bien"
            )

        elif intencion == "pausa":
            if rec and rec.get("accion") in ("pausa", "adelantar") and rec.get("pausa_seg"):
                r.texto(
                    f"Sí, puedes tomar una pausa corta de {round(rec['pausa_seg'] / 60)} min: {rec['motivo']}"
                )
            elif actual or (hoy and hoy[0]["puntualidad"] in ("en_riesgo", "atrasado")):
                r.texto(
                    "Mejor no ahora: hay personas que necesitan atención para no salirse de su franja."
                )
            else:
                r.texto(
                    "La franja va a tiempo. Si necesitas una pausa, cambia tu estado a «En pausa» en la barra superior."
                )
            r.sugerir("¿Quién sigue?")

        elif intencion == "horario":
            h = p["horario"]
            dias = "todos los días" if h["todos_los_dias"] else ", ".join(h["dias"])
            r.texto(
                f"Se atiende {dias} de {h['hora_apertura']} a {h['hora_cierre']}, en franjas de {h['duracion_franja_min']} minutos."
            )

        else:
            r.texto(
                "No te entendí del todo. Puedo decirte **quién sigue**, **qué hacer ahora**, **quién está en riesgo**, "
                "**qué alistar**, **cómo va tu jornada** o darte el detalle de una persona si me dices su nombre."
            )
            r.sugerir("¿Quién sigue?", "¿Qué debo hacer ahora?", "¿Cómo voy hoy?")

    r.sugerir("¿Quién sigue?", "¿Qué debo hacer ahora?")
    return r.a_dict(pregunta)


def responder(pregunta, ctx):
    if ctx["rol"] == "asesor":
        return responder_asesor(pregunta, ctx)
    return responder_gerencial(pregunta, ctx)


SUGERENCIAS_INICIALES = {
    "gerencial": [
        "¿Cómo vamos esta semana?",
        "¿Qué me recomiendas hacer hoy?",
        "¿Cómo están las sedes ahora?",
        "¿Cuál es la hora pico?",
        "¿Qué esperar mañana?",
        "¿Cómo va el taller?",
    ],
    "asesor": [
        "¿Quién sigue?",
        "¿Qué debo hacer ahora?",
        "¿Hay alguien en riesgo?",
        "¿Qué tengo que alistar?",
        "¿Cómo voy hoy?",
    ],
}
