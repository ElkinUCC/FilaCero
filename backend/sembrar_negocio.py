
from datetime import date, time, timedelta

from app import create_app, db
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.franjas.modelos import Franja
from app.dominios.usuarios.modelos import Usuario


app = create_app()


def sembrar():
    nombre_sede = 'SERVICIOS TECNOLÓGICOS "E"'

    catalogo = [
        {
            "nombre": "Diagnóstico y reparación de televisores",
            "descripcion": (
                "Recepción del equipo, diagnóstico técnico "
                "y gestión de la reparación."
            ),
            "tiempo_estimado": 30,
        },
        {
            "nombre": "Seguimiento de reparación",
            "descripcion": (
                "Consulta del estado de reparación y "
                "coordinación de entrega del equipo."
            ),
            "tiempo_estimado": 10,
        },
    ]

    horarios = [
        (time(9, 0), time(12, 0)),
        (time(13, 0), time(17, 0)),
    ]

    try:
        # 1. Crear o recuperar la sede.
        sede = Punto.query.filter_by(
            nombre=nombre_sede
        ).first()

        if sede is None:
            sede = Punto(
                nombre=nombre_sede,
                direccion="Sede principal - atención al público",
                activo=True,
            )
            db.session.add(sede)
            db.session.flush()

        # 2. Crear o recuperar los trámites.
        tramites = []

        for datos in catalogo:
            tramite = Tramite.query.filter_by(
                nombre=datos["nombre"]
            ).first()

            if tramite is None:
                tramite = Tramite(
                    nombre=datos["nombre"],
                    descripcion=datos["descripcion"],
                    tiempo_estimado=datos["tiempo_estimado"],
                    activo=True,
                )
                db.session.add(tramite)
                db.session.flush()

            tramites.append(tramite)

        # 3. Asignar agentes activos a la sede.
        agentes = Usuario.query.filter_by(
            rol="AGENTE",
            activo=True,
        ).all()

        for agente in agentes:
            agente.punto_asignado_id = sede.id

        # 4. Generar franjas para los próximos 14 días hábiles.
        fecha = date.today()
        dias_habiles = 0
        franjas_creadas = 0

        while dias_habiles < 14:
            fecha += timedelta(days=1)

            # 5 = sábado; 6 = domingo.
            if fecha.weekday() >= 5:
                continue

            dias_habiles += 1

            for tramite in tramites:
                for inicio, fin in horarios:
                    existente = Franja.query.filter_by(
                        punto_id=sede.id,
                        tramite_id=tramite.id,
                        fecha=fecha,
                        hora_inicio=inicio,
                    ).first()

                    if existente:
                        continue

                    db.session.add(
                        Franja(
                            punto_id=sede.id,
                            tramite_id=tramite.id,
                            fecha=fecha,
                            hora_inicio=inicio,
                            hora_fin=fin,
                            capacidad=10,
                            activa=True,
                        )
                    )
                    franjas_creadas += 1

        db.session.commit()

        print("\n" + "=" * 48)
        print("FILACERO: DATOS DEL NEGOCIO PREPARADOS")
        print("=" * 48)
        print(f"Sede: {sede.nombre}")
        print(f"ID de sede: {sede.id}")
        print(f"Trámites disponibles: {len(tramites)}")
        print(f"Agentes asignados: {len(agentes)}")
        print(f"Días hábiles programados: {dias_habiles}")
        print(f"Franjas nuevas creadas: {franjas_creadas}")
        print(f"Total de franjas: {Franja.query.count()}")
        print(f"Total de usuarios: {Usuario.query.count()}")
        print("\nProceso completado correctamente.")

    except Exception:
        db.session.rollback()
        raise


if __name__ == "__main__":
    with app.app_context():
        sembrar()
