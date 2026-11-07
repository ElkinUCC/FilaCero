from datetime import time, timedelta

from flask_jwt_extended import create_access_token

from app import db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.turnos.modelos import Turno
from app.dominios.usuarios.modelos import Usuario
from app.horario import hoy_local

CELULAR = "3001234567"


def test_solicitud_previa_se_muestra_al_asesor(client, db, admin_auth, crear_personal):
    respuesta = client.post(
        "/api/v1/tramites/",
        headers=admin_auth,
        json={
            "nombre": "Actualización de datos",
            "descripcion": "Actualiza tu información de cliente.",
            "tiempo_estimado": 10,
            "instrucciones_preparacion": "Indica tu número de cliente y qué dato deseas actualizar.",
            "campos_solicitud": [
                {
                    "id": "motivo",
                    "etiqueta": "¿Qué dato deseas actualizar?",
                    "tipo": "parrafo",
                    "obligatorio": True,
                },
                {
                    "id": "canal",
                    "etiqueta": "Canal de contacto",
                    "tipo": "seleccion",
                    "opciones": ["Correo", "Teléfono"],
                },
                {
                    "id": "autoriza",
                    "etiqueta": "¿Autorizas el cambio?",
                    "tipo": "si_no",
                },
            ],
        },
    )
    assert respuesta.status_code == 201
    tramite_id = respuesta.get_json()["tramite"]["id"]

    publico = client.get("/api/v1/tramites/").get_json()["tramites"]
    assert publico[0]["instrucciones_preparacion"] == (
        "Indica tu número de cliente y qué dato deseas actualizar."
    )
    assert len(publico[0]["campos_solicitud"]) == 3
    assert all(not campo["obligatorio"] for campo in publico[0]["campos_solicitud"][1:])

    sede = Punto(nombre="Sede Centro", activo=True)
    db.session.add(sede)
    db.session.flush()
    franja = Franja(
        punto_id=sede.id,
        tramite_id=tramite_id,
        fecha=hoy_local() + timedelta(days=1),
        hora_inicio=time(10, 0),
        hora_fin=time(10, 30),
        capacidad=10,
    )
    agente = crear_personal("AGENTE", punto_id=sede.id)
    db.session.add(franja)
    db.session.commit()

    codigo = client.post(
        "/api/v1/turnos/publico/solicitar-codigo", json={"celular": CELULAR}
    ).get_json()["codigo_prueba"]
    verificacion = client.post(
        "/api/v1/turnos/publico/verificar-codigo",
        json={"celular": CELULAR, "codigo": codigo},
    ).get_json()["token_verificacion"]
    datos_reserva = {
        "nombre": "Ana Gómez",
        "celular": CELULAR,
        "token_verificacion": verificacion,
        "punto_id": sede.id,
        "tramite_id": tramite_id,
        "franja_id": franja.id,
    }

    incompleta = client.post("/api/v1/turnos/publico", json=datos_reserva)
    assert incompleta.status_code == 400
    assert "¿Qué dato deseas actualizar?" in incompleta.get_json()["error"]

    datos_reserva["respuestas_solicitud"] = {
        "motivo": "Actualizar el correo electrónico.",
        "canal": "Correo",
        "autoriza": False,
    }
    creada = client.post("/api/v1/turnos/publico", json=datos_reserva)
    assert creada.status_code == 201
    assert "detalle_necesidad" not in creada.get_json()["turno"]
    assert "respuestas_solicitud" not in creada.get_json()["turno"]
    turno = Turno.query.filter_by(codigo=creada.get_json()["turno"]["codigo"]).one()
    assert turno.detalle_necesidad is None
    assert turno.respuestas_solicitud == [
        {
            "id": "motivo",
            "etiqueta": "¿Qué dato deseas actualizar?",
            "tipo": "parrafo",
            "valor": "Actualizar el correo electrónico.",
        },
        {
            "id": "canal",
            "etiqueta": "Canal de contacto",
            "tipo": "seleccion",
            "valor": "Correo",
        },
        {
            "id": "autoriza",
            "etiqueta": "¿Autorizas el cambio?",
            "tipo": "si_no",
            "valor": False,
        },
    ]

    token_agente = create_access_token(identity=str(agente.id), additional_claims={"rol": "AGENTE"})
    panel = client.get(
        "/api/v1/agente/panel", headers={"Authorization": f"Bearer {token_agente}"}
    ).get_json()
    assert panel["cola"][0]["detalle_necesidad"] is None
    assert panel["cola"][0]["respuestas_solicitud"] == turno.respuestas_solicitud


def test_tramite_rechaza_mas_de_tres_preguntas(client, admin_auth):
    respuesta = client.post(
        "/api/v1/tramites/",
        headers=admin_auth,
        json={
            "nombre": "Solicitud extensa",
            "tiempo_estimado": 10,
            "campos_solicitud": [
                {"id": f"pregunta-{numero}", "etiqueta": f"Pregunta {numero}", "tipo": "texto"}
                for numero in range(1, 5)
            ],
        },
    )
    assert respuesta.status_code == 400
    assert "máximo 3 preguntas" in respuesta.get_json()["error"]
