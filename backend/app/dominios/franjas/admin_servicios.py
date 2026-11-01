from datetime import date, time

from sqlalchemy.exc import IntegrityError

from app import db
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.horario import dentro_de_horario, hoy_local
from .modelos import Franja


def crear_franja(datos):
    try:
        punto_id = int(datos["punto_id"])
        tramite_id = int(datos["tramite_id"])
        fecha = date.fromisoformat(datos["fecha"])
        inicio = time.fromisoformat(datos["hora_inicio"])
        fin = time.fromisoformat(datos["hora_fin"])
        capacidad = int(datos["capacidad"])
    except (KeyError, TypeError, ValueError):
        raise ValueError(
            "Se requieren punto_id, tramite_id, fecha (AAAA-MM-DD), "
            "hora_inicio, hora_fin y capacidad válidos."
        )

    punto = db.session.get(Punto, punto_id)
    tramite = db.session.get(Tramite, tramite_id)

    if not punto or not punto.activo:
        raise ValueError("La sede no existe o está inactiva.")
    if not tramite or not tramite.activo:
        raise ValueError("El trámite no existe o está inactivo.")
    if fecha < hoy_local():
        raise ValueError("La fecha no puede estar en el pasado.")
    if fin <= inicio:
        raise ValueError("La hora final debe ser posterior a la inicial.")
    if not dentro_de_horario(inicio, fin):
        raise ValueError("La franja debe estar dentro del horario de atención.")
    if capacidad <= 0 or capacidad > 500:
        raise ValueError("La capacidad debe estar entre 1 y 500.")

    franja = Franja(
        punto_id=punto_id,
        tramite_id=tramite_id,
        fecha=fecha,
        hora_inicio=inicio,
        hora_fin=fin,
        capacidad=capacidad,
        activa=True,
    )
    db.session.add(franja)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ValueError("Ya existe una franja con esa sede, trámite, fecha y hora.")
    return franja


def cambiar_estado_franja(franja_id, activa):
    franja = db.session.get(Franja, franja_id)
    if not franja:
        raise ValueError("La franja no existe.")
    franja.activa = bool(activa)
    db.session.commit()
    return franja
