"""Comportamiento seguro y catálogos de la simulación TecniVisión."""


def test_simulacion_prepara_sqlite_vacia_antes_de_resolver_tenant():
    from app import create_app, db
    from app.dominios.organizaciones.modelos import Organizacion
    from simulacion import _preparar_organizacion_simulacion

    app_sin_esquema = create_app({"SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:"})
    with app_sin_esquema.app_context():
        organizacion = _preparar_organizacion_simulacion(app_sin_esquema, db)

        assert organizacion.slug == "filacero-demo"
        assert Organizacion.query.filter_by(slug="filacero-demo").one()


def test_en_vivo_usa_el_tenant_configurado(app, db, monkeypatch):
    from types import SimpleNamespace

    import app as app_module
    from app.dominios.organizaciones.modelos import Organizacion
    from app.dominios.turnos.modelos import Turno
    from app.tenancy import contexto_organizacion
    from simulacion import comando_en_vivo, crear_catalogo

    app.config["DEFAULT_ORGANIZATION_SLUG"] = "demo-secundaria"
    with app.app_context():
        organizacion = Organizacion(
            nombre="Demo secundaria",
            slug="demo-secundaria",
            industria="general",
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
        organizacion_id = organizacion.id
        with contexto_organizacion(organizacion_id):
            crear_catalogo(db)

    monkeypatch.setattr(app_module, "create_app", lambda: app)
    args = SimpleNamespace(
        solo_reservas=True,
        por_ciclo=1,
        cada=1,
        duracion=1,
        tablero_cada=5,
    )
    assert comando_en_vivo(args) == 0

    with app.app_context(), contexto_organizacion(organizacion_id):
        assert Turno.query.filter_by(organizacion_id=organizacion_id).count() > 0


def test_carga_valida_fechas_antes_de_borrar(app, crear_personal, monkeypatch):
    from types import SimpleNamespace

    import app as app_module
    from app.dominios.usuarios.modelos import Usuario
    from simulacion import comando_cargar

    admin = crear_personal("ADMIN")
    monkeypatch.setattr(app_module, "create_app", lambda: app)
    for desde, hasta in (("2026-02-31", None), ("2026-01-02", "2026-01-01")):
        args = SimpleNamespace(
            permitir_borrar_remoto=False,
            dias=None,
            desde=desde,
            hasta=hasta,
            si=True,
        )

        assert comando_cargar(args) == 1
        assert Usuario.query.filter_by(correo=admin.correo).one()


def test_cuenta_protegida_conserva_contrasena_y_acceso_despues_de_cargar(
    app, crear_personal, monkeypatch
):
    from types import SimpleNamespace

    import app as app_module
    from app.dominios.usuarios.modelos import Usuario
    from simulacion import comando_cargar

    admin = crear_personal("ADMIN")
    app.config["CUENTAS_PROTEGIDAS"] = [admin.correo]
    monkeypatch.setattr(app_module, "create_app", lambda: app)
    args = SimpleNamespace(
        permitir_borrar_remoto=False,
        dias=1,
        desde=None,
        hasta=None,
        si=True,
        semilla=1,
        turnos=5,
    )

    assert (
        app.test_client()
        .post(
            "/api/v1/usuarios/login",
            json={"correo": admin.correo, "password": "Prueba12345"},
        )
        .status_code
        == 200
    )
    assert comando_cargar(args) == 0

    usuario = Usuario.query.filter_by(correo=admin.correo).one()
    assert usuario.protegida is True
    respuesta = app.test_client().post(
        "/api/v1/usuarios/login",
        json={"correo": admin.correo, "password": "Prueba12345"},
    )
    assert respuesta.status_code == 200, respuesta.get_json()


def test_catalogo_incluye_supervisor_demo_y_no_duplica_cuentas(app, db):
    from flask_jwt_extended import decode_token

    from app.dominios.usuarios.modelos import Usuario
    from simulacion import CLAVE_SUPERVISOR, SEDES, SUPERVISORES, crear_catalogo

    datos = crear_catalogo(db)
    crear_catalogo(db)

    assert len(SEDES) == 4
    assert "Sede Montería" not in {sede.nombre for sede in datos["sedes"]}

    _nombre, correo = SUPERVISORES[0]
    supervisor = Usuario.query.filter_by(correo=correo).one()
    assert supervisor.rol == "SUPERVISOR"
    assert supervisor.activo is True
    assert supervisor.punto_asignado_id is None

    respuesta = app.test_client().post(
        "/api/v1/usuarios/login", json={"correo": correo, "password": CLAVE_SUPERVISOR}
    )
    assert respuesta.status_code == 200
    claims = decode_token(respuesta.get_json()["access_token"])
    assert claims["rol"] == "SUPERVISOR"
    assert (
        app.test_client()
        .get(
            "/api/v1/admin/usuarios/",
            headers={"Authorization": f"Bearer {respuesta.get_json()['access_token']}"},
        )
        .status_code
        == 403
    )


def test_atencion_automatica_solo_avanza_los_turnos_simulados(app, db, monkeypatch):
    import random
    from datetime import UTC, date, datetime, time, timedelta

    from app.dominios.agentes import servicios as servicios_agente
    from app.dominios.franjas.modelos import Franja
    from app.dominios.turnos.modelos import Turno
    from app.dominios.usuarios.modelos import Usuario
    from simulacion import (
        ASESORES,
        _agentes_demo_automaticos,
        _avanzar_atenciones_simuladas,
        crear_catalogo,
    )

    catalogo = crear_catalogo(db)
    app.config["RESTRINGIR_ATENCION_HORARIO"] = True
    app.config["CUENTAS_PROTEGIDAS"] = [correo for _, correo, _ in ASESORES]
    assert _agentes_demo_automaticos() == []
    app.config["CUENTAS_PROTEGIDAS"] = []
    monkeypatch.setattr(servicios_agente, "en_horario_de_atencion", lambda: True)

    sede_id = catalogo["asesores"][0].punto_asignado_id
    tramite_id = catalogo["servicios"][0].id
    franja = Franja(
        punto_id=sede_id,
        tramite_id=tramite_id,
        fecha=date.today() + timedelta(days=1),
        hora_inicio=time(9),
        hora_fin=time(9, 30),
        capacidad=6,
        activa=True,
    )
    db.session.add(franja)
    db.session.flush()
    ahora = datetime.now(UTC).replace(tzinfo=None)
    personas = [
        Usuario(
            nombre=f"Cliente de prueba {indice}",
            correo=f"cliente_{indice}@prueba.invalid",
            password_hash="",
            rol="CLIENTE",
            celular=f"300000000{indice}",
            activo=True,
        )
        for indice in (1, 2)
    ]
    db.session.add_all(personas)
    db.session.flush()
    turnos = [
        Turno(
            codigo=f"FC-PRUEBA-{indice}",
            usuario_id=persona.id,
            tramite_id=tramite_id,
            punto_id=sede_id,
            franja_id=franja.id,
            hora_solicitud=ahora,
            estado="ESPERANDO",
        )
        for indice, persona in enumerate(personas, start=1)
    ]
    db.session.add_all(turnos)
    db.session.commit()

    trabajos = {turnos[0].id: {"estado": "ESPERANDO", "punto_id": sede_id}}
    agentes = _agentes_demo_automaticos()
    assert agentes

    _avanzar_atenciones_simuladas(db, trabajos, agentes, 1, random.Random(1))
    assert turnos[0].estado == "LLAMADO"
    _avanzar_atenciones_simuladas(db, trabajos, agentes, 10, random.Random(1))
    assert turnos[0].estado == "EN_ATENCION"
    _avanzar_atenciones_simuladas(db, trabajos, agentes, 100, random.Random(1))
    assert turnos[0].estado == "ATENDIDO"
    assert trabajos == {}
    assert turnos[1].estado == "ESPERANDO"


def test_carga_reconoce_bases_remotas_sin_conectar():
    from sqlalchemy.engine import make_url

    from simulacion import _base_es_remota

    assert not _base_es_remota(make_url("sqlite:///demo.db"))
    assert not _base_es_remota(make_url("mysql+pymysql://demo:demo@localhost:3307/filacero"))
    assert _base_es_remota(
        make_url("mysql+pymysql://demo:demo@cluster.example.invalid:4000/filacero")
    )
