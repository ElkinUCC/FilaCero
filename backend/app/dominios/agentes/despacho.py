"""Asistente inteligente de despacho de FilaCero.

Objetivo de negocio: quien reserva la franja 16:00-16:30 debe empezar a ser
atendido dentro de esa franja. Para lograrlo el asistente combina:

1. Predicción de duración por trámite (regresión lineal sobre el historial
   de la sede, con tope en DURACION_MAX_ATENCION_MIN).
2. Planificación EDF (Earliest Deadline First): se atiende primero el turno
   cuya franja vence antes; se proyecta la hora de inicio de cada turno
   repartiendo la cola entre los asesores activos de la sede.
3. Reglas de recomendación para el asesor: llamar ya, pausa activa,
   adelantar un turno de la siguiente franja, cerrar la atención o marcar
   ausente.
"""

from datetime import UTC, datetime, timedelta

from flask import current_app

from app import db
from app.dominios.franjas.modelos import Franja
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.repositorios import consulta_cola
from app.dominios.usuarios.modelos import Usuario
from app.horario import (
    ahora_local,
    apertura,
    cierre,
    cupos_por_asesor,
    duracion_franja_min,
    duracion_max_atencion_min,
    zona,
)

ESPERA_LLEGADA_SEG = 3 * 60  # tras llamar, si no llega en 3 min se sugiere "no asistió"


# ----------------------------------------------------------------------
# Utilidades de tiempo
# ----------------------------------------------------------------------


def _local(dt_utc_naive):
    """Fechas guardadas en UTC sin zona -> hora local con zona."""
    if dt_utc_naive is None:
        return None
    return dt_utc_naive.replace(tzinfo=UTC).astimezone(zona())


def _limites_franja(turno):
    inicio = datetime.combine(turno.franja.fecha, turno.franja.hora_inicio, tzinfo=zona())
    fin = datetime.combine(turno.franja.fecha, turno.franja.hora_fin, tzinfo=zona())
    return inicio, fin


