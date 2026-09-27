from datetime import date
from app import db
from .modelos import Turno
from .repositorios import guardar, obtener_por_usuario


def crear_turno(usuario_id, tramite_id, punto_id):

    cantidad = Turno.query.filter(
        Turno.punto_id == punto_id,
        Turno.fecha == date.today()
    ).count()

    codigo = f"A{cantidad + 1:03d}"

    turno = Turno(
        codigo=codigo,
        fecha=date.today(),
        usuario_id=usuario_id,
        tramite_id=tramite_id,
        punto_id=punto_id,
        estado="ESPERANDO"
    )

    return guardar(turno)


def mis_turnos(usuario_id):
    return obtener_por_usuario(usuario_id)