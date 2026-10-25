from app import create_app
from app.dominios.usuarios.modelos import Usuario
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.franjas.modelos import Franja
from app.dominios.turnos.modelos import Turno

app = create_app()

with app.app_context():
    print("\n=== FILACERO: ESTADO DEL NEGOCIO PILOTO ===")
    print("Usuarios:", Usuario.query.count())
    print("Sedes:", Punto.query.count())
    print("Tramites:", Tramite.query.count())
    print("Franjas:", Franja.query.count())
    print("Turnos:", Turno.query.count())

    print("\n=== CUENTAS ===")
    for u in Usuario.query.order_by(Usuario.id).all():
        print(u.id, u.correo, u.rol, "ACTIVO" if u.activo else "INACTIVO",
              "Sede:", u.punto_asignado_id)

    print("\n=== SEDES ===")
    for p in Punto.query.all():
        print(p.id, p)

    print("\n=== TRAMITES ===")
    for t in Tramite.query.all():
        print(t.id, t)

    print("\n=== FRANJAS ===")
    for f in Franja.query.all():
        print(f.id, f)
