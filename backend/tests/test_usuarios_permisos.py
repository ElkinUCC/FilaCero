"""Usuarios, roles, credenciales y auditoría."""

import pytest
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.dominios.sedes.modelos import Punto
from app.dominios.usuarios.modelos import Usuario
from app.seguridad import encriptar_password, reiniciar_limites


@pytest.fixture
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "JWT_SECRET_KEY": "PRUEBAS-FilaCero-JWT-Clave-Segura-2026",
        }
    )
    with app.app_context():
        db.create_all()
        reiniciar_limites()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def gente(app):
    sede = Punto(nombre="Sede Centro", activo=True)
    db.session.add(sede)
    db.session.commit()
    admin = Usuario(
        nombre="Admin Uno",
        correo="admin@x.co",
        rol="ADMIN",
        password_hash=encriptar_password("Admin12345"),
    )
    agente = Usuario(
        nombre="Asesor Uno",
        correo="asesor@x.co",
        rol="AGENTE",
        punto_asignado_id=sede.id,
        password_hash=encriptar_password("Asesor12345"),
    )
    db.session.add_all([admin, agente])
    db.session.commit()
    return {"sede": sede, "admin": admin, "agente": agente}


def h(usuario):
    return {
        "Authorization": "Bearer "
        + create_access_token(identity=str(usuario.id), additional_claims={"rol": usuario.rol})
    }


def login(cliente, correo, clave):
    return cliente.post("/api/v1/usuarios/login", json={"correo": correo, "password": clave})


def test_admin_crea_supervisor_con_clave_temporal_y_debe_cambiarla(app, gente):
    c = app.test_client()
    r = c.post(
        "/api/v1/admin/usuarios/",
        headers=h(gente["admin"]),
        json={"nombre": "Sara Supervisora", "correo": "sara@x.co", "rol": "SUPERVISOR"},
    )
    assert r.status_code == 201
    temporal = r.get_json()["clave_temporal"]
    assert r.get_json()["usuario"]["debe_cambiar_clave"] is True

    r = login(c, "sara@x.co", temporal)
    token = {"Authorization": "Bearer " + r.get_json()["access_token"]}
    # Mientras no cambie la clave, no puede usar el panel.
    bloqueo = c.get("/api/v1/admin/agentes/metricas", headers=token)
    assert bloqueo.status_code == 403 and bloqueo.get_json()["codigo"] == "CAMBIAR_CLAVE"

    r = c.post(
        "/api/v1/usuarios/me/clave",
        headers=token,
        json={"actual": temporal, "nueva": "NuevaClave2026"},
    )
    assert r.status_code == 200
    token = {
        "Authorization": "Bearer " + r.get_json()["access_token"]
    }  # el anterior quedó revocado
    # Supervisor: puede leer métricas pero no crear sedes ni usuarios.
    assert c.get("/api/v1/admin/agentes/metricas", headers=token).status_code == 200
    assert c.post("/api/v1/sedes/", headers=token, json={"nombre": "X sede"}).status_code == 403
    assert c.get("/api/v1/admin/usuarios/", headers=token).status_code == 403


def test_cambio_de_rol_aplica_de_inmediato(app, gente):
    c = app.test_client()
    token_viejo = h(gente["agente"])
    assert c.get("/api/v1/agente/panel", headers=token_viejo).status_code == 200
    r = c.put(
        f"/api/v1/admin/usuarios/{gente['agente'].id}",
        headers=h(gente["admin"]),
        json={"rol": "SUPERVISOR"},
    )
    assert r.status_code == 200 and r.get_json()["usuario"]["punto_asignado_id"] is None
    # Acceso denegado al instante
    assert c.get("/api/v1/agente/panel", headers=token_viejo).status_code in (401, 403)


def test_protecciones_del_administrador(app, gente):
    c = app.test_client()
    yo = gente["admin"]
    assert (
        c.put(f"/api/v1/admin/usuarios/{yo.id}", headers=h(yo), json={"rol": "AGENTE"}).status_code
        == 400
    )
    assert (
        c.put(f"/api/v1/admin/usuarios/{yo.id}", headers=h(yo), json={"activo": False}).status_code
        == 400
    )
    assert (
        c.post(f"/api/v1/admin/usuarios/{yo.id}/restablecer-clave", headers=h(yo)).status_code
        == 400
    )

    otro = Usuario(nombre="Admin Dos", correo="admin2@x.co", rol="ADMIN", password_hash="x")
    db.session.add(otro)
    db.session.commit()
    # Con dos admins sí se puede bajar al otro de rol.
    assert (
        c.put(
            f"/api/v1/admin/usuarios/{otro.id}", headers=h(yo), json={"rol": "SUPERVISOR"}
        ).status_code
        == 200
    )


