"""Contrato de respuesta y errores de dominio (app/errores.py)."""


def test_respuestas_exitosas_llevan_success_true(client):
    cuerpo = client.get("/health").get_json()
    assert cuerpo["success"] is True
    assert cuerpo["status"] == "ok"


def test_ruta_inexistente_responde_error_uniforme(client):
    respuesta = client.get("/api/v1/no-existe")
    assert respuesta.status_code == 404
    assert respuesta.get_json() == {"success": False, "error": "Recurso no encontrado."}


def test_credenciales_invalidas_responden_401(client, crear_personal):
    usuario = crear_personal("ADMIN")
    respuesta = client.post(
        "/api/v1/usuarios/login", json={"correo": usuario.correo, "password": "Otra12345"}
    )
    assert respuesta.status_code == 401
    assert respuesta.get_json()["success"] is False
    assert respuesta.get_json()["error"] == "Correo o contraseña incorrectos."


def test_cuenta_bloqueada_responde_429(client, crear_personal):
    usuario = crear_personal("ADMIN")
    for _ in range(5):
        client.post("/api/v1/usuarios/login", json={"correo": usuario.correo, "password": "x"})
    respuesta = client.post(
        "/api/v1/usuarios/login", json={"correo": usuario.correo, "password": "Prueba12345"}
    )
    assert respuesta.status_code == 429
    assert "bloqueada" in respuesta.get_json()["error"]


def test_sede_inexistente_responde_404_y_duplicada_409(client, admin_auth):
    assert (
        client.put("/api/v1/sedes/999", json={"nombre": "X"}, headers=admin_auth).status_code == 404
    )

    creada = client.post("/api/v1/sedes/", json={"nombre": "Sede Norte"}, headers=admin_auth)
    assert creada.status_code == 201
    assert creada.get_json()["success"] is True

    repetida = client.post("/api/v1/sedes/", json={"nombre": "sede norte"}, headers=admin_auth)
    assert repetida.status_code == 409
    assert repetida.get_json()["error"] == "Ya existe una sede con ese nombre."


def test_datos_invalidos_responden_400(client, admin_auth):
    respuesta = client.post(
        "/api/v1/tramites/", json={"nombre": "Revisión", "tiempo_estimado": 0}, headers=admin_auth
    )
    assert respuesta.status_code == 400
    assert respuesta.get_json()["success"] is False


def test_asesor_no_entra_a_rutas_de_admin(client, agente_auth):
    respuesta = client.get("/api/v1/admin/usuarios/", headers=agente_auth)
    assert respuesta.status_code == 403
    assert respuesta.get_json()["success"] is False


def test_sin_token_responde_401(client):
    respuesta = client.get("/api/v1/agente/panel")
    assert respuesta.status_code == 401
    assert respuesta.get_json() == {"success": False, "error": "Debes iniciar sesión."}


def test_logout_revoca_al_instante_aunque_sea_el_mismo_segundo(client, crear_personal, auth):
    cabeceras = auth(crear_personal("ADMIN"))
    assert client.post("/api/v1/usuarios/logout", headers=cabeceras).status_code == 200
    assert client.get("/api/v1/usuarios/me", headers=cabeceras).status_code == 401


def test_token_nuevo_tras_cambiar_clave_sigue_valido(client, crear_personal, auth):
    cabeceras = auth(crear_personal("ADMIN"))
    r = client.post(
        "/api/v1/usuarios/me/clave",
        json={"actual": "Prueba12345", "nueva": "OtraClave2026"},
        headers=cabeceras,
    )
    assert r.status_code == 200
    nuevo = {"Authorization": f"Bearer {r.get_json()['access_token']}"}
    assert client.get("/api/v1/usuarios/me", headers=nuevo).status_code == 200
    assert client.get("/api/v1/usuarios/me", headers=cabeceras).status_code == 401
