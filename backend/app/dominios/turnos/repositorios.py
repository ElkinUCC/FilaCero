from app import db
from app.dominios.franjas.modelos import Franja
from app.horario import _config_operativa, hoy_local

from .modelos import Turno

ESTADOS = ("ESPERANDO", "LLAMADO", "EN_ATENCION", "ATENDIDO", "CANCELADO", "NO_ASISTIO")
ESTADOS_ACTIVOS = ("ESPERANDO", "LLAMADO", "EN_ATENCION")


def guardar(turno):
    db.session.add(turno)
    db.session.commit()
    return turno


def obtener_por_usuario(usuario_id):
    return Turno.query.filter_by(usuario_id=usuario_id).order_by(Turno.hora_solicitud.desc()).all()


def obtener_por_id(turno_id):
    return db.session.get(Turno, turno_id)


def normalizar_codigo(valor):
    """Acepta el código completo , el visible (TU-XXXXXX) o los 6 caracteres."""
    codigo = "".join(str(valor or "").split()).upper()
    if codigo.startswith("TU-"):
        codigo = codigo[3:]
    return codigo


def obtener_por_codigo(codigo, celular=None):
    """Busca por código completo o, con el celular del dueño, por el corto."""
    codigo = normalizar_codigo(codigo)
    turno = Turno.query.filter_by(codigo=codigo).first()
    if turno or len(codigo) != 6:
        return turno
    from app.dominios.usuarios.modelos import Usuario

    if not celular:
        # Solo el código corto: el turno más reciente con esa terminación.
        return (
            Turno.query.filter(Turno.codigo.like(f"%-{codigo}"))
            .order_by(Turno.hora_solicitud.desc())
            .first()
        )

    return (
        Turno.query.join(Usuario, Turno.usuario_id == Usuario.id)
        .filter(Usuario.celular == celular, Turno.codigo.like(f"%-{codigo}"))
        .order_by(Turno.hora_solicitud.desc())
        .first()
    )


def obtener_por_celular(celular, limite=10):
    """Turnos recientes asociados al celular, dentro de la organización activa."""
    from app.dominios.usuarios.modelos import Usuario

    return (
        Turno.query.join(Usuario, Turno.usuario_id == Usuario.id)
        .filter(Usuario.celular == celular)
        .order_by(Turno.hora_solicitud.desc(), Turno.id.desc())
        .limit(limite)
        .all()
    )


def consulta_cola(punto_id):
    """Turnos en espera de una sede, desde hoy, en orden de la hora de su franja."""
    return (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(
            Turno.punto_id == punto_id,
            Turno.estado == "ESPERANDO",
            (
                Franja.fecha == hoy_local()
                if _config_operativa("COLA_SOLO_HOY", False)
                else Franja.fecha >= hoy_local()
            ),
        )
        .order_by(
            Franja.fecha.asc(),
            Franja.hora_inicio.asc(),
            Turno.hora_solicitud.asc(),
            Turno.id.asc(),
        )
    )


def posicion_en_cola(turno):
    """Cuántos turnos en espera hay antes de este en la misma sede."""
    if turno.estado != "ESPERANDO":
        return 0
    ids = [t.id for t in consulta_cola(turno.punto_id).with_entities(Turno.id).all()]
    return ids.index(turno.id) if turno.id in ids else 0


def confirmar():
    db.session.commit()


# Pantalla de sala


def llamados_recientes(punto_id, fecha, desde_utc, limite=6):
    """Turnos de hoy llamados en los últimos minutos (lo que se anuncia en la TV)."""
    return (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(
            Turno.punto_id == punto_id,
            Franja.fecha == fecha,
            Turno.estado.in_(("LLAMADO", "EN_ATENCION", "ATENDIDO")),
            Turno.fecha_llamado.isnot(None),
            Turno.fecha_llamado >= desde_utc,
        )
        .order_by(Turno.fecha_llamado.desc())
        .limit(limite)
        .all()
    )


def siguientes_en_espera(punto_id, fecha, limite=6):
    return (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(Turno.punto_id == punto_id, Franja.fecha == fecha, Turno.estado == "ESPERANDO")
        .order_by(Franja.hora_inicio.asc(), Turno.hora_solicitud.asc())
        .limit(limite)
        .all()
    )


# Predicción del tiempo de espera


def duraciones_recientes(tramite_id, punto_id, limite=100):
    return (
        db.session.query(Turno.fecha_inicio, Turno.fecha_fin)
        .filter(
            Turno.estado == "ATENDIDO",
            Turno.fecha_inicio.isnot(None),
            Turno.fecha_fin.isnot(None),
            Turno.tramite_id == tramite_id,
            Turno.punto_id == punto_id,
        )
        .order_by(Turno.fecha_fin.desc())
        .limit(limite)
        .all()
    )


def contar_asesores_activos(punto_id):
    from app.dominios.usuarios.modelos import Usuario

    return Usuario.query.filter_by(rol="AGENTE", activo=True, punto_asignado_id=punto_id).count()


def contar_en_curso(punto_id):
    return Turno.query.filter(
        Turno.punto_id == punto_id, Turno.estado.in_(("LLAMADO", "EN_ATENCION"))
    ).count()
