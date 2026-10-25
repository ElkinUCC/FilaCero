
from app import create_app
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.franjas.modelos import Franja
from app.dominios.turnos.modelos import Turno
from app.dominios.usuarios.modelos import Usuario

app = create_app()

with app.app_context():
    print("\n=== RESUMEN FILACERO ===")
    print("Sedes activas:", Punto.query.filter_by(activo=True).count())
    print("Trámites activos:", Tramite.query.filter_by(activo=True).count())
    print("Agentes activos:", Usuario.query.filter_by(
        rol="AGENTE", activo=True
    ).count())
    print("Turnos registrados:", Turno.query.count())
    print("Franjas registradas:", Franja.query.count())

    print("\n=== DISTRIBUCIÓN POR SEDE ===")

    for sede in Punto.query.filter_by(activo=True).order_by(Punto.id):
        agentes = Usuario.query.filter_by(
            rol="AGENTE",
            activo=True,
            punto_asignado_id=sede.id,
        ).count()

        franjas = Franja.query.filter_by(
            punto_id=sede.id,
            activa=True,
        ).count()

        turnos = Turno.query.filter_by(
            punto_id=sede.id,
        ).count()

        print(
            f"{sede.nombre}: agentes={agentes}, "
            f"franjas_activas={franjas}, turnos={turnos}"
        )
