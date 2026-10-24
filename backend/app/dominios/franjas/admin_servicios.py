from datetime import date, time
from app import db
from .modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite


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
    if fecha < date.today():
        raise ValueError("La fecha no puede estar en el pasado.")
    if fin <= inicio:
        raise ValueError("La hora final debe ser posterior a la inicial.")
    if capacidad <= 0:
        raise ValueError("La capacidad debe ser positiva.")

    franja = Franja(
        punto_id=punto_id,
        tramite_id=tramite_id,
        fecha=fecha,
        hora_inicio=inicio,
        hora_fin=fin,
        capacidad=capacidad,
        activa=True
    )
    db.session.add(franja)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise ValueError("No se pudo crear la franja. Verifica si ya existe.")
    return franja


def cambiar_estado_franja(franja_id, activa):
    franja = db.session.get(Franja, franja_id)
    if not franja:
        raise ValueError("La franja no existe.")
    franja.activa = bool(activa)
    db.session.commit()
    return franja
