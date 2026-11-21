from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos import otp
from app.dominios.usuarios.modelos import Usuario
from app.horario import hoy_local
from app.seguridad import encriptar_password, reiniciar_limites
from app.tiempo import ahora_bd

CELULAR = "3001234567"


@pytest.fixture
def app():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "JWT_SECRET_KEY": "PRUEBAS-FilaCero-JWT-Clave-Segura-2026",
            "OTP_TEST_MODE": True,
            "RESTRINGIR_ATENCION_HORARIO": False,
        }
    )
    with app.app_context():
        db.create_all()
        otp.reiniciar()
        reiniciar_limites()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def base(app):
    sede = Punto(nombre="Sede Centro", direccion="Calle 1", activo=True)
    tramite = Tramite(nombre="Soporte", tiempo_estimado=10, activo=True)
    admin = Usuario(
        nombre="Admin",
        correo="admin@x.co",
        password_hash=encriptar_password("Admin12345"),
        rol="ADMIN",
    )
    db.session.add_all([sede, tramite, admin])
    db.session.commit()
    agente = Usuario(
        nombre="Agente",
        correo="agente@x.co",
        password_hash=encriptar_password("Agente12345"),
        rol="AGENTE",
        punto_asignado_id=sede.id,
    )
    db.session.add(agente)
    db.session.commit()
    return {"sede": sede, "tramite": tramite, "admin": admin, "agente": agente}


def token(usuario):
    return {
        "Authorization": "Bearer "
        + create_access_token(identity=str(usuario.id), additional_claims={"rol": usuario.rol})
    }


def verificar_celular(cliente, celular=CELULAR, proposito="reserva", codigo_turno=None):
    r = cliente.post("/api/v1/turnos/publico/solicitar-codigo", json={"celular": celular})
    assert r.status_code == 200
    codigo = r.get_json()["codigo_prueba"]
    assert len(codigo) == 6 and codigo.isdigit()
    datos = {"celular": celular, "codigo": codigo, "proposito": proposito}
    if codigo_turno:
        datos["codigo_turno"] = codigo_turno
    r = cliente.post("/api/v1/turnos/publico/verificar-codigo", json=datos)
    assert r.status_code == 200
    return r.get_json()["token_verificacion"]


def primera_franja(cliente, base, dias=1):
    fecha = (hoy_local() + timedelta(days=dias)).isoformat()
    r = cliente.get(
        "/api/v1/franjas/disponibles",
        query_string={"sede_id": base["sede"].id, "tramite_id": base["tramite"].id, "fecha": fecha},
    )
    assert r.status_code == 200, r.get_json()
    return r.get_json()["franjas"]


# ---------------------------------------------------------------- horario


def test_franjas_automaticas_todos_los_dias_24_horas(app, base):
    cliente = app.test_client()
    for dias in range(1, 8):  # una semana completa, incluye sábado y domingo
        franjas = primera_franja(cliente, base, dias)
        assert franjas, f"Sin franjas a {dias} días"
        assert franjas[0]["hora_inicio"] == "00:00"
        assert franjas[-1]["hora_inicio"] == "23:30"
        assert franjas[-1]["hora_fin"] == "23:59"
        assert len(franjas) == 48


def test_no_permite_fechas_pasadas_ni_muy_lejanas(app, base):
    cliente = app.test_client()
    for dias in (-1, 400):
        r = cliente.get(
            "/api/v1/franjas/disponibles",
            query_string={
                "sede_id": base["sede"].id,
                "tramite_id": base["tramite"].id,
                "fecha": (hoy_local() + timedelta(days=dias)).isoformat(),
            },
        )
        assert r.status_code == 400


def test_endpoint_horario_publico(app):
    datos = app.test_client().get("/api/v1/horario").get_json()
    assert datos["hora_apertura"] == "00:00"
    assert datos["hora_cierre"] == "23:59"
    assert datos["todos_los_dias"] is True


def test_agente_no_atiende_fuera_de_horario_si_esta_restringido(app, base, monkeypatch):
    from app.dominios.agentes import servicios

    app.config["RESTRINGIR_ATENCION_HORARIO"] = True
    monkeypatch.setattr(servicios, "en_horario_de_atencion", lambda: False)
    r = app.test_client().post("/api/v1/agente/llamar-siguiente", headers=token(base["agente"]))
    assert r.status_code == 400
    assert "horario" in r.get_json()["error"]


