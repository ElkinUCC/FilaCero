"""Asistente FilaCero IA: permisos, intenciones, acciones y modo sin proveedor externo."""

from datetime import time, timedelta

import pytest

from app import db as _db
from app.dominios.asistente import llm
from app.dominios.asistente.motor import fecha, plano
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.horario import hoy_local

CELULAR = "3007778899"
URL = "/api/v1/asistente/preguntar"


@pytest.fixture
def operacion(client, admin_auth, crear_personal, auth):
    sede = Punto(nombre="Sede Laureles", direccion="Cra 76", activo=True)
    _db.session.add(sede)
    _db.session.commit()
    r = client.post(
        "/api/v1/tramites/",
        headers=admin_auth,
        json={"nombre": "Diagnóstico de televisor", "tiempo_estimado": 8},
    )
    tramite_id = r.get_json()["tramite"]["id"]
    asesor = crear_personal("AGENTE", punto_id=sede.id)
    franja = Franja(
        punto_id=sede.id,
        tramite_id=tramite_id,
        fecha=hoy_local() + timedelta(days=1),
        hora_inicio=time(10, 0),
        hora_fin=time(10, 30),
        capacidad=10,
    )
    _db.session.add(franja)
    _db.session.commit()

    codigo = client.post(
        "/api/v1/turnos/publico/solicitar-codigo", json={"celular": CELULAR}
    ).get_json()["codigo_prueba"]
    token = client.post(
        "/api/v1/turnos/publico/verificar-codigo", json={"celular": CELULAR, "codigo": codigo}
    ).get_json()["token_verificacion"]
    reserva = client.post(
        "/api/v1/turnos/publico",
        json={
            "nombre": "Mariana Zapata Ríos",
            "celular": CELULAR,
            "token_verificacion": token,
            "punto_id": sede.id,
            "tramite_id": tramite_id,
            "franja_id": franja.id,
        },
    )
    assert reserva.status_code == 201, reserva.get_json()
    return {"sede": sede, "asesor_auth": auth(asesor), "admin_auth": admin_auth}


def _preguntar(client, headers, pregunta, **extra):
    r = client.post(URL, headers=headers, json={"pregunta": pregunta, **extra})
    assert r.status_code == 200, r.get_json()
    return r.get_json()


def test_requiere_sesion_y_valida_la_pregunta(client, admin_auth):
    assert client.post(URL, json={"pregunta": "hola"}).status_code == 401
    assert client.post(URL, headers=admin_auth, json={"pregunta": ""}).status_code == 400
    assert client.post(URL, headers=admin_auth, json={"pregunta": "x" * 501}).status_code == 400
    malo = client.post(URL, headers=admin_auth, json={"pregunta": "hola", "dias": 500})
    assert malo.status_code == 400


def test_sugerencias_segun_rol(client, operacion):
    admin = client.get("/api/v1/asistente/sugerencias", headers=operacion["admin_auth"])
    asesor = client.get("/api/v1/asistente/sugerencias", headers=operacion["asesor_auth"])
    assert admin.status_code == asesor.status_code == 200
    assert "¿Cómo vamos esta semana?" in admin.get_json()["sugerencias"]
    assert "¿Quién sigue?" in asesor.get_json()["sugerencias"]
    assert admin.get_json()["modo"] == "local"


def test_gerencial_responde_con_datos_reales(client, operacion):
    d = _preguntar(client, operacion["admin_auth"], "¿Qué esperar MAÑANA?")
    assert d["intenciones"] == ["manana"]
    assert d["fuente"] == "local"
    assert "1 turnos reservados" in d["respuesta"]
    assert any(t["etiqueta"] == "Reservas mañana" and t["valor"] == "1" for t in d["tarjetas"])
    assert d["sugerencias"]


