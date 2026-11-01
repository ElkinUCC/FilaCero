"""Regla de puntualidad (cupo por sede y franja) y asistente de despacho."""
from datetime import datetime, time, timedelta, timezone

import pytest
from flask_jwt_extended import create_access_token

from app import create_app, db
from app.dominios.agentes.despacho import cumplimiento, proyectar_cola, recomendar
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.servicios import crear_turno
from app.dominios.usuarios.modelos import Usuario
from app.dominios.usuarios.servicios import registrar_cliente_publico
from app.horario import capacidad_sede, hoy_local, zona


@pytest.fixture
def app():
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "PRUEBAS-FilaCero-JWT-Clave-Segura-2026",
        "RESTRINGIR_ATENCION_HORARIO": False,
    })
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def base(app):
    sede = Punto(nombre="Sede Centro", activo=True)
    t1 = Tramite(nombre="Soporte", tiempo_estimado=10, activo=True)
    t2 = Tramite(nombre="Correo", tiempo_estimado=5, activo=True)
    db.session.add_all([sede, t1, t2])
    db.session.commit()
    agente = Usuario(nombre="Asesor Uno", correo="a1@x.co", password_hash="x",
                     rol="AGENTE", punto_asignado_id=sede.id)
    db.session.add(agente)
    db.session.commit()
    return {"sede": sede, "t1": t1, "t2": t2, "agente": agente}


MANANA = lambda: hoy_local() + timedelta(days=1)  # noqa: E731


def franja(base, tramite, hora, fecha=None, capacidad=10):
    f = Franja(punto_id=base["sede"].id, tramite_id=tramite.id, fecha=fecha or MANANA(),
               hora_inicio=hora, hora_fin=(datetime.combine(MANANA(), hora) + timedelta(minutes=30)).time(),
               capacidad=capacidad)
    db.session.add(f)
    db.session.commit()
    return f


def reservar(base, f, tramite, celular):
    u = registrar_cliente_publico("Cliente Prueba", celular)
    return crear_turno(u.id, tramite.id, base["sede"].id, f.id)


def local(fecha, hh, mm, ss=0):
    return datetime.combine(fecha, time(hh, mm, ss), tzinfo=zona())


def utc_naive(dt):
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


# ---------------------------------------------------------------- cupos

def test_un_asesor_atiende_maximo_3_por_franja_sumando_tramites(app, base):
    assert capacidad_sede(base["sede"].id) == 3
    f1 = franja(base, base["t1"], time(10, 0))
    f2 = franja(base, base["t2"], time(10, 0))
    reservar(base, f1, base["t1"], "3000000001")
    reservar(base, f2, base["t2"], "3000000002")
    reservar(base, f1, base["t1"], "3000000003")
    with pytest.raises(ValueError, match="cupos"):
        reservar(base, f2, base["t2"], "3000000004")


def test_dos_asesores_duplican_el_cupo(app, base):
    db.session.add(Usuario(nombre="Asesor Dos", correo="a2@x.co", password_hash="x",
                           rol="AGENTE", punto_asignado_id=base["sede"].id))
    db.session.commit()
    assert capacidad_sede(base["sede"].id) == 6


def test_disponibilidad_refleja_cupo_de_la_sede(app, base):
    cliente = app.test_client()
    fecha = MANANA().isoformat()
    q = {"sede_id": base["sede"].id, "fecha": fecha}
    franjas = cliente.get("/api/v1/franjas/disponibles", query_string={**q, "tramite_id": base["t1"].id}).get_json()["franjas"]
    assert franjas[0]["disponibles"] == 3
    f1 = db.session.get(Franja, franjas[0]["franja_id"])
    reservar(base, f1, base["t1"], "3000000001")
    reservar(base, f1, base["t1"], "3000000002")
    # El otro trámite ve solo 1 cupo a las 08:00 porque la sede ya tiene 2.
    otras = cliente.get("/api/v1/franjas/disponibles", query_string={**q, "tramite_id": base["t2"].id}).get_json()["franjas"]
    assert otras[0]["hora_inicio"] == "08:00" and otras[0]["disponibles"] == 1


# ---------------------------------------------------------------- despacho