# ---------------------------------------------------------------- OTP


def test_otp_rechaza_codigo_incorrecto_y_limita_intentos(app):
    cliente = app.test_client()
    cliente.post("/api/v1/turnos/publico/solicitar-codigo", json={"celular": CELULAR})
    for _ in range(5):
        r = cliente.post(
            "/api/v1/turnos/publico/verificar-codigo", json={"celular": CELULAR, "codigo": "000000"}
        )
        assert r.status_code == 400
    r = cliente.post(
        "/api/v1/turnos/publico/verificar-codigo", json={"celular": CELULAR, "codigo": "000000"}
    )
    assert "Solicita" in r.get_json()["error"]


def test_otp_valida_formato_de_celular(app):
    r = app.test_client().post("/api/v1/turnos/publico/solicitar-codigo", json={"celular": "12"})
    assert r.status_code == 400


def test_otp_sin_modo_prueba_no_revela_codigo(app):
    app.config["OTP_TEST_MODE"] = False
    r = app.test_client().post("/api/v1/turnos/publico/solicitar-codigo", json={"celular": CELULAR})
    assert r.status_code == 503
    assert "codigo_prueba" not in r.get_json()


# ---------------------------------------------------------------- flujo público


def test_reserva_consulta_y_cancelacion_publica(app, base):
    cliente = app.test_client()
    verificacion = verificar_celular(cliente)
    franja = primera_franja(cliente, base)[0]

    r = cliente.post(
        "/api/v1/turnos/publico",
        json={
            "nombre": "Ana Gómez",
            "celular": CELULAR,
            "token_verificacion": verificacion,
            "punto_id": base["sede"].id,
            "tramite_id": base["tramite"].id,
            "franja_id": franja["franja_id"],
        },
    )
    assert r.status_code == 201, r.get_json()
    turno = r.get_json()["turno"]
    assert turno["celular"] == "300****567"  # enmascarado
    assert "usuario_id" not in turno
    token_consulta_reserva = r.get_json()["token_consulta"]

    r = cliente.post(
        "/api/v1/turnos/publico/consultar", json={"codigo": turno["codigo"], "celular": CELULAR}
    )
    assert r.status_code == 400

    r = cliente.post(
        "/api/v1/turnos/publico/consultar",
        json={
            "codigo": turno["codigo"],
            "celular": CELULAR,
            "token_verificacion": verificacion,
        },
    )
    assert r.status_code == 400  # reserva no autoriza consulta de información personal

    r = cliente.post(
        "/api/v1/turnos/publico/consultar",
        json={
            "codigo": turno["codigo"],
            "celular": CELULAR,
            "token_verificacion": token_consulta_reserva,
        },
    )
    assert r.status_code == 200

    r = cliente.post(
        "/api/v1/turnos/publico/consultar",
        json={
            "codigo": "FC-20260101-ABCDEF",
            "celular": CELULAR,
            "token_verificacion": token_consulta_reserva,
        },
    )
    assert r.status_code == 400  # la autorización está ligada al código reservado

    token_consulta = verificar_celular(
        cliente, CELULAR, proposito="consulta", codigo_turno=turno["codigo"]
    )
    r = cliente.post(
        "/api/v1/turnos/publico/consultar",
        json={
            "codigo": turno["codigo"],
            "celular": CELULAR,
            "token_verificacion": token_consulta,
        },
    )
    assert r.status_code == 200
    assert r.get_json()["turno"]["estado"] == "ESPERANDO"

    # Otro celular no puede ver ni cancelar el turno
    r = cliente.post(
        "/api/v1/turnos/publico/consultar",
        json={"codigo": turno["codigo"], "celular": "3110000000"},
    )
    assert r.status_code == 400

    r = cliente.post(
        "/api/v1/turnos/publico/cancelar", json={"codigo": turno["codigo"], "celular": CELULAR}
    )
    assert r.status_code == 400

    r = cliente.post(
        "/api/v1/turnos/publico/cancelar",
        json={
            "codigo": turno["codigo"],
            "celular": CELULAR,
            "token_verificacion": token_consulta,
        },
    )
    assert r.status_code == 400  # consulta no autoriza cancelar

    token_cancelacion = verificar_celular(
        cliente, CELULAR, proposito="cancelacion", codigo_turno=turno["codigo"]
    )
    r = cliente.post(
        "/api/v1/turnos/publico/cancelar",
        json={
            "codigo": turno["codigo"],
            "celular": CELULAR,
            "token_verificacion": token_cancelacion,
        },
    )
    assert r.status_code == 200
    assert r.get_json()["turno"]["estado"] == "CANCELADO"