def franja_actual(ahora=None):
    """Franja de reloj vigente (p. ej. 12:00-12:30) o None fuera de horario."""
    ahora = ahora or ahora_local()
    paso = duracion_franja_min()
    abre = datetime.combine(ahora.date(), apertura(), tzinfo=zona())
    cierra = datetime.combine(ahora.date(), cierre(), tzinfo=zona())
    if not abre <= ahora < cierra:
        return None
    minutos = int((ahora - abre).total_seconds() // 60)
    inicio = abre + timedelta(minutes=(minutos // paso) * paso)
    fin = min(inicio + timedelta(minutes=paso), cierra)
    return {"inicio": inicio, "fin": fin}


# ----------------------------------------------------------------------
# 1. Predicción de duración
# ----------------------------------------------------------------------


def duracion_estimada_seg(punto_id, tramite, cache=None):
    """Duración esperada de una atención (segundos), con tope de negocio."""
    clave = (punto_id, tramite.id if tramite else None)
    if cache is not None and clave in cache:
        return cache[clave]

    tope = duracion_max_atencion_min() * 60
    historial = (
        db.session.query(Turno.fecha_inicio, Turno.fecha_fin)
        .filter(
            Turno.estado == "ATENDIDO",
            Turno.punto_id == punto_id,
            Turno.tramite_id == (tramite.id if tramite else None),
            Turno.fecha_inicio.isnot(None),
            Turno.fecha_fin.isnot(None),
        )
        .order_by(Turno.fecha_fin.desc())
        .limit(60)
        .all()
    )
    duraciones = [(f - i).total_seconds() for i, f in historial if f and i and f > i]

    if len(duraciones) >= 5:
        # Regresión lineal sobre la secuencia: capta si el equipo va más
        # rápido o más lento en las últimas atenciones.
        valores = list(reversed(duraciones))
        n = len(valores)
        x_media = (n - 1) / 2
        y_media = sum(valores) / n
        den = sum((i - x_media) ** 2 for i in range(n))
        pendiente = (
            sum((i - x_media) * (y - y_media) for i, y in enumerate(valores)) / den if den else 0
        )
        estimada = y_media + pendiente * (n - 1 - x_media)
        fuente = "historial"
    elif duraciones:
        estimada = sorted(duraciones)[len(duraciones) // 2]
        fuente = "historial"
    else:
        estimada = (tramite.tiempo_estimado if tramite else 10) * 60
        fuente = "trámite"

    resultado = (int(max(60, min(estimada, tope))), fuente)
    if cache is not None:
        cache[clave] = resultado
    return resultado


# ----------------------------------------------------------------------
# 2. Proyección EDF de la cola
# ----------------------------------------------------------------------


def _disponibilidad_asesores(punto_id, ahora, cache):
    """Momento en que cada asesor activo de la sede queda libre."""
    asesores = Usuario.query.filter_by(rol="AGENTE", activo=True, punto_asignado_id=punto_id).all()
    libres = []
    for asesor in asesores:
        activo = Turno.query.filter(
            Turno.agente_id == asesor.id,
            Turno.estado.in_(("LLAMADO", "EN_ATENCION")),
        ).first()
        if not activo:
            libres.append(ahora)
            continue
        duracion, _ = duracion_estimada_seg(punto_id, activo.tramite, cache)
        inicio = _local(activo.fecha_inicio) or ahora
        libres.append(max(ahora, inicio + timedelta(seconds=duracion)))
    return sorted(libres) or [ahora]


def proyectar_cola(punto_id, ahora=None, cache=None):
    """Devuelve la cola en orden EDF con su proyección de puntualidad."""
    ahora = ahora or ahora_local()
    cache = {} if cache is None else cache
    cola = consulta_cola(punto_id).all()  # ya viene ordenada por fecha/hora de franja
    libres = _disponibilidad_asesores(punto_id, ahora, cache)

    proyeccion = []
    for turno in cola:
        inicio_f, fin_f = _limites_franja(turno)
        duracion, fuente = duracion_estimada_seg(punto_id, turno.tramite, cache)

        # Se asigna al asesor que se libere primero; no antes de su franja
        # (el ciudadano llega a su hora), salvo que el asesor lo adelante.
        indice = min(range(len(libres)), key=lambda i: libres[i])
        inicio = max(libres[indice], inicio_f)
        fin = inicio + timedelta(seconds=duracion)
        libres[indice] = fin

        if fin_f <= ahora:
            puntualidad = "atrasado"
        elif inicio > fin_f - timedelta(minutes=1) or (
            inicio_f <= ahora and inicio > fin_f - timedelta(seconds=duracion // 2)
        ):
            puntualidad = "en_riesgo"
        elif inicio_f > ahora:
            puntualidad = "proxima"
        else:
            puntualidad = "a_tiempo"

        proyeccion.append(
            {
                "turno": turno,
                "inicio_proyectado": inicio,
                "fin_proyectado": fin,
                "duracion_estimada_seg": duracion,
                "fuente_estimacion": fuente,
                "puntualidad": puntualidad,
                "margen_seg": int((fin_f - inicio).total_seconds()),
                "franja_inicio": inicio_f,
                "franja_fin": fin_f,
            }
        )
    return proyeccion


# ----------------------------------------------------------------------
# 3. Recomendación para el asesor
# ----------------------------------------------------------------------


def corto(turno):
    """Código visible del turno: los 6 caracteres finales (igual que en la sala)."""
    return turno.codigo_corto if turno else None


def nombre_de(turno, completo=True):
    if not turno or not turno.usuario:
        return "la persona"
    nombre = turno.usuario.nombre
    return nombre if completo else nombre.split()[0]


def _rec(accion, titulo, motivo, nivel="normal", turno=None, pausa_seg=0):
    return {
        "accion": accion,
        "titulo": titulo,
        "motivo": motivo,
        "nivel": nivel,
        "turno_id": turno.id if turno else None,
        "turno_codigo": turno.codigo if turno else None,
        "turno_corto": corto(turno),
        "turno_nombre": nombre_de(turno),
        "pausa_seg": pausa_seg,
    }


def _ultima_atencion(agente_id, ahora):
    turno = (
        Turno.query.filter(
            Turno.agente_id == agente_id, Turno.estado == "ATENDIDO", Turno.fecha_fin.isnot(None)
        )
        .order_by(Turno.fecha_fin.desc())
        .first()
    )
    if not turno:
        return None
    fin = _local(turno.fecha_fin)
    if fin.date() != ahora.date():
        return None
    duracion = (
        (turno.fecha_fin - turno.fecha_inicio).total_seconds() if turno.fecha_inicio else None
    )
    return {"fin": fin, "duracion_seg": duracion, "codigo": turno.codigo}


def recomendar(agente, activo, proyeccion, ahora):
    maximo = duracion_max_atencion_min() * 60
    pausa_base = int(current_app.config.get("PAUSA_ACTIVA_SEG", 90))
    en_riesgo = [p for p in proyeccion if p["puntualidad"] in ("atrasado", "en_riesgo")]

    # --- El asesor tiene un turno abierto -------------------------------
    if activo and activo.estado == "LLAMADO":
        llamado_en = _local(activo.fecha_llamado)
        if llamado_en and (ahora - llamado_en).total_seconds() > ESPERA_LLEGADA_SEG:
            return _rec(
                "ausente",
                "La persona no se ha presentado",
                "Pasaron más de 3 minutos desde el llamado. Márcala como 'no asistió' "
                "para no retrasar la franja.",
                "alerta",
                activo,
            )
        return _rec(
            "iniciar",
            f"Llamaste a {activo.usuario.nombre if activo.usuario else 'la persona'}",
            "Inicia la atención cuando llegue a tu puesto. Si no aparece en 3 minutos, "
            "márcala como 'no asistió'.",
            turno=activo,
        )

    if activo and activo.estado == "EN_ATENCION":
        transcurrido = (ahora - (_local(activo.fecha_inicio) or ahora)).total_seconds()
        restante = maximo - transcurrido
        if restante <= 0:
            afectados = len(en_riesgo)
            return _rec(
                "finalizar",
                "Superaste el tiempo máximo de atención",
                f"Llevas más de {maximo // 60} minutos. "
                + (
                    f"{afectados} turno(s) de la cola están en riesgo de salirse de su franja."
                    if afectados
                    else "Cierra en cuanto puedas para mantener la puntualidad."
                ),
                "urgente",
                activo,
            )
        if restante <= 2 * 60:
            return _rec(
                "finalizar",
                "Ve cerrando la atención",
                f"Quedan {int(restante // 60) or 1} min del máximo de {maximo // 60}.",
                "alerta",
                activo,
            )
        return _rec(
            "atendiendo",
            "Atención en curso",
            f"Tienes hasta {maximo // 60} minutos. La siguiente persona ya está proyectada.",
            turno=activo,
        )

    # --- El asesor está libre -------------------------------------------
    if not proyeccion:
        return _rec(
            "esperar",
            "No hay turnos pendientes",
            "Aprovecha para una pausa; el panel se actualiza solo cuando llegue alguien.",
        )

    primero = proyeccion[0]
    turno = primero["turno"]

    if primero["puntualidad"] in ("atrasado", "en_riesgo"):
        return _rec(
            "llamar",
            f"Llama ya a {nombre_de(turno)}",
            f"Turno {corto(turno)} · su franja "
            f"{primero['franja_inicio']:%H:%M}–{primero['franja_fin']:%H:%M} "
            + ("ya terminó." if primero["puntualidad"] == "atrasado" else "está por vencerse.")
            + (f" Hay {len(en_riesgo)} turnos en riesgo." if len(en_riesgo) > 1 else ""),
            "urgente",
            turno,
        )

    if primero["puntualidad"] == "proxima":
        faltan = int((primero["franja_inicio"] - ahora).total_seconds())
        # Tiempo libre antes de la siguiente franja: primero se alistan los
        # pedidos pendientes para que esas personas lleguen y se vayan rápido.
        por_preparar = [
            p["turno"]
            for p in proyeccion
            if p["turno"].estado_preparacion in ("PENDIENTE", "EN_PREPARACION")
            and p["turno"].franja.fecha == ahora.date()
        ]
        if por_preparar and faltan >= 3 * 60:
            siguiente = por_preparar[0]
            return _rec(
                "preparar",
                f"Alista lo de {nombre_de(siguiente)}",
                f"La siguiente franja empieza en {max(1, faltan // 60)} min y hay "
                f"{len(por_preparar)} pedido(s) por preparar. Empieza por "
                f"{siguiente.tramite.nombre if siguiente.tramite else 'el trámite'} "
                f"(turno {corto(siguiente)}).",
                turno=siguiente,
            )
        return _rec(
            "adelantar",
            f"Siguiente franja en {max(1, faltan // 60)} min",
            f"No quedan turnos en la franja actual. Si "
            f"{turno.usuario.nombre if turno.usuario else 'la persona'} "
            f"(turno {corto(turno)}) ya está en sede, puedes adelantarla; si no, toma una pausa.",
            turno=turno,
            pausa_seg=min(faltan, 5 * 60),
        )

    # Franja actual con margen: ¿pausa activa?
    margen_min = (
        min(p["margen_seg"] for p in proyeccion if p["franja_inicio"] <= ahora)
        if any(p["franja_inicio"] <= ahora for p in proyeccion)
        else primero["margen_seg"]
    )
    ultima = _ultima_atencion(agente.id, ahora)
    fue_rapida = (
        ultima and ultima["duracion_seg"] is not None and ultima["duracion_seg"] < maximo * 0.6
    )
    reciente = ultima and (ahora - ultima["fin"]).total_seconds() < 120

    if fue_rapida and reciente and margen_min >= pausa_base + primero["duracion_estimada_seg"]:
        pausa = 120 if margen_min >= 8 * 60 + primero["duracion_estimada_seg"] else pausa_base
        return _rec(
            "pausa",
            "Vas adelantado: toma una pausa activa",
            f"Tu última atención duró {int(ultima['duracion_seg'] // 60) or 1} min. "
            f"Hay margen de {margen_min // 60} min en la franja: estírate {pausa // 60 or 1} min "
            f"y luego llama a {nombre_de(turno, False)} (turno {corto(turno)}).",
            turno=turno,
            pausa_seg=pausa,
        )

    aviso = ""
    if turno.estado_preparacion in ("PENDIENTE", "EN_PREPARACION"):
        aviso = " Su pedido todavía no está marcado como listo."
    elif turno.estado_preparacion == "NOVEDAD":
        aviso = " Su pedido tiene una novedad registrada."
    return _rec(
        "llamar",
        f"Llama a {nombre_de(turno)}",
        f"Turno {corto(turno)} · {turno.tramite.nombre if turno.tramite else ''} · "
        f"es el siguiente según su franja ({primero['franja_inicio']:%H:%M}). "
        f"Duración estimada {primero['duracion_estimada_seg'] // 60} min." + aviso,
        turno=turno,
    )


# ----------------------------------------------------------------------
# Resumen de la franja actual y cumplimiento
# ----------------------------------------------------------------------


def estado_franja_actual(punto_id, ahora):
    franja = franja_actual(ahora)
    if not franja:
        return None
    hora = franja["inicio"].time().replace(tzinfo=None)
    turnos = (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(
            Turno.punto_id == punto_id,
            Franja.fecha == ahora.date(),
            Franja.hora_inicio == hora,
            Turno.estado != "CANCELADO",
        )
        .all()
    )
    asesores = Usuario.query.filter_by(
        rol="AGENTE", activo=True, punto_asignado_id=punto_id
    ).count()
    return {
        "inicio": franja["inicio"].strftime("%H:%M"),
        "fin": franja["fin"].strftime("%H:%M"),
        "restante_seg": int((franja["fin"] - ahora).total_seconds()),
        "total_seg": int((franja["fin"] - franja["inicio"]).total_seconds()),
        "reservados": len(turnos),
        "atendidos": sum(t.estado == "ATENDIDO" for t in turnos),
        "no_asistio": sum(t.estado == "NO_ASISTIO" for t in turnos),
        "pendientes": sum(t.estado in ("ESPERANDO", "LLAMADO", "EN_ATENCION") for t in turnos),
        "capacidad": cupos_por_asesor() * max(1, asesores),
        "asesores": asesores,
    }


def inicio_dentro_de_franja(turno):
    """¿La atención empezó antes de que terminara la franja reservada?"""
    if not turno.fecha_inicio or not turno.franja:
        return None
    _, fin_f = _limites_franja(turno)
    return _local(turno.fecha_inicio) <= fin_f


def cumplimiento(turnos):
    """Indicadores de la promesa de FilaCero sobre una lista de turnos."""
    atendidos = [t for t in turnos if t.estado == "ATENDIDO" and t.fecha_inicio and t.fecha_fin]
    if not atendidos:
        return {"atendidos_medidos": 0, "puntualidad_pct": None, "dentro_tiempo_max_pct": None}
    maximo = duracion_max_atencion_min() * 60
    puntuales = sum(1 for t in atendidos if inicio_dentro_de_franja(t))
    rapidos = sum(1 for t in atendidos if (t.fecha_fin - t.fecha_inicio).total_seconds() <= maximo)
    return {
        "atendidos_medidos": len(atendidos),
        "puntualidad_pct": round(100 * puntuales / len(atendidos), 1),
        "dentro_tiempo_max_pct": round(100 * rapidos / len(atendidos), 1),
    }
