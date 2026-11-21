"""Pruebas de equipos, garantía, reclamos y presencia del asesor."""

from datetime import time, timedelta

import pytest

from app import db as _db
from app.dominios.equipos.modelos import Equipo
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.turnos.modelos import Turno
from app.dominios.usuarios.modelos import Usuario
from app.horario import hoy_local

CELULAR = "3004445566"


@pytest.fixture
def taller(client, admin_auth, crear_personal, auth):
    sede = Punto(nombre="Sede Centro", direccion="Cra 50", activo=True)
    _db.session.add(sede)
    _db.session.commit()
    tramites = {}
    for nombre, flujo in (
        ("Entrega de equipo reparado", "ENTREGA"),
        ("Garantía de televisor", "GARANTIA"),
        ("Reclamos", "RECLAMO"),
    ):
        r = client.post(
            "/api/v1/tramites/",
            headers=admin_auth,
            json={"nombre": nombre, "tiempo_estimado": 5, "tipo_flujo": flujo},
        )
        assert r.status_code == 201, r.get_json()
        assert r.get_json()["tramite"]["tipo_flujo"] == flujo
        tramites[flujo] = r.get_json()["tramite"]["id"]
    asesor = crear_personal("AGENTE", punto_id=sede.id)
    franjas = {}
    for flujo, tramite_id in tramites.items():
        franja = Franja(
            punto_id=sede.id,
            tramite_id=tramite_id,
            fecha=hoy_local() + timedelta(days=1),
            hora_inicio=time(10, 0),
            hora_fin=time(10, 30),
            capacidad=10,
        )
        _db.session.add(franja)
        _db.session.flush()
        franjas[flujo] = franja.id
    _db.session.commit()
    return {
        "sede": sede,
        "tramites": tramites,
        "franjas": franjas,
        "asesor": asesor,
        "asesor_auth": auth(asesor),
        "admin_auth": admin_auth,
    }


def _verificar(client, celular=CELULAR):
    codigo = client.post(
        "/api/v1/turnos/publico/solicitar-codigo", json={"celular": celular}
    ).get_json()["codigo_prueba"]
    return client.post(
        "/api/v1/turnos/publico/verificar-codigo", json={"celular": celular, "codigo": codigo}
    ).get_json()["token_verificacion"]


def _reservar(client, taller, flujo, token, **extra):
    return client.post(
        "/api/v1/turnos/publico",
        json={
            "nombre": "Juliana Restrepo",
            "celular": CELULAR,
            "token_verificacion": token,
            "punto_id": taller["sede"].id,
            "tramite_id": taller["tramites"][flujo],
            "franja_id": taller["franjas"][flujo],
            **extra,
        },
    )


def _registrar_equipo(client, taller, **extra):
    r = client.post(
        "/api/v1/equipos/",
        headers=taller["asesor_auth"],
        json={
            "cliente_nombre": "Juliana Restrepo",
            "cliente_celular": CELULAR,
            "marca": "Samsung",
            "modelo": '55" 4K',
            "serial": "SN123456789",
            "falla": "No enciende",
            "cliente_documento": "1037654321",
            **extra,
        },
    )
    assert r.status_code == 201, r.get_json()
    return r.get_json()["equipo"]


# equipos y entrega


def test_asesor_registra_equipo_y_el_ciudadano_lo_ve(client, taller):
    equipo = _registrar_equipo(client, taller)
    assert equipo["estado"] == "RECIBIDO"
    assert equipo["codigo"].startswith("EQ-")

    token = _verificar(client)
    mios = client.post(
        "/api/v1/equipos/publico/mios", json={"celular": CELULAR, "token_verificacion": token}
    ).get_json()
    assert mios["cliente"]["nombre"] == "Juliana Restrepo"
    assert mios["equipos"][0]["marca"] == "Samsung"
    assert mios["equipos"][0]["serial"] == "···6789"  # serial parcialmente oculto

    # Sin verificación no hay datos.
    sin = client.post("/api/v1/equipos/publico/mios", json={"celular": CELULAR})
    assert sin.status_code == 400


