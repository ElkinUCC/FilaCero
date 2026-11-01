from app import db
from app.dominios.turnos.modelos import Turno
from .repositorios import listar_activas


def consultar_disponibilidad(punto_id=None, tramite_id=None, fecha=None):
    resultado = []
    for franja in listar_activas(punto_id, tramite_id, fecha):
        reservados = (
            db.session.query(Turno)
            .filter(Turno.franja_id == franja.id, Turno.estado != "CANCELADO")
            .count()
        )
        disponibles = max(0, franja.capacidad - reservados)
        resultado.append({
            "id": franja.id,
            "punto_id": franja.punto_id,
            "punto": franja.punto.nombre,
            "tramite_id": franja.tramite_id,
            "tramite": franja.tramite.nombre,
            "fecha": franja.fecha.isoformat(),
            "hora_inicio": franja.hora_inicio.strftime("%H:%M"),
            "hora_fin": franja.hora_fin.strftime("%H:%M"),
            "capacidad": franja.capacidad,
            "reservados": reservados,
            "disponibles": disponibles,
            "disponible": disponibles > 0,
        })
    return resultado
