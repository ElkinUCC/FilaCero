
import os

from werkzeug.security import generate_password_hash

from app import create_app, db
from app.dominios.sedes.modelos import Punto
from app.dominios.usuarios.modelos import Usuario


app = create_app()

AGENTES_DEMO = [
    {
        "nombre": "Agente Centro 2",
        "correo": "agente.centro2@filacero.com",
        "sede": "Sede Centro",
    },
    {
        "nombre": "Agente Laureles 1",
        "correo": "agente.laureles@filacero.com",
        "sede": "Sede Laureles",
    },
    {
        "nombre": "Agente Laureles 2",
        "correo": "agente.laureles2@filacero.com",
        "sede": "Sede Laureles",
    },
    {
        "nombre": "Agente Poblado 1",
        "correo": "agente.poblado@filacero.com",
        "sede": "Sede El Poblado",
    },
]


def preparar():
    # Define la contraseña en la terminal; no la guardamos en el script.
    password = os.environ.get("FILACERO_AGENT_PASSWORD")

    if not password or len(password) < 12:
        raise RuntimeError(
            "Define FILACERO_AGENT_PASSWORD con una contraseña "
            "de al menos 12 caracteres para las cuentas nuevas."
        )

    try:
        sedes = {
            sede.nombre: sede
            for sede in Punto.query.filter_by(activo=True).all()
        }

        for agente_datos in AGENTES_DEMO:
            nombre_sede = agente_datos["sede"]

            if nombre_sede not in sedes:
                raise RuntimeError(
                    f"No existe la sede activa: {nombre_sede}. "
                    "Ejecuta primero preparar_sedes.py."
                )

            agente = Usuario.query.filter_by(
                correo=agente_datos["correo"]
            ).first()

            if agente is None:
                agente = Usuario(
                    nombre=agente_datos["nombre"],
                    correo=agente_datos["correo"],
                    password_hash=generate_password_hash(password),
                    rol="AGENTE",
                    activo=True,
                    punto_asignado_id=sedes[nombre_sede].id,
                )
                db.session.add(agente)
            else:
                # No cambiamos la contraseña de cuentas existentes.
                if agente.rol != "AGENTE":
                    raise RuntimeError(
                        f"{agente.correo} ya existe con otro rol."
                    )

                agente.activo = True
                agente.punto_asignado_id = sedes[nombre_sede].id

        # Mantener también asignado el agente de prueba existente.
        agente_original = Usuario.query.filter_by(
            correo="elkinagente@filacero.com"
        ).first()

        if agente_original:
            centro = sedes.get("Sede Centro")

            if centro:
                agente_original.punto_asignado_id = centro.id

        db.session.commit()

        print("\nAGENTES PREPARADOS")
        for agente in Usuario.query.filter_by(
            rol="AGENTE",
            activo=True,
        ).order_by(Usuario.id).all():
            sede = (
                db.session.get(Punto, agente.punto_asignado_id)
                if agente.punto_asignado_id
                else None
            )
            print(
                f"{agente.nombre} | {agente.correo} | "
                f"{sede.nombre if sede else 'SIN SEDE'}"
            )

    except Exception:
        db.session.rollback()
        raise


if __name__ == "__main__":
    with app.app_context():
        preparar()
