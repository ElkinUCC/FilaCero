from app.dominios.usuarios.modelos import Usuario
from app.dominios.turnos.modelos import Turno


def obtener_agente(usuario_id):
    return Usuario.query.filter_by(
        id=usuario_id,
        rol="AGENTE",
        activo=True
    ).first()


def obtener_cola(punto_id):
    return (
        Turno.query
        .filter_by(punto_id=punto_id, estado="ESPERANDO")
        .order_by(Turno.hora_solicitud.asc(), Turno.id.asc())
        .all()
    )


def obtener_siguiente_bloqueado(punto_id):
    return (
        Turno.query
        .filter_by(punto_id=punto_id, estado="ESPERANDO")
        .order_by(Turno.hora_solicitud.asc(), Turno.id.asc())
        .with_for_update()
        .first()
    )


def obtener_turno_bloqueado(turno_id):
    return (
        Turno.query
        .filter_by(id=turno_id)
        .with_for_update()
        .first()
    )