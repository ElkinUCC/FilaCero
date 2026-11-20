"""Pruebas de aislamiento multiempresa del núcleo inicial."""

from flask_jwt_extended import create_access_token

from app.dominios.organizaciones.modelos import Organizacion
from app.dominios.sedes.modelos import Punto
from app.dominios.usuarios.modelos import Usuario
from app.seguridad import encriptar_password


def _crear_organizacion(db, **kwargs):
    organizacion = Organizacion(
        nombre=kwargs.get("nombre", "Empresa B"),
        slug=kwargs.get("slug", "empresa-b"),
        industria=kwargs.get("industria", "cooperativa"),
        pais="CO",
        zona_horaria="America/Bogota",
        idioma="es",
        moneda="COP",
        plan="essential",
        estado="activa",
        configuracion={},
    )
    db.session.add(organizacion)
    db.session.commit()
    return organizacion


def test_sedes_publicas_quedan_aisladas_por_slug(client, db):
    empresa_b = _crear_organizacion(db)
    db.session.add_all(
        [
            Punto(nombre="Sede FilaCero", organizacion_id=1, activo=True),
            Punto(nombre="Sede Empresa B", organizacion_id=empresa_b.id, activo=True),
        ]
    )
    db.session.commit()

    respuesta_a = client.get("/api/v1/sedes/")
    respuesta_b = client.get("/api/v1/sedes/", headers={"X-Organization-Slug": "empresa-b"})

    assert respuesta_a.status_code == 200
    assert respuesta_b.status_code == 200
    assert [p["nombre"] for p in respuesta_a.get_json()["puntos"]] == ["Sede FilaCero"]
    assert [p["nombre"] for p in respuesta_b.get_json()["puntos"]] == ["Sede Empresa B"]


def test_token_no_puede_cambiar_a_otra_organizacion(client, db, crear_personal, auth):
    _crear_organizacion(db)
    usuario = crear_personal("ADMIN")
    cabeceras = auth(usuario)

    respuesta = client.get(
        "/api/v1/sedes/",
        headers={**cabeceras, "X-Organization-Slug": "empresa-b"},
    )
    assert respuesta.status_code == 403


def test_usuario_de_otra_empresa_solo_ve_su_organizacion(client, db):
    empresa_b = _crear_organizacion(db)
    usuario_b = Usuario(
        nombre="Admin Empresa B",
        correo="admin@empresa-b.example",
        password_hash=encriptar_password("Prueba12345"),
        rol="ADMIN",
        activo=True,
        organizacion_id=empresa_b.id,
    )
    db.session.add(usuario_b)
    db.session.add(Punto(nombre="Sede Privada B", organizacion_id=empresa_b.id, activo=True))
    db.session.commit()

    login = client.post(
        "/api/v1/usuarios/login",
        json={"correo": usuario_b.correo, "password": "Prueba12345"},
        headers={"X-Organization-Slug": "empresa-b"},
    )
    assert login.status_code == 200
    token = login.get_json()["access_token"]

    respuesta = client.get(
        "/api/v1/sedes/",
        headers={"Authorization": f"Bearer {token}", "X-Organization-Slug": "empresa-b"},
    )
    assert respuesta.status_code == 200
    assert [p["nombre"] for p in respuesta.get_json()["puntos"]] == ["Sede Privada B"]


def test_configuracion_operativa_es_por_organizacion(client, admin_auth):
    cabeceras = admin_auth
    actualizacion = client.patch(
        "/api/v1/organizacion/actual",
        headers=cabeceras,
        json={
            "configuracion": {
                "horario": {
                    "apertura": 8,
                    "cierre": 17,
                    "dias_atencion": [0, 1, 2, 3, 4],
                    "duracion_franja_min": 20,
                    "dias_max_reserva": 45,
                }
            }
        },
    )
    assert actualizacion.status_code == 200

    horario = client.get("/api/v1/horario", headers=cabeceras)
    assert horario.status_code == 200
    assert horario.get_json()["hora_apertura"] == "08:00"
    assert horario.get_json()["hora_cierre"] == "17:00"
    assert horario.get_json()["duracion_franja_min"] == 20
    assert horario.get_json()["dias_max_reserva"] == 45


def test_codigo_otp_no_se_comparte_entre_organizaciones(app):
    import pytest

    from app.dominios.turnos import otp

    otp.reiniciar()
    with app.test_request_context("/", environ_base={"REMOTE_ADDR": "127.0.0.1"}):
        codigo = otp.generar_codigo("3001234567", organizacion_id=1)
        with pytest.raises(ValueError, match="Solicita un código"):
            otp.verificar_codigo("3001234567", codigo, organizacion_id=2)
        assert otp.verificar_codigo("3001234567", codigo, organizacion_id=1)
    otp.reiniciar()


def test_token_con_organizacion_falsificada_es_rechazado(client, db, crear_personal):
    """El claim org_id debe coincidir con la organización real del usuario."""
    empresa_b = _crear_organizacion(db)
    usuario_a = crear_personal("ADMIN")
    token = create_access_token(
        identity=str(usuario_a.id),
        additional_claims={"rol": "ADMIN", "org_id": empresa_b.id},
    )

    respuesta = client.get(
        "/api/v1/sedes/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert respuesta.status_code == 401


def test_token_heredado_sin_org_id_se_resuelve_desde_usuario(client, crear_personal):
    """Los JWT anteriores a multiempresa siguen siendo válidos por compatibilidad."""
    usuario = crear_personal("ADMIN")
    token = create_access_token(
        identity=str(usuario.id),
        additional_claims={"rol": "ADMIN"},
    )

    respuesta = client.get(
        "/api/v1/admin/agentes/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert respuesta.status_code == 200, respuesta.get_json()


def test_no_se_puede_eliminar_objeto_de_otro_tenant_al_cambiar_contexto(app, db):
    """Session.delete() también debe respetar el tenant activo durante flush."""
    import pytest

    from app.errores import PermisoDenegadoError
    from app.tenancy import contexto_organizacion

    empresa_b = _crear_organizacion(db, nombre="Empresa B", slug="empresa-b")
    with contexto_organizacion(empresa_b.id):
        sede_b = Punto(nombre="Sede privada B", organizacion_id=empresa_b.id, activo=True)
        db.session.add(sede_b)
        db.session.commit()
        sede_id = sede_b.id
        sede_cargada = db.session.get(Punto, sede_id)

    # El objeto sigue en la sesión, pero ahora el contexto activo es la empresa 1.
    with contexto_organizacion(1):
        db.session.delete(sede_cargada)
        with pytest.raises(PermisoDenegadoError, match="eliminar información"):
            db.session.commit()
        db.session.rollback()

    with contexto_organizacion(empresa_b.id):
        assert db.session.get(Punto, sede_id) is not None


def test_preflight_options_api_no_exige_jwt_ni_falla(client):
    """Las solicitudes CORS OPTIONS no contienen JWT y deben pasar el middleware."""
    for ruta in ("/api/v1/sedes/", "/api/v1/tramites/", "/api/v1/horario"):
        respuesta = client.options(
            ruta,
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization,content-type,x-organization-slug",
            },
        )
        assert respuesta.status_code != 500, (ruta, respuesta.get_json())
        assert respuesta.status_code in (200, 204), (ruta, respuesta.status_code)
