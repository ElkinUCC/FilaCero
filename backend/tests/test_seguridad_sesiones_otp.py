from app.dominios.turnos import otp


def test_otp_sin_modo_prueba_se_envia_sin_devolverse_en_la_respuesta(app, client, monkeypatch):
    enviados = []
    app.config.update(OTP_TEST_MODE=False)
    monkeypatch.setattr(otp, "_enviar_sms", lambda celular, codigo: enviados.append(codigo))

    respuesta = client.post(
        "/api/v1/turnos/publico/solicitar-codigo",
        json={"celular": "3001234567"},
    )

    assert respuesta.status_code == 200
    assert respuesta.get_json()["modo_prueba"] is False
    assert "codigo_prueba" not in respuesta.get_json()
    assert len(enviados) == 1


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
