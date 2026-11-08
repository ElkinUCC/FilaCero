import pytest

from app import create_app
from app.dominios.turnos import otp


def test_produccion_rechaza_otp_de_prueba_aunque_demo_publica_este_activo():
    configuracion = {
        "PRODUCCION": True,
        "SECRET_KEY": "secreto-produccion-fuerte-" * 2,
        "JWT_SECRET_KEY": "jwt-produccion-fuerte-" * 2,
        "OTP_TEST_MODE": True,
        "DEMO_PUBLICA": True,
        "DEBUG": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",
        "CORS_ALLOWED_ORIGINS": ["https://filacero.vercel.app"],
    }

    with pytest.raises(RuntimeError, match="FILACERO_OTP_TEST_MODE"):
        create_app(configuracion)

    configuracion["OTP_TEST_MODE"] = False
    app_produccion = create_app(configuracion)
    assert app_produccion.config["PRODUCCION"] is True
    assert app_produccion.config["OTP_TEST_MODE"] is False


def test_otp_en_produccion_se_envia_sin_devolverse_en_la_respuesta(app, client, monkeypatch):
    enviados = []
    app.config.update(PRODUCCION=True, OTP_TEST_MODE=True, DEMO_PUBLICA=True)
    monkeypatch.setattr(otp, "_enviar_sms", lambda celular, codigo: enviados.append(codigo))

    respuesta = client.post(
        "/api/v1/turnos/publico/solicitar-codigo",
        json={"celular": "3001234567"},
    )

    assert respuesta.status_code == 200
    assert respuesta.get_json()["modo_prueba"] is False
    assert "codigo_prueba" not in respuesta.get_json()
    assert len(enviados) == 1


def test_otp_demo_produccion_solo_acepta_celular_y_codigo_configurados(
    app, client, monkeypatch
):
    app.config.update(
        PRODUCCION=True,
        DEBUG=False,
        SECRET_KEY="secreto-produccion-fuerte-" * 2,
        JWT_SECRET_KEY="jwt-produccion-fuerte-" * 2,
        CORS_ALLOWED_ORIGINS=["https://fila-cero-omega.vercel.app"],
        OTP_TEST_MODE=False,
        OTP_DEMO_ENABLED=True,
        OTP_DEMO_PHONE="3007654321",
        OTP_DEMO_CODE="123456",
    )
    from app.config import validar_configuracion

    validar_configuracion(app)
    monkeypatch.setattr(
        otp,
        "_enviar_sms",
        lambda *_args: pytest.fail("El modo demo no debe enviar SMS."),
    )

    rechazado = client.post(
        "/api/v1/turnos/publico/solicitar-codigo",
        json={"celular": "3001234567"},
    )
    assert rechazado.status_code == 403
    assert "codigo_prueba" not in rechazado.get_json()

    solicitud = client.post(
        "/api/v1/turnos/publico/solicitar-codigo",
        json={"celular": "3007654321"},
    )
    assert solicitud.status_code == 200
    assert solicitud.get_json()["modo_prueba"] is True
    assert solicitud.get_json()["codigo_prueba"] == "123456"

    codigo_para_otro_numero = client.post(
        "/api/v1/turnos/publico/verificar-codigo",
        json={"celular": "3001234567", "codigo": "123456"},
    )
    assert codigo_para_otro_numero.status_code == 400

    verificado = client.post(
        "/api/v1/turnos/publico/verificar-codigo",
        json={"celular": "3007654321", "codigo": "123456"},
    )
    assert verificado.status_code == 200
    assert verificado.get_json()["token_verificacion"]