def test_entrega_exige_equipo_listo_del_mismo_celular(client, taller):
    equipo = _registrar_equipo(client, taller)
    token = _verificar(client)

    assert _reservar(client, taller, "ENTREGA", token).status_code == 400  # sin equipo
    no_listo = _reservar(client, taller, "ENTREGA", token, equipo_id=equipo["id"])
    assert no_listo.status_code == 400
    assert "listo" in no_listo.get_json()["error"]

    for estado in ("EN_REPARACION", "LISTO"):
        r = client.put(
            f"/api/v1/equipos/{equipo['id']}/estado",
            headers=taller["asesor_auth"],
            json={"estado": estado},
        )
        assert r.status_code == 200, r.get_json()

    ok = _reservar(client, taller, "ENTREGA", token, equipo_id=equipo["id"])
    assert ok.status_code == 201, ok.get_json()
    turno = Turno.query.filter_by(codigo=ok.get_json()["turno"]["codigo"]).one()
    assert turno.equipo_id == equipo["id"]
    assert ok.get_json()["turno"]["equipo"]["estado"] == "LISTO"

    repetido = _reservar(client, taller, "ENTREGA", token, equipo_id=equipo["id"])
    assert repetido.status_code == 400


def test_equipo_de_otro_celular_no_se_puede_reservar(client, taller):
    equipo = _registrar_equipo(client, taller, cliente_celular="3119998877")
    _db.session.get(Equipo, equipo["id"]).estado = "LISTO"
    _db.session.commit()
    token = _verificar(client)
    assert _reservar(client, taller, "ENTREGA", token, equipo_id=equipo["id"]).status_code == 400


def test_entregado_no_retrocede(client, taller):
    equipo = _registrar_equipo(client, taller)
    url = f"/api/v1/equipos/{equipo['id']}/estado"
    for estado in ("EN_REPARACION", "LISTO"):
        assert (
            client.put(url, headers=taller["asesor_auth"], json={"estado": estado}).status_code
            == 200
        )
    # Entregar exige la cédula del dueño y debe coincidir con la registrada.
    sin_cedula = client.put(url, headers=taller["asesor_auth"], json={"estado": "ENTREGADO"})
    assert sin_cedula.status_code == 400
    otra = client.put(
        url, headers=taller["asesor_auth"], json={"estado": "ENTREGADO", "documento": "999999"}
    )
    assert otra.status_code == 409
    ok = client.put(
        url,
        headers=taller["asesor_auth"],
        json={"estado": "ENTREGADO", "documento": "1.037.654.321"},
    )
    assert ok.status_code == 200, ok.get_json()
    assert (
        client.put(url, headers=taller["asesor_auth"], json={"estado": "LISTO"}).status_code == 409
    )


# garantía


def test_garantia_valida_un_anio_y_registra_el_equipo(client, taller):
    token = _verificar(client)
    vieja = (hoy_local() - timedelta(days=400)).isoformat()
    r = _reservar(
        client,
        taller,
        "GARANTIA",
        token,
        garantia={"marca": "LG", "fecha_compra": vieja, "falla": "Rayas en la pantalla"},
    )
    assert r.status_code == 400
    assert "garantía" in r.get_json()["error"]

    reciente = (hoy_local() - timedelta(days=120)).isoformat()
    r = _reservar(
        client,
        taller,
        "GARANTIA",
        token,
        garantia={"marca": "LG", "modelo": '43"', "fecha_compra": reciente, "falla": "Rayas"},
    )
    assert r.status_code == 201, r.get_json()
    equipo = r.get_json()["turno"]["equipo"]
    assert equipo["origen"] == "GARANTIA"
    assert equipo["estado"] == "POR_RECIBIR"


# reclamos


def test_reclamo_en_linea_y_respuesta_del_asesor(client, taller):
    token = _verificar(client)
    r = client.post(
        "/api/v1/reclamos/publico",
        json={
            "celular": CELULAR,
            "token_verificacion": token,
            "nombre": "Juliana Restrepo",
            "categoria": "DEMORA",
            "descripcion": "Mi televisor lleva diez días en reparación sin fecha de entrega.",
            "punto_id": taller["sede"].id,
        },
    )
    assert r.status_code == 201, r.get_json()
    radicado = r.get_json()["reclamo"]["radicado"]
    reclamo_id = r.get_json()["reclamo_id"]

    bandeja = client.get("/api/v1/reclamos/", headers=taller["asesor_auth"]).get_json()
    assert bandeja["pendientes"] == 1
    url = f"/api/v1/reclamos/{reclamo_id}"
    assert (
        client.put(url, headers=taller["asesor_auth"], json={"estado": "RESUELTO"}).status_code
        == 400
    )
    ok = client.put(
        url,
        headers=taller["asesor_auth"],
        json={"estado": "RESUELTO", "respuesta": "Tu equipo se entrega mañana."},
    )
    assert ok.status_code == 200

    mios = client.post(
        "/api/v1/reclamos/publico/mios", json={"celular": CELULAR, "token_verificacion": token}
    ).get_json()["reclamos"]
    assert mios[0]["radicado"] == radicado
    assert mios[0]["respuesta"] == "Tu equipo se entrega mañana."
    assert "cliente_celular" not in mios[0]


