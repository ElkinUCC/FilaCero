"""Acceso a datos del asistente (solo lectura)."""

from sqlalchemy.orm import contains_eager

from .modelos import Franja, Reclamo, Turno


def reservas_en_espera(fecha, punto_id=None):
    """Turnos en espera reservados para una fecha (con su franja cargada)."""
    consulta = (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .options(contains_eager(Turno.franja))
        .filter(Franja.fecha == fecha, Turno.estado == "ESPERANDO")
    )
    if punto_id:
        consulta = consulta.filter(Turno.punto_id == punto_id)
    return consulta.all()


def estados_de_reclamos(punto_id=None):
    """Lista de estados de los reclamos (de una sede o de todas)."""
    consulta = Reclamo.query
    if punto_id:
        consulta = consulta.filter(Reclamo.punto_id == punto_id)
    return [estado for (estado,) in consulta.with_entities(Reclamo.estado)]
