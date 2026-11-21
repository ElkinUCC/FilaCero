"""Preparación previa del turno (capa de servicio del dominio Turnos)."""

from app import db
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.repositorios import ESTADOS_ACTIVOS
from app.errores import ConflictoError, DatosInvalidosError, NoEncontradoError
from app.tiempo import ahora_bd

ESTADOS_PREPARACION = {
    "PENDIENTE": "Pendiente de preparar",
    "EN_PREPARACION": "En preparación",
    "LISTO": "Listo para entregar",
    "NOVEDAD": "Con novedad",
}
NOTA_MAX = 500


def estado_inicial(tramite):
    """Estado con el que nace un turno según su trámite."""
    return "PENDIENTE" if tramite is not None and tramite.requiere_preparacion else None


def preparacion_response(turno, *, publica=False):
    """Representación de la preparación. publica=True omite datos internos."""
    estado = turno.estado_preparacion
    if not estado:
        return None
    from app.horario import a_iso

    datos = {
        "estado": estado,
        "texto": ESTADOS_PREPARACION.get(estado, estado),
        "nota": turno.nota_preparacion,
        "fecha": a_iso(turno.fecha_preparacion),
    }
    if not publica:
        datos["preparado_por"] = turno.preparado_por.nombre if turno.preparado_por else None
    return datos


def registrar_preparacion(agente_id, turno_id, estado, nota=None):
    """El asesor actualiza la preparación de un turno de su sede."""
    from app.dominios.agentes.repositorios import obtener_agente

    estado = str(estado or "").strip().upper()
    if estado not in ESTADOS_PREPARACION:
        raise DatosInvalidosError("Estado de preparación no válido.")
    nota = " ".join(str(nota or "").split()) or None
    if estado == "PENDIENTE":
        nota = None  # volver a "pendiente" deshace la preparación
    if nota and len(nota) > NOTA_MAX:
        raise DatosInvalidosError(f"La nota admite máximo {NOTA_MAX} caracteres.")
    if estado == "NOVEDAD" and not nota:
        raise DatosInvalidosError("Describe la novedad para avisarle al ciudadano.")

    agente = obtener_agente(agente_id)
    if not agente or not agente.punto_asignado_id:
        raise ConflictoError("Necesitas una sede asignada para preparar turnos.")

    turno = db.session.get(Turno, turno_id)
    if not turno:
        raise NoEncontradoError("El turno no existe.")
    if turno.punto_id != agente.punto_asignado_id:
        raise ConflictoError("El turno pertenece a otra sede.")
    if turno.estado not in ESTADOS_ACTIVOS:
        raise ConflictoError("Solo se preparan turnos que siguen activos.")

    turno.estado_preparacion = estado
    turno.nota_preparacion = nota
    if estado == "PENDIENTE":
        turno.fecha_preparacion = None
        turno.preparado_por_id = None
    else:
        turno.fecha_preparacion = ahora_bd()
        turno.preparado_por_id = agente.id
    db.session.commit()
    return turno


def pendientes(turnos):
    """Turnos de la lista que todavía no están listos."""
    return [t for t in turnos if t.estado_preparacion in ("PENDIENTE", "EN_PREPARACION")]
