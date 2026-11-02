"""Rotación de sede del asesor y cuentas protegidas (CUENTAS_PROTEGIDAS)."""

from app.dominios.sedes.modelos import Punto


def _sedes(db):
    centro, norte = Punto(nombre="Centro", activo=True), Punto(nombre="Norte", activo=True)
    db.session.add_all([centro, norte])
    db.session.commit()
    return centro, norte


def test_asesor_cambia_su_propia_sede_y_queda_en_la_bitacora(app, client, db, crear_personal, auth):
    centro, norte = _sedes(db)
    asesor = crear_personal("AGENTE", punto_id=centro.id)
    cabeceras = auth(asesor)

    r = client.put("/api/v1/agente/sede", json={"punto_id": norte.id}, headers=cabeceras)
    assert r.status_code == 200
    assert r.get_json()["sede"] == "Norte"
    assert (
        client.get("/api/v1/agente/panel", headers=cabeceras).get_json()["agente"]["sede_id"]
        == norte.id
    )

    admin = auth(crear_personal("ADMIN"))
    eventos = client.get(
        "/api/v1/admin/usuarios/auditoria?accion=sede_cambiada", headers=admin
    ).get_json()["eventos"]
    assert eventos and "Centro → Norte" in eventos[0]["detalle"]


def test_no_cambia_de_sede_con_un_turno_en_curso(app, client, db, crear_personal, auth):
    from datetime import time, timedelta

    from app.dominios.franjas.modelos import Franja
    from app.dominios.tramites.modelos import Tramite
    from app.dominios.turnos.servicios import crear_turno
    from app.dominios.usuarios.modelos import Usuario
    from app.horario import hoy_local

    centro, norte = _sedes(db)
    tramite = Tramite(nombre="Diagnóstico", tiempo_estimado=10, activo=True)
    cliente = Usuario(nombre="Ana", correo="a@x.co", password_hash="x", rol="CLIENTE")
    db.session.add_all([tramite, cliente])
    db.session.commit()
    franja = Franja(
        punto_id=centro.id,
        tramite_id=tramite.id,
        fecha=hoy_local() + timedelta(days=1),
        hora_inicio=time(9, 0),
        hora_fin=time(9, 30),
        capacidad=3,
    )
    db.session.add(franja)
    db.session.commit()
    crear_turno(cliente.id, tramite.id, centro.id, franja.id)

    app.config["RESTRINGIR_ATENCION_HORARIO"] = False
    app.config["COLA_SOLO_HOY"] = False  # el turno de prueba es de mañana
    asesor = crear_personal("AGENTE", punto_id=centro.id)
    cabeceras = auth(asesor)
    assert client.post("/api/v1/agente/llamar-siguiente", headers=cabeceras).status_code == 200

    r = client.put("/api/v1/agente/sede", json={"punto_id": norte.id}, headers=cabeceras)
    assert r.status_code == 409


def test_sede_invalida_o_inactiva(app, client, db, crear_personal, auth):
    centro, _ = _sedes(db)
    inactiva = Punto(nombre="Cerrada", activo=False)
    db.session.add(inactiva)
    db.session.commit()
    cabeceras = auth(crear_personal("AGENTE", punto_id=centro.id))
    assert (
        client.put("/api/v1/agente/sede", json={"punto_id": "x"}, headers=cabeceras).status_code
        == 400
    )
    assert (
        client.put(
            "/api/v1/agente/sede", json={"punto_id": inactiva.id}, headers=cabeceras
        ).status_code
        == 404
    )


def test_cuenta_protegida_no_se_desactiva_ni_cambia_de_rol(app, client, crear_personal, auth):
    protegida = crear_personal("ADMIN")
    app.config["CUENTAS_PROTEGIDAS"] = [protegida.correo]
    admin = auth(crear_personal("ADMIN"))
    ruta = f"/api/v1/admin/usuarios/{protegida.id}"

    assert client.put(ruta, json={"activo": False}, headers=admin).status_code == 409
    assert client.put(ruta, json={"rol": "AGENTE"}, headers=admin).status_code == 409
    assert client.put(ruta, json={"nombre": "Elkin Admin"}, headers=admin).status_code == 200

    lista = client.get("/api/v1/admin/usuarios/", headers=admin).get_json()["usuarios"]
    assert next(u for u in lista if u["id"] == protegida.id)["protegida"] is True