def test_reserva_publica_exige_verificacion_del_mismo_celular(app, base):
    cliente = app.test_client()
    verificacion = verificar_celular(cliente, "3009999999")
    franja = primera_franja(cliente, base)[0]
    r = cliente.post(
        "/api/v1/turnos/publico",
        json={
            "nombre": "Ana Gómez",
            "celular": CELULAR,
            "token_verificacion": verificacion,
            "punto_id": base["sede"].id,
            "tramite_id": base["tramite"].id,
            "franja_id": franja["franja_id"],
        },
    )
    assert r.status_code == 400


def test_limite_de_turnos_activos_por_cliente(app, base):
    cliente = app.test_client()
    verificacion = verificar_celular(cliente)
    franjas = primera_franja(cliente, base)
    codigos = []
    for franja in franjas[:4]:
        r = cliente.post(
            "/api/v1/turnos/publico",
            json={
                "nombre": "Ana Gómez",
                "celular": CELULAR,
                "token_verificacion": verificacion,
                "punto_id": base["sede"].id,
                "tramite_id": base["tramite"].id,
                "franja_id": franja["franja_id"],
            },
        )
        codigos.append(r.status_code)
    assert codigos == [201, 201, 201, 400]


# ---------------------------------------------------------------- agente


def _reservar_directo(base, celular=CELULAR, dias=0, hora=None):
    from datetime import time

    from app.dominios.turnos.servicios import crear_turno
    from app.dominios.usuarios.servicios import registrar_cliente_publico

    fecha = hoy_local() + timedelta(days=dias)
    franja = Franja(
        punto_id=base["sede"].id,
        tramite_id=base["tramite"].id,
        fecha=fecha,
        hora_inicio=hora or time(23, 0),
        hora_fin=time(23, 30),
        capacidad=5,
    )
    db.session.add(franja)
    db.session.commit()
    usuario = registrar_cliente_publico("Cliente Demo", celular)
    return crear_turno(usuario.id, base["tramite"].id, base["sede"].id, franja.id)


def test_agente_no_llama_otro_con_turno_abierto_y_marca_no_asistio(app, base):
    _reservar_directo(base, "3001111111")
    _reservar_directo(base, "3002222222", dias=1)
    cliente = app.test_client()
    h = token(base["agente"])

    r = cliente.post("/api/v1/agente/llamar-siguiente", headers=h)
    assert r.status_code == 200
    llamado = r.get_json()["turno"]
    assert llamado["usuario_celular"] == "3001111111"  # primero el de hoy

    r = cliente.post("/api/v1/agente/llamar-siguiente", headers=h)
    assert r.status_code == 400 and "en curso" in r.get_json()["error"]

    r = cliente.post(f"/api/v1/agente/turnos/{llamado['id']}/no-asistio", headers=h)
    assert r.get_json()["turno"]["estado"] == "NO_ASISTIO"

    panel = cliente.get("/api/v1/agente/panel", headers=h).get_json()
    assert panel["resumen"]["no_asistio_hoy"] == 1
    assert panel["resumen"]["en_espera"] == 1
    assert panel["agente"]["sede"] == "Sede Centro"


def test_agente_devuelve_turno_a_la_cola(app, base):
    _reservar_directo(base)
    cliente = app.test_client()
    h = token(base["agente"])
    turno = cliente.post("/api/v1/agente/llamar-siguiente", headers=h).get_json()["turno"]
    r = cliente.post(f"/api/v1/agente/turnos/{turno['id']}/devolver", headers=h)
    assert r.get_json()["turno"]["estado"] == "ESPERANDO"


