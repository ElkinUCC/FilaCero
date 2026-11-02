from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.repositorios import consulta_cola
from app.dominios.usuarios.modelos import Usuario


def obtener_agente(usuario_id):
    return Usuario.query.filter_by(id=usuario_id, rol="AGENTE", activo=True).first()


def obtener_cola(punto_id):
    return consulta_cola(punto_id).all()


def obtener_siguiente_bloqueado(punto_id):
    return consulta_cola(punto_id).with_for_update().first()


def obtener_turno_bloqueado(turno_id):
    return Turno.query.filter_by(id=turno_id).with_for_update().first()


def obtener_turno_activo(agente_id):
    return (
        Turno.query.filter(
            Turno.agente_id == agente_id, Turno.estado.in_(("LLAMADO", "EN_ATENCION"))
        )
        .order_by(Turno.id.desc())
        .first()
    )