def test_gerencial_entiende_sedes_por_nombre_y_varias_preguntas(client, operacion):
    d = _preguntar(client, operacion["admin_auth"], "como estan laureles y los reclamos ahora")
    assert "en_vivo" in d["intenciones"] and "reclamos" in d["intenciones"]
    assert "Sede Laureles" in d["respuesta"]
    assert any(a["tipo"] == "navegar" for a in d["acciones"])


def test_recomendaciones_y_pregunta_desconocida(client, operacion):
    d = _preguntar(client, operacion["admin_auth"], "qué me recomiendas hacer?")
    assert d["intenciones"] == ["recomendaciones"]
    assert "- " in d["respuesta"]
    desconocida = _preguntar(client, operacion["admin_auth"], "zzzz qqqq")
    assert desconocida["intenciones"] == ["desconocida"]
    assert desconocida["sugerencias"]


def test_copiloto_del_asesor_propone_llamar(client, operacion):
    d = _preguntar(client, operacion["asesor_auth"], "¿a quién llamo?")
    assert "siguiente" in d["intenciones"]
    # El turno es de mañana: el copiloto lo dice y no ofrece llamarlo hoy.
    assert (
        "Mariana Zapata Ríos" in d["respuesta"] and "No hay más turnos para hoy" in d["respuesta"]
    )

    riesgo = _preguntar(client, operacion["asesor_auth"], "hay alguien en riesgo?")
    assert riesgo["intenciones"] == ["riesgo"]

    persona = _preguntar(client, operacion["asesor_auth"], "dime de mariana zapata")
    assert persona["intenciones"][0] == "persona"
    assert "Diagnóstico de televisor" in persona["respuesta"]
    # Solo se ofrece "Llamar" para turnos de hoy.
    assert not any(a["tipo"] == "llamar" for a in persona["acciones"])


def test_el_asesor_no_recibe_datos_gerenciales(client, operacion):
    d = _preguntar(client, operacion["asesor_auth"], "como vamos esta semana en todas las sedes")
    # El rol se toma del token: el asesor nunca recibe el tablero ejecutivo.
    assert "Resumen de" not in d["respuesta"]


def test_sin_clave_no_llama_al_proveedor(app, monkeypatch, client, operacion):
    llamado = {"n": 0}

    def no_deberia(*_a, **_k):
        llamado["n"] += 1
        raise AssertionError("No debe salir a internet sin ANTHROPIC_API_KEY")

    monkeypatch.setattr("urllib.request.urlopen", no_deberia)
    _preguntar(client, operacion["admin_auth"], "como vamos")
    assert llamado["n"] == 0


def test_con_proveedor_usa_su_texto_y_si_falla_vuelve_al_motor_local(
    app, monkeypatch, client, operacion
):
    app.config["ANTHROPIC_API_KEY"] = "clave-de-prueba"
    monkeypatch.setattr(llm, "redactar", lambda *a, **k: "Texto redactado por el modelo.")
    d = _preguntar(client, operacion["admin_auth"], "como vamos")
    assert d["fuente"] == "ia" and d["respuesta"] == "Texto redactado por el modelo."
    assert d["tarjetas"]  # las cifras siguen saliendo del motor local

    monkeypatch.setattr(llm, "redactar", lambda *a, **k: None)
    d = _preguntar(client, operacion["admin_auth"], "como vamos")
    assert d["fuente"] == "local"
    app.config["ANTHROPIC_API_KEY"] = ""


def test_resumen_para_el_modelo_no_incluye_datos_personales(app, operacion):
    from app.dominios.asistente.contexto import contexto_asesor, resumen_para_modelo
    from app.dominios.usuarios.modelos import Usuario

    asesor = Usuario.query.filter_by(rol="AGENTE").first()
    texto = str(resumen_para_modelo(contexto_asesor(asesor)))
    assert CELULAR not in texto
    assert "Zapata" not in texto and "Mariana" in texto


def test_utilidades_de_lenguaje():
    assert plano("¿Qué tal, MAÑANA?") == "que tal manana"
    assert fecha("2026-11-09") == "lun 9 nov"