# ---------------------------------------------------------------- seguridad


def test_usuario_desactivado_pierde_acceso_aunque_tenga_token(app, base):
    h = token(base["admin"])
    cliente = app.test_client()
    assert cliente.get("/api/v1/admin/agentes/", headers=h).status_code == 200
    base["admin"].activo = False
    db.session.commit()
    assert cliente.get("/api/v1/admin/agentes/", headers=h).status_code == 401


def test_token_con_rol_falsificado_no_sirve(app, base):
    # Un agente con un token que dice ADMIN: el rol real en BD manda.
    falso = {
        "Authorization": "Bearer "
        + create_access_token(identity=str(base["agente"].id), additional_claims={"rol": "ADMIN"})
    }
    assert app.test_client().get("/api/v1/admin/agentes/", headers=falso).status_code == 403


def test_login_con_mensaje_generico_y_cliente_publico_sin_acceso(app, base):
    cliente = app.test_client()
    r = cliente.post("/api/v1/usuarios/login", json={"correo": "admin@x.co", "password": "malo"})
    assert r.status_code == 401
    assert r.get_json()["error"] == "Correo o contraseña incorrectos."

    from app.dominios.usuarios.servicios import registrar_cliente_publico

    registrar_cliente_publico("Pepe Pérez", CELULAR)
    r = cliente.post(
        "/api/v1/usuarios/login",
        json={"correo": f"cliente_{CELULAR}@publico.filacero.local", "password": ""},
    )
    assert r.status_code in (400, 401)

    r = cliente.post(
        "/api/v1/usuarios/login", json={"correo": "admin@x.co", "password": "Admin12345"}
    )
    assert r.status_code == 200 and r.get_json()["usuario"]["rol"] == "ADMIN"


def test_validacion_devuelve_400_y_no_500(app):
    r = app.test_client().post("/api/v1/usuarios/registro", json={"correo": "no-es-correo"})
    assert r.status_code == 400


def test_rate_limit_de_login(app, base):
    app.config.update(TESTING=False, LIMITE_LOGIN_POR_MINUTO=3)
    cliente = app.test_client()
    estados = [
        cliente.post(
            "/api/v1/usuarios/login", json={"correo": "x@x.co", "password": "x"}
        ).status_code
        for _ in range(4)
    ]
    assert estados[-1] == 429


def test_cors_solo_origen_permitido_y_cabeceras_seguras(app):
    cliente = app.test_client()
    ok = cliente.get("/api/v1/horario", headers={"Origin": "http://localhost:5173"})
    malo = cliente.get("/api/v1/horario", headers={"Origin": "https://sitio-malicioso.com"})
    assert ok.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert "Access-Control-Allow-Origin" not in malo.headers
    assert ok.headers["X-Content-Type-Options"] == "nosniff"
    assert ok.headers["X-Frame-Options"] == "DENY"


def test_admin_crea_agente_y_edita_catalogo(app, base):
    cliente = app.test_client()
    h = token(base["admin"])
    r = cliente.post(
        "/api/v1/admin/agentes/",
        headers=h,
        json={
            "nombre": "Nuevo Agente",
            "correo": "nuevo@x.co",
            "password": "Clave12345",
            "punto_id": base["sede"].id,
        },
    )
    assert r.status_code == 201, r.get_json()

    r = cliente.post(
        "/api/v1/admin/agentes/",
        headers=h,
        json={"nombre": "Débil", "correo": "debil@x.co", "password": "123"},
    )
    assert r.status_code == 400

    r = cliente.put(f"/api/v1/sedes/{base['sede'].id}", headers=h, json={"activo": False})
    assert r.get_json()["punto"]["activo"] is False
    publicas = cliente.get("/api/v1/sedes/").get_json()["puntos"]
    todas = cliente.get("/api/v1/sedes/?todos=1", headers=h).get_json()["puntos"]
    assert len(publicas) == 0 and len(todas) == 1

    r = cliente.post(
        "/api/v1/tramites/", headers=h, json={"nombre": "Soporte", "tiempo_estimado": 5}
    )
    assert r.status_code == 409  # duplicado -> Conflicto (app/errores.py)


