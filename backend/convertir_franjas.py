
from datetime import date, timedelta, time

from app import create_app, db
from app.dominios.franjas.modelos import Franja
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.modelos import Turno


app = create_app()

HORARIOS = [
    (time(8, 0), time(12, 0)),
    (time(13, 0), time(17, 0)),
]


def generar_horas(inicio, fin, minutos):
    actual = inicio
    paso = timedelta(minutes=minutos)
    resultado = []

    while True:
        siguiente = (
            datetime_combinada(actual) + paso
        ).time()

        if siguiente > fin:
            break

        resultado.append((actual, siguiente))
        actual = siguiente

    return resultado


def datetime_combinada(hora):
    from datetime import datetime
    return datetime.combine(date.today(), hora)


def convertir():
    try:
        franjas_actuales = Franja.query.all()

        # Protección: nunca borrar franjas con turnos asociados.
        ids = [franja.id for franja in franjas_actuales]

        if ids:
            turnos_asociados = Turno.query.filter(
                Turno.franja_id.in_(ids)
            ).count()

            if turnos_asociados:
                raise RuntimeError(
                    "Hay turnos asociados a las franjas actuales. "
                    "No se realizaron cambios."
                )

        tramites = Tramite.query.filter_by(
            activo=True
        ).all()

        if not tramites:
            raise RuntimeError("No existen trámites activos.")

        sedes_ids = sorted({
            franja.punto_id for franja in franjas_actuales
        })

        if not sedes_ids:
            raise RuntimeError("No existen franjas para convertir.")

        # Duración definida por trámite:
        # diagnóstico: 30 min; seguimiento: 15 min.
        duraciones = {}

        for tramite in tramites:
            nombre = tramite.nombre.lower()

            if "seguimiento" in nombre:
                duraciones[tramite.id] = 15
            else:
                duraciones[tramite.id] = 30

        # Retirar las franjas amplias, que todavía no tienen turnos.
        for franja in franjas_actuales:
            db.session.delete(franja)

        db.session.flush()

        hoy = date.today()
        fecha = hoy
        dias_habiles = 0
        creadas = 0

        while dias_habiles < 14:
            fecha += timedelta(days=1)

            if fecha.weekday() >= 5:
                continue

            dias_habiles += 1

            for sede_id in sedes_ids:
                for tramite in tramites:
                    duracion = duraciones[tramite.id]

                    for inicio_jornada, fin_jornada in HORARIOS:
                        for inicio, fin in generar_horas(
                            inicio_jornada,
                            fin_jornada,
                            duracion,
                        ):
                            db.session.add(
                                Franja(
                                    punto_id=sede_id,
                                    tramite_id=tramite.id,
                                    fecha=fecha,
                                    hora_inicio=inicio,
                                    hora_fin=fin,
                                    capacidad=1,
                                    activa=True,
                                )
                            )
                            creadas += 1

        db.session.commit()

        print("\nCONVERSIÓN COMPLETADA")
        print(f"Sedes: {len(sedes_ids)}")
        print(f"Trámites: {len(tramites)}")
        print(f"Días hábiles: {dias_habiles}")
        print(f"Franjas reservables creadas: {creadas}")
        print("Diagnóstico: 30 minutos")
        print("Seguimiento: 15 minutos")
        print("Capacidad inicial por franja: 1")

    except Exception:
        db.session.rollback()
        raise


if __name__ == "__main__":
    with app.app_context():
        convertir()