def test_reclamo_presencial_se_vincula_al_turno(client, taller):
    token = _verificar(client)
    r = client.post(
        "/api/v1/reclamos/publico",
        json={
            "celular": CELULAR,
            "token_verificacion": token,
            "nombre": "Juliana Restrepo",
            "categoria": "COBRO",
            "descripcion": "La factura no coincide con la cotización aprobada.",
            "punto_id": taller["sede"].id,
            "presencial": True,
        },
    )
    reclamo_id = r.get_json()["reclamo_id"]
    t = _reservar(client, taller, "RECLAMO", token, reclamo_id=reclamo_id)
    assert t.status_code == 201, t.get_json()
    assert (
        Turno.query.filter_by(codigo=t.get_json()["turno"]["codigo"]).one().reclamo_id == reclamo_id
    )


def test_reclamo_corto_se_rechaza(client, taller):
    token = _verificar(client)
    r = client.post(
        "/api/v1/reclamos/publico",
        json={
            "celular": CELULAR,
            "token_verificacion": token,
            "nombre": "Juliana Restrepo",
            "categoria": "OTRO",
            "descripcion": "Mal",
            "punto_id": taller["sede"].id,
        },
    )
    assert r.status_code == 400


# presencia del asesor


def test_presencia_del_asesor(client, taller):
    url = "/api/v1/agente/presencia"
    assert (
        client.put(url, headers=taller["asesor_auth"], json={"presencia": "SIESTA"}).status_code
        == 400
    )
    r = client.put(url, headers=taller["asesor_auth"], json={"presencia": "ALMUERZO"})
    assert r.status_code == 200
    asesores = client.get("/api/v1/admin/agentes/", headers=taller["admin_auth"]).get_json()[
        "agentes"
    ]
    assert asesores[0]["presencia"] == "ALMUERZO"
    panel = client.get("/api/v1/agente/panel", headers=taller["asesor_auth"]).get_json()
    assert panel["agente"]["presencia"] == "ALMUERZO"

    client.post("/api/v1/usuarios/logout", headers=taller["asesor_auth"])
    assert _db.session.get(Usuario, taller["asesor"].id).presencia == "AUSENTE"


def test_registrar_equipo_exige_cedula_coherente(client, taller):
    sin = client.post(
        "/api/v1/equipos/",
        headers=taller["asesor_auth"],
        json={
            "cliente_nombre": "Ana",
            "cliente_celular": "3005550000",
            "marca": "LG",
            "falla": "No enciende",
        },
    )
    assert sin.status_code == 400
    _registrar_equipo(client, taller)
    otra = client.post(
        "/api/v1/equipos/",
        headers=taller["asesor_auth"],
        json={
            "cliente_nombre": "Juliana Restrepo",
            "cliente_celular": CELULAR,
            "marca": "LG",
            "falla": "Sin sonido",
            "cliente_documento": "11223344",
        },
    )
    assert otra.status_code == 409


def test_consulta_con_codigo_corto(client, taller):
    token = _verificar(client)
    r = _reservar(client, taller, "RECLAMO", token)
    assert r.status_code == 201, r.get_json()
    codigo = r.get_json()["turno"]["codigo"]
    consulta = client.post(
        "/api/v1/turnos/publico/consultar",
        json={
            "codigo": codigo[-6:].lower(),
            "celular": CELULAR,
            "token_verificacion": r.get_json()["token_consulta"],
        },
    )
    assert consulta.status_code == 200, consulta.get_json()
    assert consulta.get_json()["turno"]["codigo"] == codigo
    assert consulta.get_json()["turno"]["codigo_corto"] == f"TU-{codigo[-6:]}"


# tablero ejecutivo


def test_tablero_ejecutivo_para_admin_y_supervisor(client, taller, crear_personal, auth):
    _registrar_equipo(client, taller)
    supervisor = auth(crear_personal("SUPERVISOR"))
    r = client.get("/api/v1/admin/agentes/tablero?dias=7", headers=supervisor)
    assert r.status_code == 200, r.get_json()
    datos = r.get_json()
    assert datos["periodo"]["dias"] == 7
    assert len(datos["por_dia"]) == 7
    assert len(datos["por_dia_anterior"]) == 7
    assert datos["equipos"]["por_estado"]["RECIBIDO"] == 1
    assert {"kpis", "kpis_anterior", "por_hora", "por_sede", "reclamos"} <= datos.keys()

    # El asesor no ve el tablero y los parámetros se validan.
    assert (
        client.get("/api/v1/admin/agentes/tablero", headers=taller["asesor_auth"]).status_code
        == 403
    )
    malo = client.get("/api/v1/admin/agentes/tablero?dias=500", headers=supervisor)
    assert malo.status_code == 400