def test_metricas_por_sede_incluyen_nombre(app, base):
    _reservar_directo(base)
    datos = (
        app.test_client()
        .get("/api/v1/admin/agentes/metricas/sedes", headers=token(base["admin"]))
        .get_json()
    )
    assert datos["sedes"][0]["nombre"] == "Sede Centro"


# ---------------------------------------------------------------- regresiones


def test_cola_solo_hoy_oculta_turnos_de_otros_dias(app, base):
    _reservar_directo(base, dias=2)
    h = token(base["agente"])
    cliente = app.test_client()
    assert cliente.get("/api/v1/agente/cola", headers=h).get_json()["total_en_espera"] == 1
    app.config["COLA_SOLO_HOY"] = True
    assert cliente.get("/api/v1/agente/cola", headers=h).get_json()["total_en_espera"] == 0
    assert cliente.post("/api/v1/agente/llamar-siguiente", headers=h).status_code == 400


def test_espera_de_turno_ajeno_responde_404(app, base):
    turno = _reservar_directo(base)
    otro = Usuario(nombre="Otro", correo="otro@x.co", password_hash="x", rol="CLIENTE")
    db.session.add(otro)
    db.session.commit()
    r = app.test_client().get(f"/api/v1/turnos/{turno.id}/tiempo-espera", headers=token(otro))
    assert r.status_code == 404


def test_cancelacion_publica_con_celular_incorrecto_responde_400(app, base):
    turno = _reservar_directo(base)
    r = app.test_client().post(
        "/api/v1/turnos/publico/cancelar", json={"codigo": turno.codigo, "celular": "3110000000"}
    )
    assert r.status_code == 400


def test_pantalla_de_sala_no_expone_datos_personales(app, base):

    turno = _reservar_directo(base)
    turno.estado = "LLAMADO"
    turno.agente_id = base["agente"].id
    turno.fecha_llamado = ahora_bd()
    db.session.commit()
    r = app.test_client().get(f"/api/v1/turnos/publico/sala?sede_id={base['sede'].id}").get_json()
    llamado = r["llamados"][0]
    assert llamado["codigo"] == f"TU-{turno.codigo[-6:]}"
    # ADR-008: la sala muestra el nombre completo de la persona llamada,
    # pero nunca su celular ni otros datos de contacto.
    assert llamado["nombre"] == "Cliente Demo"
    assert "celular" not in str(r) and CELULAR not in str(r)
    assert app.test_client().get("/api/v1/turnos/publico/sala").get_json()["sede"] is None


def test_pantalla_de_sala_puede_abreviar_nombres(app, base):

    app.config["SALA_NOMBRE_COMPLETO"] = False
    try:
        turno = _reservar_directo(base)
        turno.estado = "LLAMADO"
        turno.agente_id = base["agente"].id
        turno.fecha_llamado = ahora_bd()
        db.session.commit()
        r = app.test_client().get(f"/api/v1/turnos/publico/sala?sede_id={base['sede'].id}")
        assert r.get_json()["llamados"][0]["nombre"] == "Cliente D."
    finally:
        app.config["SALA_NOMBRE_COMPLETO"] = True


def test_consulta_por_celular_exige_otp_y_devuelve_lista(client, base):
    # Un celular verificado para consulta general puede listar sus turnos,
    # pero no puede usar el token de reserva para consultar información.
    token_consulta = verificar_celular(client, CELULAR, proposito="consulta_celular")
    respuesta = client.post(
        "/api/v1/turnos/publico/consultar-por-celular",
        json={"celular": CELULAR},
    )
    assert respuesta.status_code == 400

    respuesta = client.post(
        "/api/v1/turnos/publico/consultar-por-celular",
        json={"celular": CELULAR, "token_verificacion": token_consulta},
    )
    assert respuesta.status_code == 200
    assert respuesta.get_json()["turnos"] == []

    respuesta = client.post(
        "/api/v1/turnos/publico/consultar-por-celular",
        json={"celular": "3110000000", "token_verificacion": token_consulta},
    )
    assert respuesta.status_code == 400
