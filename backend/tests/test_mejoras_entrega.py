"""Pruebas de cola ordenada y turno en curso por asesor."""

from datetime import date, datetime, time, timedelta

import pytest
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.servicios import crear_turno
from app.dominios.usuarios.modelos import Usuario

CELULAR_A = "3001234567"
CELULAR_B = "3009999999"


def _crear_app(cola_solo_hoy):
    return create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "JWT_SECRET_KEY": "PRUEBAS-FilaCero-JWT-Clave-Segura-2026",
            "COLA_SOLO_HOY": cola_solo_hoy,
        }
    )


@pytest.fixture
def app_cola_libre():
    app = _crear_app(False)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def app_cola_hoy():
    app = _crear_app(True)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


def sembrar(horarios):
    """horarios: lista de (días desde hoy, hora de inicio). Devuelve entidades creadas."""
    cliente = Usuario(
        nombre="Cliente A",
        correo="a@prueba.local",
        password_hash="x",
        rol="CLIENTE",
        activo=True,
        celular=CELULAR_A,
    )
    otro = Usuario(
        nombre="Cliente B",
        correo="b@prueba.local",
        password_hash="x",
        rol="CLIENTE",
        activo=True,
        celular=CELULAR_B,
    )
    punto = Punto(nombre="Sede de prueba", activo=True)
    tramite = Tramite(nombre="Trámite de prueba", tiempo_estimado=15, activo=True)
    db.session.add_all([cliente, otro, punto, tramite])
    db.session.flush()

    agente = Usuario(
        nombre="Agente",
        correo="agente@prueba.local",
        password_hash="x",
        rol="AGENTE",
        activo=True,
        punto_asignado_id=punto.id,
    )
    franjas = []
    for dias, inicio in horarios:
        fin = (datetime.combine(date.today(), inicio) + timedelta(minutes=15)).time()
        franjas.append(
            Franja(
                punto_id=punto.id,
                tramite_id=tramite.id,
                fecha=date.today() + timedelta(days=dias),
                hora_inicio=inicio,
                hora_fin=fin,
                capacidad=1,
                activa=True,
            )
        )
    db.session.add_all(franjas + [agente])
    db.session.commit()

    return {
        "cliente": cliente,
        "otro": otro,
        "punto": punto,
        "tramite": tramite,
        "agente": agente,
        "franjas": franjas,
    }


def reservar(datos, franja, usuario=None):
    return crear_turno(
        usuario_id=(usuario or datos["cliente"]).id,
        tramite_id=datos["tramite"].id,
        punto_id=datos["punto"].id,
        franja_id=franja.id,
    )


def cabecera(app, usuario_id, rol):
    with app.app_context():
        token = create_access_token(identity=str(usuario_id), additional_claims={"rol": rol})
    return {"Authorization": f"Bearer {token}"}


def test_cola_se_ordena_por_hora_de_franja(app_cola_libre):
    datos = sembrar([(2, time(11, 0)), (2, time(9, 0))])
    tarde = reservar(datos, datos["franjas"][0])  # reservó primero, franja 11:00
    temprano = reservar(datos, datos["franjas"][1], datos["otro"])  # franja 09:00

    respuesta = app_cola_libre.test_client().get(
        "/api/v1/agente/cola",
        headers=cabecera(app_cola_libre, datos["agente"].id, "AGENTE"),
    )

    codigos = [t["codigo"] for t in respuesta.get_json()["turnos"]]
    assert codigos == [temprano.codigo, tarde.codigo]


def test_cola_solo_hoy_oculta_turnos_de_otros_dias(app_cola_hoy):
    datos = sembrar([(2, time(10, 0))])
    reservar(datos, datos["franjas"][0])
    cliente = app_cola_hoy.test_client()
    headers = cabecera(app_cola_hoy, datos["agente"].id, "AGENTE")

    cola = cliente.get("/api/v1/agente/cola", headers=headers)
    assert cola.get_json()["total_en_espera"] == 0

    llamado = cliente.post("/api/v1/agente/llamar-siguiente", headers=headers)
    assert llamado.status_code == 400
    assert "No hay turnos pendientes" in llamado.get_json()["error"]


