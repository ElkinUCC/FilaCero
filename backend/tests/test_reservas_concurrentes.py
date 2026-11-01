"""Muchas reservas simultáneas a la misma franja nunca superan el cupo."""
from concurrent.futures import ThreadPoolExecutor
from datetime import time, timedelta

from app import create_app, db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.servicios import crear_turno
from app.dominios.usuarios.modelos import Usuario
from app.horario import hoy_local


def test_reservas_simultaneas_respetan_el_cupo(tmp_path):
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'concurrencia.db'}",
        "SQLALCHEMY_ENGINE_OPTIONS": {"connect_args": {"timeout": 30}},
        "JWT_SECRET_KEY": "PRUEBAS-FilaCero-JWT-Clave-Segura-2026",
    })
    with app.app_context():
        db.create_all()
        sede = Punto(nombre="Sede", activo=True)
        tramite = Tramite(nombre="Servicio", tiempo_estimado=10, activo=True)
        db.session.add_all([sede, tramite])
        db.session.commit()
        franja = Franja(punto_id=sede.id, tramite_id=tramite.id, fecha=hoy_local() + timedelta(days=1),
                        hora_inicio=time(10, 0), hora_fin=time(10, 30), capacidad=3)
        clientes = [Usuario(nombre=f"Cliente {i}", correo=f"c{i}@x.co", password_hash="x",
                            rol="CLIENTE", celular=f"30000000{i:02d}") for i in range(15)]
        db.session.add_all([franja, *clientes])
        db.session.commit()
        ids = [c.id for c in clientes]
        datos = (tramite.id, sede.id, franja.id)

    def intentar(usuario_id):
        with app.app_context():
            try:
                crear_turno(usuario_id, *datos)
                return "ok"
            except ValueError:
                return "sin cupo"
            finally:
                db.session.remove()

    with ThreadPoolExecutor(max_workers=15) as ex:
        resultados = list(ex.map(intentar, ids))

    with app.app_context():
        assert Turno.query.count() == 3
        assert resultados.count("ok") == 3
        db.drop_all()
