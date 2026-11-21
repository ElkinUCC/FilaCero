"""Servicio de predicción del tiempo de espera de un turno."""

from datetime import datetime

from app.dominios.turnos import repositorios as repo
from app.errores import NoEncontradoError


def _predecir_duracion(turno):
    """Duración esperada de la atención (segundos), muestras usadas y modelo."""
    historial = repo.duraciones_recientes(turno.tramite_id, turno.punto_id)
    duraciones = [(fin - inicio).total_seconds() for inicio, fin in historial if fin > inicio]

    if len(duraciones) < 5:
        if duraciones:
            duraciones.sort()
            n = len(duraciones)
            base = (
                duraciones[n // 2] if n % 2 else (duraciones[n // 2 - 1] + duraciones[n // 2]) / 2
            )
        else:
            base = (turno.tramite.tiempo_estimado if turno.tramite else 10) * 60
        return base, len(duraciones), "respaldo_estadistico"

    valores = list(reversed(duraciones))
    x_media = (len(valores) - 1) / 2
    y_media = sum(valores) / len(valores)
    denominador = sum((i - x_media) ** 2 for i in range(len(valores)))
    pendiente = (
        sum((i - x_media) * (y - y_media) for i, y in enumerate(valores)) / denominador
        if denominador
        else 0
    )
    prediccion = y_media + pendiente * (len(valores) - 1 - x_media)
    return max(60, min(prediccion, 7200)), len(valores), "regresion_lineal"


def estimar_espera(turno):
    if turno.estado != "ESPERANDO":
        return {"turnos_antes": 0, "tiempo_estimado_minutos": 0}

    duracion, muestras, modelo = _predecir_duracion(turno)
    antes = repo.posicion_en_cola(turno)
    agentes = max(1, repo.contar_asesores_activos(turno.punto_id))
    en_atencion = repo.contar_en_curso(turno.punto_id)

    minutos = round(((antes + en_atencion) * duracion / agentes) / 60)
    return {
        "turnos_antes": antes,
        "tiempo_estimado_minutos": minutos,
        "muestras_historicas": muestras,
        "modelo": modelo,
    }


def tiempo_espera_autorizado(turno_id, usuario_id):
    """Estimación para el dueño del turno, un asesor de la misma sede o un administrador."""
    from app.dominios.usuarios.repositorios import buscar_por_id

    turno = repo.obtener_por_id(turno_id)
    usuario = buscar_por_id(usuario_id)
    permitido = (
        turno
        and usuario
        and usuario.activo
        and (
            usuario.id == turno.usuario_id
            or usuario.rol == "ADMIN"
            or (usuario.rol == "AGENTE" and usuario.punto_asignado_id == turno.punto_id)
        )
    )
    if not permitido:
        raise NoEncontradoError("Turno no encontrado")

    if turno.estado in ("ATENDIDO", "CANCELADO", "NO_ASISTIO", "EN_ATENCION"):
        return {
            "turno_id": turno.id,
            "estado": turno.estado,
            "tiempo_estimado_minutos": 0,
            "mensaje": "El turno ya no está en espera.",
        }
    return {
        "turno_id": turno.id,
        "estado": turno.estado,
        **estimar_espera(turno),
        "generado_en": datetime.now().isoformat(timespec="seconds"),
        "nota": "Estimación orientativa basada en atenciones anteriores.",
    }