def test_recomienda_pausa_activa_si_va_adelantado(app, base):
    f = franja(base, base["t1"], time(10, 0))
    previo = reservar(base, f, base["t1"], "3000000001")
    siguiente = reservar(base, f, base["t1"], "3000000002")
    ahora = local(MANANA(), 10, 5)
    previo.estado = "ATENDIDO"
    previo.agente_id = base["agente"].id
    previo.fecha_inicio = utc_naive(ahora - timedelta(minutes=2, seconds=30))
    previo.fecha_fin = utc_naive(ahora - timedelta(seconds=30))  # duró 2 minutos
    db.session.commit()

    plan = proyectar_cola(base["sede"].id, ahora)
    assert plan[0]["turno"].id == siguiente.id and plan[0]["puntualidad"] == "a_tiempo"
    rec = recomendar(base["agente"], None, plan, ahora)
    assert rec["accion"] == "pausa" and rec["pausa_seg"] >= 90


def test_recomienda_llamar_urgente_si_la_franja_se_vence(app, base):
    f = franja(base, base["t1"], time(10, 0))
    reservar(base, f, base["t1"], "3000000001")
    ahora = local(MANANA(), 10, 26)
    plan = proyectar_cola(base["sede"].id, ahora)
    assert plan[0]["puntualidad"] == "en_riesgo"
    rec = recomendar(base["agente"], None, plan, ahora)
    assert rec["accion"] == "llamar" and rec["nivel"] == "urgente"


def test_sugiere_adelantar_turno_de_la_siguiente_franja(app, base):
    f = franja(base, base["t1"], time(10, 30))
    reservar(base, f, base["t1"], "3000000001")
    ahora = local(MANANA(), 10, 20)
    rec = recomendar(base["agente"], None, proyectar_cola(base["sede"].id, ahora), ahora)
    assert rec["accion"] == "adelantar"


def test_alerta_cuando_la_atencion_supera_10_minutos(app, base):
    f = franja(base, base["t1"], time(10, 0))
    turno = reservar(base, f, base["t1"], "3000000001")
    ahora = local(MANANA(), 10, 15)
    turno.estado = "EN_ATENCION"
    turno.agente_id = base["agente"].id
    turno.fecha_inicio = utc_naive(ahora - timedelta(minutes=11))
    db.session.commit()
    rec = recomendar(base["agente"], turno, proyectar_cola(base["sede"].id, ahora), ahora)
    assert rec["accion"] == "finalizar" and rec["nivel"] == "urgente"


def test_sugiere_no_asistio_si_no_llega_en_3_minutos(app, base):
    f = franja(base, base["t1"], time(10, 0))
    turno = reservar(base, f, base["t1"], "3000000001")
    ahora = local(MANANA(), 10, 10)
    turno.estado = "LLAMADO"
    turno.agente_id = base["agente"].id
    turno.fecha_llamado = utc_naive(ahora - timedelta(minutes=4))
    db.session.commit()
    rec = recomendar(base["agente"], turno, proyectar_cola(base["sede"].id, ahora), ahora)
    assert rec["accion"] == "ausente"


def test_indicador_de_puntualidad(app, base):
    f = franja(base, base["t1"], time(10, 0))
    a = reservar(base, f, base["t1"], "3000000001")
    b = reservar(base, f, base["t1"], "3000000002")
    for turno, inicio in ((a, local(MANANA(), 10, 5)), (b, local(MANANA(), 10, 40))):
        turno.estado = "ATENDIDO"
        turno.fecha_inicio = utc_naive(inicio)
        turno.fecha_fin = utc_naive(inicio + timedelta(minutes=8))
    db.session.commit()
    datos = cumplimiento([a, b])
    assert datos["puntualidad_pct"] == 50.0 and datos["dentro_tiempo_max_pct"] == 100.0


def test_panel_y_llamado_especifico_por_api(app, base):
    f = franja(base, base["t1"], time(10, 30))
    reservar(base, f, base["t1"], "3000000001")
    elegido = reservar(base, f, base["t1"], "3000000002")
    h = {"Authorization": "Bearer " + create_access_token(
        identity=str(base["agente"].id), additional_claims={"rol": "AGENTE"})}
    cliente = app.test_client()
    panel = cliente.get("/api/v1/agente/panel", headers=h).get_json()
    assert panel["recomendacion"] and len(panel["cola"]) == 2
    assert "puntualidad" in panel["cola"][0]

    r = cliente.post(f"/api/v1/agente/turnos/{elegido.id}/llamar", headers=h)
    assert r.status_code == 200 and r.get_json()["turno"]["fecha_llamado"]
    r = cliente.post(f"/api/v1/agente/turnos/{elegido.id}/llamar", headers=h)
    assert r.status_code == 400
