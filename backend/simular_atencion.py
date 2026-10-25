from datetime import datetime
from werkzeug.security import generate_password_hash

from app import create_app, db
from app.dominios.usuarios.modelos import Usuario
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.franjas.modelos import Franja
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.servicios import crear_turno
from app.dominios.agentes.servicios import (
    llamar_siguiente,
    iniciar_atencion,
    finalizar_atencion,
)

CANTIDAD_CLIENTES = 10
app = create_app()


def preparar_simulacion():
    sede = Punto.query.filter_by(activo=True).order_by(Punto.id).first()
    tramite = Tramite.query.filter_by(activo=True).order_by(Tramite.id).first()

    if not sede or not tramite:
        raise RuntimeError("Faltan sedes o trámites activos.")

    agentes = Usuario.query.filter_by(
        rol="AGENTE", activo=True, punto_asignado_id=sede.id
    ).order_by(Usuario.id).all()

    if not agentes:
        raise RuntimeError("La sede no tiene agentes activos.")

    return sede, tramite, agentes


from datetime import datetime
from zoneinfo import ZoneInfo
from uuid import uuid4

CLIENTES_POR_SEDE = {
    1: 25,
    2: 15,
    3: 10,
}

def validar_entorno():
    if Turno.query.count() > 0:
        raise RuntimeError(
            "Simulación cancelada: ya existen turnos. "
            "No se tocarán datos existentes."
        )

def obtener_franjas(sede, tramite, cantidad):
    ahora = datetime.now(ZoneInfo("America/Bogota"))

    franjas = Franja.query.filter_by(
        punto_id=sede.id,
        tramite_id=tramite.id,
        activa=True,
    ).order_by(
        Franja.fecha.asc(),
        Franja.hora_inicio.asc(),
    ).all()

    disponibles = [
        f for f in franjas
        if datetime.combine(
            f.fecha, f.hora_inicio
        ).replace(tzinfo=ZoneInfo("America/Bogota")) > ahora
    ]

    if len(disponibles) < cantidad:
        raise RuntimeError(
            f"La sede {sede.id} no tiene suficientes franjas futuras."
        )

    return disponibles[:cantidad]

def crear_clientes_y_turnos():
    creados = []

    for sede_id, cantidad in CLIENTES_POR_SEDE.items():
        sede = db.session.get(Punto, sede_id)

        if not sede or not sede.activo:
            raise RuntimeError(f"Sede {sede_id} inactiva o inexistente.")

        tramite = Tramite.query.filter_by(activo=True).order_by(
            Tramite.id
        ).first()

        franjas = obtener_franjas(sede, tramite, cantidad)

        for indice, franja in enumerate(franjas, start=1):
            correo = f"simulacion_{uuid4().hex[:12]}@filacero.test"
            cliente = Usuario(
                nombre=f"Cliente Simulado {sede_id}-{indice}",
                correo=correo,
                password_hash=generate_password_hash(uuid4().hex),
                rol="CLIENTE",
                activo=True,
            )
            db.session.add(cliente)
            db.session.flush()

            turno = crear_turno(
                usuario_id=cliente.id,
                tramite_id=tramite.id,
                punto_id=sede.id,
                franja_id=franja.id,
            )

            creados.append({
                "cliente_id": cliente.id,
                "turno_id": turno.id,
                "sede_id": sede.id,
            })

    return creados

def procesar_turnos(creados):
    total = 0

    for sede_id in CLIENTES_POR_SEDE:
        agente = Usuario.query.filter_by(
            rol="AGENTE",
            activo=True,
            punto_asignado_id=sede_id,
        ).order_by(Usuario.id).first()

        if not agente:
            raise RuntimeError(f"La sede {sede_id} no tiene agente activo.")

        esperados = sum(t["sede_id"] == sede_id for t in creados)

        for _ in range(esperados):
            turno = llamar_siguiente(agente.id)
            iniciar_atencion(agente.id, turno.id)
            finalizar_atencion(agente.id, turno.id)
            total += 1

    return total


def limpiar_simulacion(creados):
    ids_turnos = [t["turno_id"] for t in creados]
    ids_clientes = [t["cliente_id"] for t in creados]

    try:
        Turno.query.filter(Turno.id.in_(ids_turnos)).delete(
            synchronize_session=False
        )
        Usuario.query.filter(Usuario.id.in_(ids_clientes)).delete(
            synchronize_session=False
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

if __name__ == "__main__":
    with app.app_context():
        creados = []

        try:
            validar_entorno()
            creados = crear_clientes_y_turnos()
            db.session.commit()

            atendidos = procesar_turnos(creados)

            print("SIMULACIÓN FINALIZADA")
            print(f"Turnos creados: {len(creados)}")
            print(f"Turnos atendidos: {atendidos}")
            print("Distribución: Centro 25, Laureles 15, El Poblado 10")

        except Exception as error:
            db.session.rollback()
            print(f"ERROR: {error}")

        finally:
            if creados:
                limpiar_simulacion(creados)
                print("Datos temporales eliminados.")

