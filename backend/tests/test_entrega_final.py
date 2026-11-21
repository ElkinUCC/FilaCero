"""Pruebas de preparación previa y módulo de atención."""

from datetime import time, timedelta

import pytest

from app import db as _db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.turnos.modelos import Turno
from app.dominios.usuarios.modelos import Usuario
from app.horario import hoy_local
from app.tiempo import ahora_bd

CELULAR = "3005557788"


@pytest.fixture
def escenario(client, admin_auth, crear_personal, auth):
    """Sede con un trámite que requiere preparación y un asesor con módulo."""
    sede = Punto(nombre="Sede Centro", direccion="Cra 50", activo=True)
    otra = Punto(nombre="Sede Norte", direccion="Cl 80", activo=True)
    _db.session.add_all([sede, otra])
    _db.session.commit()

    r = client.post(
        "/api/v1/tramites/",
        headers=admin_auth,
        json={
            "nombre": "Garantía de televisor",
            "tiempo_estimado": 5,
            "tipo_flujo": "GARANTIA",
        },
    )
    assert r.status_code == 201
    tramite = r.get_json()["tramite"]
    assert tramite["requiere_preparacion"] is True

    r = client.post(
        "/api/v1/admin/agentes/",
        headers=admin_auth,
        json={
            "nombre": "Carlos Mejía",
            "correo": "carlos@filacero.co",
            "password": "Asesor12345",
            "punto_id": sede.id,
            "modulo": "Módulo 2",
        },
    )
    assert r.status_code == 201, r.get_json()
    agente = r.get_json()["agente"]
    assert agente["modulo"] == "Módulo 2"

    franja = Franja(
        punto_id=sede.id,
        tramite_id=tramite["id"],
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
    verificacion = client.post(
        "/api/v1/turnos/publico/verificar-codigo", json={"celular": CELULAR, "codigo": codigo}
    ).get_json()["token_verificacion"]
    r = client.post(
        "/api/v1/turnos/publico",
        json={
            "nombre": "Ana María Gómez Restrepo",
            "celular": CELULAR,
            "token_verificacion": verificacion,
            "punto_id": sede.id,
            "tramite_id": tramite["id"],
            "franja_id": franja.id,
            "garantia": {
                "marca": "Samsung",
                "fecha_compra": (hoy_local() - timedelta(days=60)).isoformat(),
                "falla": "La pantalla parpadea",
            },
        },
    )
    assert r.status_code == 201, r.get_json()
    creado = r.get_json()
    return {
        "sede": sede,
        "otra": otra,
        "tramite": tramite,
        "agente_id": agente["id"],
        "agente_auth": auth(_db.session.get(Usuario, agente["id"]), "Asesor12345"),
        "codigo": creado["turno"]["codigo"],
        "token_consulta": creado["token_consulta"],
        "admin_auth": admin_auth,
    }


def _turno(codigo):
    return Turno.query.filter_by(codigo=codigo).one()


# preparación previa


def test_turno_nace_pendiente_de_preparacion(client, escenario):
    turno = _turno(escenario["codigo"])
    assert turno.estado_preparacion == "PENDIENTE"

    panel = client.get("/api/v1/agente/panel", headers=escenario["agente_auth"]).get_json()
    assert panel["agente"]["modulo"] == "Módulo 2"
    assert panel["resumen"]["por_preparar"] == 1
    item = panel["cola"][0]
    assert item["requiere_preparacion"] is True
    assert item["preparacion"]["estado"] == "PENDIENTE"


def test_asesor_marca_listo_y_el_ciudadano_lo_ve(client, escenario):
    turno = _turno(escenario["codigo"])
    r = client.post(
        f"/api/v1/agente/turnos/{turno.id}/preparacion",
        headers=escenario["agente_auth"],
        json={"estado": "LISTO", "nota": "Tu televisor ya fue probado y está empacado."},
    )
    assert r.status_code == 200, r.get_json()
    prep = r.get_json()["turno"]["preparacion"]
    assert prep["estado"] == "LISTO"
    assert prep["preparado_por"] == "Carlos Mejía"

    consulta = client.post(
        "/api/v1/turnos/publico/consultar",
        json={
            "codigo": escenario["codigo"],
            "celular": CELULAR,
            "token_verificacion": escenario["token_consulta"],
        },
    ).get_json()["turno"]
    assert consulta["preparacion"]["estado"] == "LISTO"
    assert consulta["preparacion"]["nota"] == "Tu televisor ya fue probado y está empacado."
    # La vista pública no expone quién preparó el turno.
    assert "preparado_por" not in consulta["preparacion"]


def test_novedad_exige_nota_y_estado_valido(client, escenario):
    turno = _turno(escenario["codigo"])
    url = f"/api/v1/agente/turnos/{turno.id}/preparacion"
    sin_nota = client.post(url, headers=escenario["agente_auth"], json={"estado": "NOVEDAD"})
    assert sin_nota.status_code == 400
    invalido = client.post(url, headers=escenario["agente_auth"], json={"estado": "HECHO"})
    assert invalido.status_code == 400
    ok = client.post(
        url,
        headers=escenario["agente_auth"],
        json={"estado": "NOVEDAD", "nota": "Falta el control remoto; llega mañana."},
    )
    assert ok.status_code == 200


def test_asesor_de_otra_sede_no_prepara(client, escenario, crear_personal, auth):
    turno = _turno(escenario["codigo"])
    ajeno = crear_personal("AGENTE", punto_id=escenario["otra"].id)
    r = client.post(
        f"/api/v1/agente/turnos/{turno.id}/preparacion",
        headers=auth(ajeno),
        json={"estado": "LISTO"},
    )
    assert r.status_code == 409


def test_no_se_prepara_un_turno_cancelado(client, escenario):
    turno = _turno(escenario["codigo"])
    turno.estado = "CANCELADO"
    _db.session.commit()
    r = client.post(
        f"/api/v1/agente/turnos/{turno.id}/preparacion",
        headers=escenario["agente_auth"],
        json={"estado": "LISTO"},
    )
    assert r.status_code == 409


def test_tramite_sin_preparacion_no_genera_pendientes(client, admin_auth):
    r = client.post(
        "/api/v1/tramites/",
        headers=admin_auth,
        json={"nombre": "Pago de factura", "tiempo_estimado": 5, "requiere_preparacion": True},
    )
    # La preparación la decide el tipo de atención, no una casilla suelta.
    assert r.get_json()["tramite"]["requiere_preparacion"] is False
    from app.dominios.tramites.modelos import Tramite
    from app.dominios.turnos.preparacion import estado_inicial

    assert estado_inicial(_db.session.get(Tramite, r.get_json()["tramite"]["id"])) is None


# módulo y sala


def test_modulo_no_se_repite_en_la_misma_sede(client, escenario):
    r = client.post(
        "/api/v1/admin/agentes/",
        headers=escenario["admin_auth"],
        json={
            "nombre": "Diana Ospina",
            "correo": "diana@filacero.co",
            "password": "Asesor12345",
            "punto_id": escenario["sede"].id,
            "modulo": "módulo 2",
        },
    )
    assert r.status_code == 400
    assert "ya está asignado" in r.get_json()["error"]

    # En otra sede el mismo módulo sí está libre.
    r = client.post(
        "/api/v1/admin/agentes/",
        headers=escenario["admin_auth"],
        json={
            "nombre": "Diana Ospina",
            "correo": "diana@filacero.co",
            "password": "Asesor12345",
            "punto_id": escenario["otra"].id,
            "modulo": "Módulo 2",
        },
    )
    assert r.status_code == 201


def test_sala_muestra_nombre_completo_y_modulo(client, escenario):
    turno = _turno(escenario["codigo"])
    turno.estado = "LLAMADO"
    turno.agente_id = escenario["agente_id"]
    turno.fecha_llamado = ahora_bd()
    turno.franja.fecha = hoy_local()
    _db.session.commit()

    sala = client.get(f"/api/v1/turnos/publico/sala?sede_id={escenario['sede'].id}").get_json()
    llamado = sala["llamados"][0]
    assert llamado["nombre"] == "Ana María Gómez Restrepo"
    assert llamado["asesor"] == "Carlos Mejía"
    assert llamado["modulo"] == "Módulo 2"
    assert CELULAR not in str(sala)


def test_sedes_del_panel_informan_capacidad(client, escenario):
    sedes = client.get("/api/v1/sedes/?todos=1", headers=escenario["admin_auth"]).get_json()
    centro = next(s for s in sedes["puntos"] if s["nombre"] == "Sede Centro")
    assert centro["asesores_activos"] == 1
    assert centro["cupos_por_franja"] == 3
    # El listado público no expone datos operativos.
    publico = client.get("/api/v1/sedes/").get_json()["puntos"][0]
    assert "asesores_activos" not in publico


# baja de asesor


def test_eliminar_asesor_conserva_historial(client, escenario):
    agente_id = escenario["agente_id"]
    turno = _turno(escenario["codigo"])
    turno.estado = "ATENDIDO"
    turno.agente_id = agente_id
    _db.session.commit()

    r = client.delete(f"/api/v1/admin/agentes/{agente_id}", headers=escenario["admin_auth"])
    assert r.status_code == 200, r.get_json()

    listado = client.get("/api/v1/admin/agentes/", headers=escenario["admin_auth"]).get_json()
    assert all(a["id"] != agente_id for a in listado["agentes"])
    usuarios = client.get("/api/v1/admin/usuarios/", headers=escenario["admin_auth"]).get_json()
    assert all(u["id"] != agente_id for u in usuarios["usuarios"])

    # Ya no puede ingresar y su sesión anterior quedó revocada.
    login = client.post(
        "/api/v1/usuarios/login", json={"correo": "carlos@filacero.co", "password": "Asesor12345"}
    )
    assert login.status_code in (400, 401)
    assert client.get("/api/v1/agente/panel", headers=escenario["agente_auth"]).status_code == 401

    # El historial sigue mostrando quién atendió.
    historial = client.get(
        "/api/v1/admin/agentes/historial?desde=2000-01-01&hasta=2100-01-01",
        headers=escenario["admin_auth"],
    ).get_json()
    assert historial["turnos"][0]["agente_nombre"] == "Carlos Mejía"

    # El correo queda libre para una cuenta nueva.
    nuevo = client.post(
        "/api/v1/admin/agentes/",
        headers=escenario["admin_auth"],
        json={
            "nombre": "Carlos Mejía",
            "correo": "carlos@filacero.co",
            "password": "Asesor12345",
            "punto_id": escenario["sede"].id,
        },
    )
    assert nuevo.status_code == 201

    # Una cuenta eliminada no se puede editar ni volver a eliminar.
    assert (
        client.put(
            f"/api/v1/admin/agentes/{agente_id}",
            headers=escenario["admin_auth"],
            json={"activo": True},
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/v1/admin/agentes/{agente_id}", headers=escenario["admin_auth"]
        ).status_code
        == 404
    )


def test_no_se_elimina_asesor_con_turno_en_curso(client, escenario):
    turno = _turno(escenario["codigo"])
    turno.estado = "EN_ATENCION"
    turno.agente_id = escenario["agente_id"]
    _db.session.commit()
    r = client.delete(
        f"/api/v1/admin/agentes/{escenario['agente_id']}", headers=escenario["admin_auth"]
    )
    assert r.status_code == 409


def test_supervisor_no_puede_eliminar(client, escenario, crear_personal, auth):
    supervisor = auth(crear_personal("SUPERVISOR"))
    r = client.delete(f"/api/v1/admin/agentes/{escenario['agente_id']}", headers=supervisor)
    assert r.status_code == 403


def test_admin_no_se_elimina_a_si_mismo(client, crear_personal, auth):
    yo = crear_personal("ADMIN")
    crear_personal("ADMIN")
    cabeceras = auth(yo)
    r = client.delete(f"/api/v1/admin/usuarios/{yo.id}", headers=cabeceras)
    assert r.status_code == 409