def test_agente_no_llama_otro_turno_con_uno_en_curso(app_cola_libre):
    datos = sembrar([(2, time(9, 0)), (2, time(9, 15))])
    reservar(datos, datos["franjas"][0])
    reservar(datos, datos["franjas"][1], datos["otro"])
    cliente = app_cola_libre.test_client()
    headers = cabecera(app_cola_libre, datos["agente"].id, "AGENTE")

    primero = cliente.post("/api/v1/agente/llamar-siguiente", headers=headers)
    assert primero.status_code == 200

    segundo = cliente.post("/api/v1/agente/llamar-siguiente", headers=headers)
    assert segundo.status_code == 400
    assert "en curso" in segundo.get_json()["error"]


def test_cliente_no_consulta_espera_de_turno_ajeno(app_cola_libre):
    datos = sembrar([(2, time(10, 0))])
    turno = reservar(datos, datos["franjas"][0])
    cliente = app_cola_libre.test_client()
    ruta = f"/api/v1/turnos/{turno.id}/tiempo-espera"

    ajeno = cliente.get(ruta, headers=cabecera(app_cola_libre, datos["otro"].id, "CLIENTE"))
    assert ajeno.status_code == 404

    propio = cliente.get(ruta, headers=cabecera(app_cola_libre, datos["cliente"].id, "CLIENTE"))
    assert propio.status_code == 200
    assert "tiempo_estimado_minutos" in propio.get_json()


def test_consulta_y_cancelacion_publica_exigen_celular_correcto(app_cola_libre):
    datos = sembrar([(2, time(10, 0))])
    turno = reservar(datos, datos["franjas"][0])
    cliente = app_cola_libre.test_client()

    correcto = {"codigo": turno.codigo, "celular": CELULAR_A}
    incorrecto = {"codigo": turno.codigo, "celular": CELULAR_B}

    assert cliente.post("/api/v1/turnos/publico/consultar", json=incorrecto).status_code == 400

    assert cliente.post("/api/v1/turnos/publico/consultar", json=correcto).status_code == 400
    solicitud = cliente.post("/api/v1/turnos/publico/solicitar-codigo", json={"celular": CELULAR_A})
    assert solicitud.status_code == 200
    verificacion = cliente.post(
        "/api/v1/turnos/publico/verificar-codigo",
        json={
            "celular": CELULAR_A,
            "codigo": solicitud.get_json()["codigo_prueba"],
            "proposito": "consulta",
            "codigo_turno": turno.codigo,
        },
    )
    assert verificacion.status_code == 200
    consulta = cliente.post(
        "/api/v1/turnos/publico/consultar",
        json={**correcto, "token_verificacion": verificacion.get_json()["token_verificacion"]},
    )
    assert consulta.status_code == 200
    assert consulta.get_json()["turno"]["codigo"] == turno.codigo
    assert "espera" in consulta.get_json()

    assert cliente.post("/api/v1/turnos/publico/cancelar", json=incorrecto).status_code == 400

    solicitud = cliente.post("/api/v1/turnos/publico/solicitar-codigo", json={"celular": CELULAR_A})
    assert solicitud.status_code == 200
    verificacion = cliente.post(
        "/api/v1/turnos/publico/verificar-codigo",
        json={
            "celular": CELULAR_A,
            "codigo": solicitud.get_json()["codigo_prueba"],
            "proposito": "cancelacion",
            "codigo_turno": turno.codigo,
        },
    )
    assert verificacion.status_code == 200
    cancelado = cliente.post(
        "/api/v1/turnos/publico/cancelar",
        json={**correcto, "token_verificacion": verificacion.get_json()["token_verificacion"]},
    )
    assert cancelado.status_code == 200
    assert cancelado.get_json()["turno"]["estado"] == "CANCELADO"


def test_errores_de_validacion_devuelven_json_400(app_cola_libre):
    respuesta = app_cola_libre.test_client().post("/api/v1/usuarios/registro", json={})
    assert respuesta.status_code == 400
    assert "error" in respuesta.get_json()


def test_ruta_inexistente_devuelve_json(app_cola_libre):
    respuesta = app_cola_libre.test_client().get("/api/v1/no-existe")
    assert respuesta.status_code == 404
    assert "error" in respuesta.get_json()
