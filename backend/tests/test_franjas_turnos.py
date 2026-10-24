from datetime import date, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app import create_app, db
from app.dominios.usuarios.modelos import Usuario
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.franjas.modelos import Franja
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.servicios import crear_turno


@pytest.fixture
def app_prueba():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "PRUEBAS-FilaCero-JWT-Clave-Segura-2026",
    })

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def datos(app_prueba):
    usuario = Usuario(
        nombre="Cliente de prueba",
        correo="cliente1@prueba.local",
        password_hash="hash-de-prueba",
        rol="CLIENTE",
        activo=True,
    )

    usuario2 = Usuario(
        nombre="Segundo cliente",
        correo="cliente2@prueba.local",
        password_hash="hash-de-prueba",
        rol="CLIENTE",
        activo=True,
    )

    punto = Punto(
        nombre="Sede de prueba",
        direccion="Dirección de prueba",
        activo=True,
    )

    tramite = Tramite(
        nombre="Trámite de prueba",
        descripcion="Prueba automatizada",
        tiempo_estimado=15,
        activo=True,
    )

    db.session.add_all([usuario, usuario2, punto, tramite])
    db.session.flush()

    franja = Franja(
        punto_id=punto.id,
        tramite_id=tramite.id,
        fecha=date.today() + timedelta(days=2),
        hora_inicio=time(10, 0),
        hora_fin=time(11, 0),
        capacidad=2,
        activa=True,
    )

    db.session.add(franja)
    db.session.commit()

    return {
        "usuario": usuario,
        "usuario2": usuario2,
        "punto": punto,
        "tramite": tramite,
        "franja": franja,
    }


def reservar(datos, usuario=None, punto_id=None, tramite_id=None):
    return crear_turno(
        usuario_id=(usuario or datos["usuario"]).id,
        tramite_id=tramite_id or datos["tramite"].id,
        punto_id=punto_id or datos["punto"].id,
        franja_id=datos["franja"].id,
    )


def test_crea_reserva_valida(app_prueba, datos):
    turno = reservar(datos)

    assert turno.id is not None
    assert turno.estado == "ESPERANDO"
    assert turno.franja_id == datos["franja"].id
    assert turno.codigo.startswith("FC-")


def test_no_permite_reservar_dos_veces_la_misma_franja(
    app_prueba, datos
):
    reservar(datos)

    with pytest.raises(ValueError, match="Ya tienes una reserva"):
        reservar(datos)


def test_no_supera_capacidad(app_prueba, datos):
    datos["franja"].capacidad = 1
    db.session.commit()

    reservar(datos)

    with pytest.raises(ValueError, match="no tiene cupos"):
        reservar(datos, usuario=datos["usuario2"])


def test_cancelacion_libera_cupo_y_permite_reservar_de_nuevo(
    app_prueba, datos
):
    datos["franja"].capacidad = 1
    db.session.commit()

    turno = reservar(datos)
    turno.estado = "CANCELADO"
    db.session.commit()

    nuevo_turno = reservar(datos)

    assert nuevo_turno.id != turno.id
    assert nuevo_turno.estado == "ESPERANDO"


def test_rechaza_sede_que_no_corresponde_a_la_franja(
    app_prueba, datos
):
    otra_sede = Punto(
        nombre="Otra sede",
        direccion="Otra dirección",
        activo=True,
    )
    db.session.add(otra_sede)
    db.session.commit()

    with pytest.raises(ValueError, match="no corresponde"):
        reservar(datos, punto_id=otra_sede.id)


def test_rechaza_franja_que_ya_comenzo(app_prueba, datos):
    zona = ZoneInfo("America/Bogota")
    ahora = __import__("datetime").datetime.now(zona)

    datos["franja"].fecha = ahora.date()
    datos["franja"].hora_inicio = (
        ahora - timedelta(minutes=10)
    ).time().replace(tzinfo=None)
    datos["franja"].hora_fin = (
        ahora + timedelta(minutes=30)
    ).time().replace(tzinfo=None)
    db.session.commit()

    with pytest.raises(ValueError, match="ya comenzaron"):
        reservar(datos)