def test_produccion_rechaza_configuracion_invalida_de_otp_demo():
    configuracion = {
        "PRODUCCION": True,
        "SECRET_KEY": "secreto-produccion-fuerte-" * 2,
        "JWT_SECRET_KEY": "jwt-produccion-fuerte-" * 2,
        "OTP_TEST_MODE": False,
        "OTP_DEMO_ENABLED": True,
        "OTP_DEMO_PHONE": "555",
        "OTP_DEMO_CODE": "123",
        "DEBUG": False,
        "SQLALCHEMY_DATABASE_URI": "sqlite://",
        "CORS_ALLOWED_ORIGINS": ["https://fila-cero-omega.vercel.app"],
    }

    with pytest.raises(RuntimeError, match="FILACERO_OTP_DEMO_PHONE"):
        create_app(configuracion)


def test_otp_de_prueba_no_se_expone_a_solicitudes_remotas(app, client, monkeypatch):
    enviados = []
    monkeypatch.setattr(otp, "_enviar_sms", lambda celular, codigo: enviados.append(codigo))

    respuesta = client.post(
        "/api/v1/turnos/publico/solicitar-codigo",
        json={"celular": "3001234567"},
        environ_overrides={"REMOTE_ADDR": "198.51.100.20"},
    )

    assert respuesta.status_code == 200
    assert respuesta.get_json()["modo_prueba"] is False
    assert "codigo_prueba" not in respuesta.get_json()
    assert len(enviados) == 1


def test_administrador_cambia_clave_de_agente_y_revoca_tokens(client, crear_personal, auth):
    administrador = crear_personal("ADMIN")
    agente = crear_personal("AGENTE")
    headers_agente = auth(agente)
    headers_admin = auth(administrador)

    assert client.get("/api/v1/agente/panel", headers=headers_agente).status_code == 200
    respuesta = client.put(
        f"/api/v1/admin/agentes/{agente.id}",
        headers=headers_admin,
        json={"password": "NuevaClave123"},
    )
    assert respuesta.status_code == 200
    assert client.get("/api/v1/agente/panel", headers=headers_agente).status_code == 401

    nuevo_login = client.post(
        "/api/v1/usuarios/login",
        json={"correo": agente.correo, "password": "NuevaClave123"},
    )
    assert nuevo_login.status_code == 200
    nuevo_token = {"Authorization": f"Bearer {nuevo_login.get_json()['access_token']}"}
    assert client.get("/api/v1/agente/panel", headers=nuevo_token).status_code == 200


def test_desactivar_y_reactivar_agente_no_restablece_tokens_anteriores(
    client, crear_personal, auth
):
    administrador = crear_personal("ADMIN")
    agente = crear_personal("AGENTE")
    headers_agente = auth(agente)
    headers_admin = auth(administrador)

    respuesta = client.put(
        f"/api/v1/admin/agentes/{agente.id}",
        headers=headers_admin,
        json={"activo": False},
    )
    assert respuesta.status_code == 200
    assert client.get("/api/v1/agente/panel", headers=headers_agente).status_code == 401

    respuesta = client.put(
        f"/api/v1/admin/agentes/{agente.id}",
        headers=headers_admin,
        json={"activo": True},
    )
    assert respuesta.status_code == 200
    assert client.get("/api/v1/agente/panel", headers=headers_agente).status_code == 401


def test_cambio_de_clave_propia_revoca_token_anterior_y_emite_sesion_nueva(
    client, crear_personal, auth
):
    usuario = crear_personal("CLIENTE")
    headers_anteriores = auth(usuario)

    respuesta = client.post(
        "/api/v1/usuarios/me/clave",
        headers=headers_anteriores,
        json={"actual": "Prueba12345", "nueva": "NuevaClave123"},
    )
    assert respuesta.status_code == 200
    assert client.get("/api/v1/usuarios/me", headers=headers_anteriores).status_code == 401

    token_nuevo = {"Authorization": f"Bearer {respuesta.get_json()['access_token']}"}
    assert client.get("/api/v1/usuarios/me", headers=token_nuevo).status_code == 200
    nuevo_login = client.post(
        "/api/v1/usuarios/login",
        json={"correo": usuario.correo, "password": "NuevaClave123"},
    )
    assert nuevo_login.status_code == 200
