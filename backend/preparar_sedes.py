
from datetime import date, datetime, time, timedelta

from app import create_app, db
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.franjas.modelos import Franja
from app.dominios.turnos.modelos import Turno


app = create_app()

SEDES = [
    {
        "nombre": "Sede Centro",
        "direccion": "Sector Centro, Medellín, Antioquia",
    },
    {
        "nombre": "Sede Laureles",
        "direccion": "Sector Laureles, Medellín, Antioquia",
    },
    {
        "nombre": "Sede El Poblado",
        "direccion": "Sector El Poblado, Medellín, Antioquia",
    },
]

JORNADAS = [
    (time(8, 0), time(12, 0)),
    (time(13, 0), time(17, 0)),
]


def generar_intervalos(inicio, fin, minutos):
    actual = datetime.combine(date.today(), inicio)
    limite = datetime.combine(date.today(), fin)
    paso = timedelta(minutes=minutos)

    while actual + paso <= limite:
        siguiente = actual + paso
        yield actual.time(), siguiente.time()
        actual = siguiente


def preparar():
    hoy = date.today()

    # Reemplazamos únicamente la programación de hoy en adelante.
    futuras = Franja.query.filter(Franja.fecha >= hoy).all()
    ids_franjas = [f.id for f in futuras]

    if ids_franjas:
        asociados = Turno.query.filter(
            Turno.franja_id.in_(ids_franjas)
        ).count()

        if asociados:
            raise RuntimeError(
                f"Operación cancelada: {asociados} turnos están "
                "asociados a franjas futuras. No se borró nada."
            )

    try:
        sedes = []

        for datos in SEDES:
            sede = Punto.query.filter_by(
                nombre=datos["nombre"]
            ).first()

            if sede is None:
                # Reutilizar la sede inicial si aún tiene su nombre original.
                if datos["nombre"] == "Sede Centro":
                    sede = Punto.query.filter_by(
                        nombre='SERVICIOS TECNOLÓGICOS "E"'
                    ).first()

                    if sede:
                        sede.nombre = datos["nombre"]
                        sede.direccion = datos["direccion"]

                if sede is None:
                    sede = Punto(
                        nombre=datos["nombre"],
                        direccion=datos["direccion"],
                        activo=True,
                    )
                    db.session.add(sede)
                    db.session.flush()

            sede.activo = True
            sede.direccion = datos["direccion"]
            sedes.append(sede)

        tramites = Tramite.query.filter_by(activo=True).all()

        if not tramites:
            raise RuntimeError("No existen trámites activos.")

        # Evitar reemplazar franjas si hay turnos asociados.
        for franja in futuras:
            db.session.delete(franja)

        db.session.flush()

        creadas = 0
        dias = 0
        fecha = hoy

        while dias < 14:
            fecha += timedelta(days=1)

            if fecha.weekday() >= 5:
                continue

            dias += 1

            for sede in sedes:
                for tramite in tramites:
                    nombre = tramite.nombre.lower()
                    duracion = 15 if "seguimiento" in nombre else 30

                    for inicio_jornada, fin_jornada in JORNADAS:
                        for inicio, fin in generar_intervalos(
                            inicio_jornada,
                            fin_jornada,
                            duracion,
                        ):
                            db.session.add(
                                Franja(
                                    punto_id=sede.id,
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

        print("\n=== PROGRAMACIÓN DE FILACERO ===")
        print(f"Sedes activas: {len(sedes)}")
        for sede in sedes:
            print(f"  - {sede.id}: {sede.nombre}")

        print(f"Trámites activos: {len(tramites)}")
        print(f"Días hábiles programados: {dias}")
        print(f"Franjas nuevas: {creadas}")
        print("Diagnóstico: 30 min | Seguimiento: 15 min")
        print("Horario: 08:00-12:00 y 13:00-17:00")
        print("Capacidad inicial: 1 reserva por franja")

    except Exception:
        db.session.rollback()
        raise


if __name__ == "__main__":
    with app.app_context():
        preparar()