def test_no_permite_cancelar_turno_de_otro_usuario(app_prueba, datos):
    from app.dominios.turnos.servicios import cancelar_turno

    turno = reservar(datos)
    with pytest.raises(ValueError, match="otro usuario"):
        cancelar_turno(turno.id, datos["usuario2"].id)


def test_cancelar_turno_cambia_estado(app_prueba, datos):
    from app.dominios.turnos.servicios import cancelar_turno

    turno = reservar(datos)
    cancelado = cancelar_turno(turno.id, datos["usuario"].id)

    assert cancelado.estado == "CANCELADO"


def test_rechaza_tramite_que_no_corresponde(app_prueba, datos):
    otro_tramite = Tramite(
        nombre="Otro trámite",
        descripcion="Prueba",
        tiempo_estimado=20,
        activo=True,
    )
    db.session.add(otro_tramite)
    db.session.commit()

    with pytest.raises(ValueError, match="no corresponde"):
        reservar(datos, tramite_id=otro_tramite.id)
from flask_jwt_extended import create_access_token

def test_cliente_no_puede_crear_franjas(app_prueba):
    with app_prueba.app_context():
        token = create_access_token(
            identity="1",
            additional_claims={"rol": "CLIENTE"}
        )

    cliente = app_prueba.test_client()
    respuesta = cliente.post(
        "/api/v1/admin/franjas/",
        json={},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert respuesta.status_code == 403


def test_sin_token_no_puede_crear_franjas(app_prueba):
    respuesta = app_prueba.test_client().post(
        "/api/v1/admin/franjas/",
        json={}
    )
    assert respuesta.status_code == 401


def test_cliente_no_puede_crear_sedes(app_prueba):
    with app_prueba.app_context():
        token = create_access_token(
            identity="1",
            additional_claims={"rol": "CLIENTE"}
        )

    respuesta = app_prueba.test_client().post(
        "/api/v1/sedes/",
        json={"nombre": "Sede no autorizada"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert respuesta.status_code == 403


def test_cliente_no_puede_crear_tramites(app_prueba):
    with app_prueba.app_context():
        token = create_access_token(
            identity="1",
            additional_claims={"rol": "CLIENTE"}
        )

    respuesta = app_prueba.test_client().post(
        "/api/v1/tramites/",
        json={
            "nombre": "Trámite no autorizado",
            "tiempo_estimado": 15
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert respuesta.status_code == 403
from datetime import date, timedelta
from flask_jwt_extended import create_access_token


def token_usuario(app, usuario_id, rol="CLIENTE"):
    with app.app_context():
        return create_access_token(
            identity=str(usuario_id),
            additional_claims={"rol": rol}
        )


def test_consultar_franjas_disponibles(app_prueba, datos):
    respuesta = app_prueba.test_client().get(
        "/api/v1/franjas/",
        query_string={
            "punto_id": datos["punto"].id,
            "tramite_id": datos["tramite"].id,
            "fecha": datos["franja"].fecha.isoformat()
        }
    )
    assert respuesta.status_code == 200
    franjas = respuesta.get_json()["franjas"]
    assert len(franjas) == 1
    assert franjas[0]["disponibles"] == 2


def test_reservar_turno_por_api(app_prueba, datos):
    cliente = app_prueba.test_client()
    token = token_usuario(app_prueba, datos["usuario"].id)

    respuesta = cliente.post(
        "/api/v1/turnos/",
        json={
            "tramite_id": datos["tramite"].id,
            "punto_id": datos["punto"].id,
            "franja_id": datos["franja"].id
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert respuesta.status_code == 201
    assert respuesta.get_json()["estado"] == "ESPERANDO"


def test_consultar_solo_mis_turnos_por_api(app_prueba, datos):
    from app.dominios.turnos.servicios import crear_turno

    crear_turno(
        datos["usuario"].id,
        datos["tramite"].id,
        datos["punto"].id,
        datos["franja"].id
    )

    cliente = app_prueba.test_client()
    token = token_usuario(app_prueba, datos["usuario2"].id)
    respuesta = cliente.get(
        "/api/v1/turnos/mis-turnos",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert respuesta.status_code == 200
    assert respuesta.get_json()["turnos"] == []


def test_cancelar_turno_por_api(app_prueba, datos):
    from app.dominios.turnos.servicios import crear_turno

    turno = crear_turno(
        datos["usuario"].id,
        datos["tramite"].id,
        datos["punto"].id,
        datos["franja"].id
    )

    cliente = app_prueba.test_client()
    token = token_usuario(app_prueba, datos["usuario"].id)
    respuesta = cliente.post(
        f"/api/v1/turnos/{turno.id}/cancelar",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert respuesta.status_code == 200
    assert respuesta.get_json()["turno"]["estado"] == "CANCELADO"

def crear_agente(datos):
    agente = Usuario(
        nombre="Agente de prueba",
        correo="agente@prueba.local",
        password_hash="hash-de-prueba",
        rol="AGENTE",
        activo=True,
        punto_asignado_id=datos["punto"].id,
    )
    db.session.add(agente)
    db.session.commit()
    return agente


def test_agente_completa_ciclo_de_atencion(app_prueba, datos):
    agente = crear_agente(datos)
    turno = reservar(datos)
    cliente = app_prueba.test_client()
    token = token_usuario(
        app_prueba, agente.id, rol="AGENTE"
    )
    headers = {"Authorization": f"Bearer {token}"}

    respuesta = cliente.get(
        "/api/v1/agente/cola", headers=headers
    )
    assert respuesta.status_code == 200
    assert respuesta.get_json()["total_en_espera"] == 1

    respuesta = cliente.post(
        "/api/v1/agente/llamar-siguiente",
        headers=headers
    )
    assert respuesta.status_code == 200
    assert respuesta.get_json()["turno"]["estado"] == "LLAMADO"

    respuesta = cliente.post(
        f"/api/v1/agente/turnos/{turno.id}/iniciar",
        headers=headers
    )
    assert respuesta.status_code == 200
    assert respuesta.get_json()["turno"]["estado"] == "EN_ATENCION"

    respuesta = cliente.post(
        f"/api/v1/agente/turnos/{turno.id}/finalizar",
        headers=headers
    )
    assert respuesta.status_code == 200

    resultado = respuesta.get_json()["turno"]
    assert resultado["estado"] == "ATENDIDO"
    assert resultado["agente_id"] == agente.id
    assert resultado["fecha_inicio"] is not None
    assert resultado["fecha_fin"] is not None


def test_cliente_no_puede_usar_consola_agente(app_prueba, datos):
    token = token_usuario(
        app_prueba, datos["usuario"].id, rol="CLIENTE"
    )

    respuesta = app_prueba.test_client().get(
        "/api/v1/agente/cola",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert respuesta.status_code == 403


def test_agente_no_puede_atender_turno_de_otra_sede(
    app_prueba, datos
):
    agente = crear_agente(datos)
    otra_sede = Punto(
        nombre="Sede diferente",
        direccion="Otra dirección",
        activo=True,
    )
    db.session.add(otra_sede)
    db.session.flush()

    otro_tramite = Tramite(
        nombre="Trámite alternativo",
        descripcion="Prueba de aislamiento",
        tiempo_estimado=20,
        activo=True,
    )
    db.session.add(otro_tramite)
    db.session.flush()

    franja = Franja(
        punto_id=otra_sede.id,
        tramite_id=otro_tramite.id,
        fecha=date.today() + timedelta(days=3),
        hora_inicio=time(10, 0),
        hora_fin=time(11, 0),
        capacidad=2,
        activa=True,
    )
    db.session.add(franja)
    db.session.commit()

    turno = crear_turno(
        datos["usuario"].id,
        otro_tramite.id,
        otra_sede.id,
        franja.id,
    )

    token = token_usuario(
        app_prueba, agente.id, rol="AGENTE"
    )
    respuesta = app_prueba.test_client().post(
        f"/api/v1/agente/turnos/{turno.id}/iniciar",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert respuesta.status_code == 400