def test_cedula_se_muestra_enmascarada(client, taller):
    equipo = _registrar_equipo(client, taller)
    assert equipo["cliente_documento"] == "···4321"


def test_consulta_con_codigo_visible_tu(client, taller):
    token = _verificar(client)
    r = _reservar(client, taller, "RECLAMO", token)
    codigo = r.get_json()["turno"]["codigo"]
    consulta = client.post(
        "/api/v1/turnos/publico/consultar",
        json={
            "codigo": f"tu-{codigo[-6:]}",
            "celular": CELULAR,
            "token_verificacion": r.get_json()["token_consulta"],
        },
    )
    assert consulta.status_code == 200, consulta.get_json()


# minichat y alertas


def test_minichat_cliente_asistente_y_asesor(client, taller):
    token = _verificar(client)
    radicado = client.post(
        "/api/v1/reclamos/publico",
        json={
            "celular": CELULAR,
            "token_verificacion": token,
            "nombre": "Juliana Restrepo",
            "categoria": "CONSULTA",
            "descripcion": "Mi televisor no enciende, ¿cuánto vale revisarlo?",
            "punto_id": taller["sede"].id,
            "presencial": False,
        },
    ).get_json()["reclamo"]["radicado"]
    tok = _verificar(client)
    r = client.post(
        "/api/v1/reclamos/publico/mensajes",
        json={
            "celular": CELULAR,
            "token_verificacion": tok,
            "radicado": radicado,
            "texto": "¿Cuánto vale y a qué hora abren?",
        },
    )
    assert r.status_code == 201, r.get_json()
    mensajes = r.get_json()["reclamo"]["mensajes"]
    assert [m["autor"] for m in mensajes] == ["CLIENTE", "ASISTENTE"]
    assert "Atendemos" in mensajes[1]["texto"] and "asesor" in mensajes[1]["texto"]

    bandeja = client.get("/api/v1/reclamos/", headers=taller["asesor_auth"]).get_json()
    assert bandeja["mensajes_sin_leer"] == 1
    rid = bandeja["reclamos"][0]["id"]
    ok = client.post(
        f"/api/v1/reclamos/{rid}/mensajes",
        headers=taller["asesor_auth"],
        json={"texto": "La revisión vale $50.000; tráelo cuando quieras."},
    )
    assert ok.status_code == 201
    assert (
        client.get("/api/v1/reclamos/", headers=taller["asesor_auth"]).get_json()[
            "mensajes_sin_leer"
        ]
        == 0
    )

    mios = client.post(
        "/api/v1/reclamos/publico/mios", json={"celular": CELULAR, "token_verificacion": tok}
    ).get_json()["reclamos"][0]
    assert mios["sin_leer"] == 2 and mios["mensajes"][-1]["autor"] == "ASESOR"
    otra = client.post(
        "/api/v1/reclamos/publico/mios", json={"celular": CELULAR, "token_verificacion": tok}
    ).get_json()["reclamos"][0]
    assert otra["sin_leer"] == 0


def test_consulta_solo_con_codigo(client, taller):
    token = _verificar(client)
    codigo = _reservar(client, taller, "RECLAMO", token).get_json()["turno"]["codigo"]
    corto = f"TU-{codigo[-6:]}"
    r = client.post(
        "/api/v1/turnos/publico/solicitar-codigo",
        json={"codigo_turno": corto, "proposito": "consulta"},
    )
    assert r.status_code == 200, r.get_json()
    assert r.get_json()["celular_enmascarado"].endswith(CELULAR[-3:])
    v = client.post(
        "/api/v1/turnos/publico/verificar-codigo",
        json={
            "codigo_turno": corto,
            "proposito": "consulta",
            "codigo": r.get_json()["codigo_prueba"],
        },
    )
    assert v.status_code == 200, v.get_json()
    c = client.post(
        "/api/v1/turnos/publico/consultar",
        json={"codigo": corto, "token_verificacion": v.get_json()["token_verificacion"]},
    )
    assert c.status_code == 200, c.get_json()
    malo = client.post(
        "/api/v1/turnos/publico/solicitar-codigo",
        json={"codigo_turno": "TU-ZZZZZZ", "proposito": "consulta"},
    )
    assert malo.status_code == 400


def test_tablero_trae_hallazgos(client, taller, admin_auth):
    datos = client.get("/api/v1/admin/agentes/tablero?dias=7", headers=admin_auth).get_json()
    assert isinstance(datos["hallazgos"], list)