def test_editar_correo_y_restablecer_clave(app, gente):
    c = app.test_client()
    a = gente["agente"]
    r = c.put(
        f"/api/v1/admin/usuarios/{a.id}", headers=h(gente["admin"]), json={"correo": "admin@x.co"}
    )
    assert r.status_code == 400  # correo en uso
    r = c.put(
        f"/api/v1/admin/usuarios/{a.id}", headers=h(gente["admin"]), json={"correo": "nuevo@x.co"}
    )
    assert r.get_json()["usuario"]["correo"] == "nuevo@x.co"

    r = c.post(f"/api/v1/admin/usuarios/{a.id}/restablecer-clave", headers=h(gente["admin"]))
    temporal = r.get_json()["clave_temporal"]
    assert login(c, "nuevo@x.co", "Asesor12345").status_code == 401
    assert login(c, "nuevo@x.co", temporal).get_json()["usuario"]["debe_cambiar_clave"] is True


def test_cambiar_mi_clave_exige_la_actual(app, gente):
    c = app.test_client()
    r = c.post(
        "/api/v1/usuarios/me/clave",
        headers=h(gente["agente"]),
        json={"actual": "mala", "nueva": "OtraClave99"},
    )
    assert r.status_code == 400
    r = c.post(
        "/api/v1/usuarios/me/clave",
        headers=h(gente["agente"]),
        json={"actual": "Asesor12345", "nueva": "corta"},
    )
    assert r.status_code == 400


def test_auditoria_registra_ingresos_y_cambios(app, gente):
    c = app.test_client()
    login(c, "admin@x.co", "mala")
    login(c, "admin@x.co", "Admin12345")
    c.post("/api/v1/sedes/", headers=h(gente["admin"]), json={"nombre": "Sede Norte"})
    r = c.get("/api/v1/admin/usuarios/auditoria", headers=h(gente["admin"]))
    acciones = [e["accion"] for e in r.get_json()["eventos"]]
    assert {"login_fallido", "login", "sede_creada"} <= set(acciones)
    assert r.get_json()["eventos"][0]["usuario"] == "Admin Uno"
    usuario = c.get("/api/v1/usuarios/me", headers=h(gente["admin"])).get_json()["usuario"]
    assert usuario["ultimo_acceso"]


# endurecimiento


def test_bloqueo_tras_5_intentos_y_desbloqueo_al_restablecer(app, gente):
    c = app.test_client()
    for _ in range(5):
        assert login(c, "asesor@x.co", "mala").status_code == 401
    r = login(c, "asesor@x.co", "Asesor12345")  # clave correcta, pero bloqueada
    assert r.status_code == 429 and "bloqueada" in r.get_json()["error"]

    r = c.post(
        f"/api/v1/admin/usuarios/{gente['agente'].id}/restablecer-clave", headers=h(gente["admin"])
    )
    assert login(c, "asesor@x.co", r.get_json()["clave_temporal"]).status_code == 200


def test_cambiar_clave_revoca_tokens_anteriores_y_entrega_uno_nuevo(app, gente):
    import time

    c = app.test_client()
    viejo = {
        "Authorization": "Bearer "
        + login(c, "asesor@x.co", "Asesor12345").get_json()["access_token"]
    }
    time.sleep(1.1)  # los tokens tienen resolución de 1 segundo
    r = c.post(
        "/api/v1/usuarios/me/clave",
        headers=viejo,
        json={"actual": "Asesor12345", "nueva": "NuevaClave77"},
    )
    assert r.status_code == 200
    nuevo = {"Authorization": "Bearer " + r.get_json()["access_token"]}
    assert c.get("/api/v1/usuarios/me", headers=viejo).status_code == 401
    assert c.get("/api/v1/usuarios/me", headers=nuevo).status_code == 200


def test_logout_revoca_la_sesion(app, gente):
    import time

    c = app.test_client()
    token = {
        "Authorization": "Bearer " + login(c, "admin@x.co", "Admin12345").get_json()["access_token"]
    }
    time.sleep(1.1)
    assert c.post("/api/v1/usuarios/logout", headers=token).status_code == 200
    assert c.get("/api/v1/admin/usuarios/", headers=token).status_code == 401


def test_registro_publico_deshabilitado_por_configuracion(app):
    app.config["REGISTRO_PUBLICO"] = False
    r = app.test_client().post(
        "/api/v1/usuarios/registro",
        json={"nombre": "Alguien", "correo": "x@x.co", "password": "Clave12345"},
    )
    assert r.status_code == 403
