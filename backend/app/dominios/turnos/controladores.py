from datetime import UTC

from flask import Blueprint, current_app, g, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.dominios.usuarios.servicios import registrar_cliente_publico
from app.seguridad import limitar, normalizar_celular

from . import otp
from .dtos import turno_publico_response, turno_response
from .prediccion import estimar_espera
from .repositorios import obtener_por_codigo, obtener_por_celular
from .servicios import cancelar_turno, cancelar_turno_publico, crear_turno, mis_turnos

turnos_bp = Blueprint("turnos", __name__)

VIGENCIA_VERIFICACION_SEG = 15 * 60
PROPOSITOS_VERIFICACION = {"reserva", "consulta", "consulta_celular", "cancelacion"}


def _serializador_verificacion():
    return URLSafeTimedSerializer(
        current_app.config["SECRET_KEY"], salt="filacero-verificacion-celular"
    )


def _token_verificacion(celular, proposito="reserva", codigo_turno=None):
    return _serializador_verificacion().dumps(
        {
            "celular": celular,
            "proposito": proposito,
            "codigo_turno": codigo_turno,
            "org_id": getattr(g, "organizacion_id", 1),
        }
    )


def _entero(datos, campo):
    valor = datos.get(campo)
    if isinstance(valor, bool):
        raise ValueError(f"{campo} no es válido.")
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValueError(f"{campo} no es válido.") from None


# ---------------------------------------------------------------------
# Verificación del celular
# ---------------------------------------------------------------------


@turnos_bp.post("/publico/solicitar-codigo")
@limitar("LIMITE_OTP_POR_MINUTO")
def solicitar_codigo_celular():
    datos = request.get_json(silent=True) or {}
    try:
        celular = normalizar_celular(datos.get("celular"))
    except ValueError as error:
        return {"error": str(error)}, 400

    try:
        codigo = otp.generar_codigo(celular, getattr(g, "organizacion_id", 1))
    except RuntimeError:
        return {"error": "La verificación por SMS no está disponible en este momento."}, 503

    respuesta = {"mensaje": "Te enviamos un código de verificación.", "modo_prueba": False}
    if codigo is not None:
        respuesta.update(
            {
                "mensaje": "Modo prueba: el código se muestra en pantalla.",
                "modo_prueba": True,
                "codigo_prueba": codigo,
            }
        )
    return respuesta, 200


@turnos_bp.post("/publico/verificar-codigo")
@limitar("LIMITE_OTP_POR_MINUTO")
def verificar_codigo_celular():
    datos = request.get_json(silent=True) or {}
    codigo = str(datos.get("codigo", "")).strip()
    try:
        celular = normalizar_celular(datos.get("celular"))
        if not codigo.isdigit():
            raise ValueError("Ingresa el código numérico que recibiste.")
        proposito = str(datos.get("proposito", "reserva")).strip().lower()
        if proposito not in PROPOSITOS_VERIFICACION:
            raise ValueError("El propósito de verificación no es válido.")
        codigo_turno = str(datos.get("codigo_turno", "")).strip().upper()
        if proposito in {"consulta", "cancelacion"} and not codigo_turno:
            raise ValueError("Ingresa el código del turno que deseas verificar.")
        if len(codigo_turno) > 30:
            raise ValueError("El código del turno no es válido.")
        otp.verificar_codigo(celular, codigo, getattr(g, "organizacion_id", 1))
    except ValueError as error:
        return {"error": str(error)}, 400

    token = _token_verificacion(
        celular,
        proposito=proposito,
        codigo_turno=codigo_turno if proposito in {"consulta", "cancelacion"} else None,
    )
    return {"mensaje": "Celular verificado correctamente.", "token_verificacion": token}, 200


def _celular_verificado(datos, proposito="reserva", codigo_turno=None):
    token = str(datos.get("token_verificacion", "")).strip()
    if not token:
        raise ValueError("Debes verificar tu celular antes de continuar.")
    try:
        verificacion = _serializador_verificacion().loads(token, max_age=VIGENCIA_VERIFICACION_SEG)
    except SignatureExpired:
        raise ValueError("La verificación expiró. Verifica tu celular nuevamente.") from None
    except BadSignature:
        raise ValueError("La verificación del celular no es válida.") from None
    if verificacion.get("org_id") != getattr(g, "organizacion_id", 1):
        raise ValueError("La verificación no corresponde a esta organización.")
    if verificacion.get("proposito", "reserva") != proposito:
        raise ValueError("Verifica tu celular para esta operación.")
    if proposito != "reserva" and verificacion.get("codigo_turno") != codigo_turno:
        raise ValueError("La verificación no corresponde a este turno.")
    return verificacion.get("celular")


# ---------------------------------------------------------------------
# Reserva pública (sin cuenta)
# ---------------------------------------------------------------------


@turnos_bp.post("/publico")
@limitar("LIMITE_OTP_POR_MINUTO")
def solicitar_turno_publico():
    datos = request.get_json(silent=True) or {}
    try:
        celular = normalizar_celular(datos.get("celular"))
        if _celular_verificado(datos) != celular:
            raise ValueError("El celular verificado no coincide con el de la reserva.")

        punto_id = _entero(datos, "punto_id")
        tramite_id = _entero(datos, "tramite_id")
        franja_id = _entero(datos, "franja_id")

        usuario = registrar_cliente_publico(datos.get("nombre"), celular)
        turno = crear_turno(
            usuario.id,
            tramite_id,
            punto_id,
            franja_id,
            datos.get("detalle_necesidad"),
            datos.get("respuestas_solicitud"),
        )
    except ValueError as error:
        return {"error": str(error)}, 400

    return {
        "mensaje": "Tu turno fue reservado correctamente.",
        "turno": turno_publico_response(turno),
        "espera": estimar_espera(turno),
        "token_consulta": _token_verificacion(celular, "consulta", turno.codigo),
    }, 201


def _turno_publico(datos):
    """Busca un turno por código y celular. Ambos deben coincidir."""
    codigo = str(datos.get("codigo", "")).strip().upper()
    if not codigo:
        raise ValueError("Ingresa el código de tu turno.")
    celular = normalizar_celular(datos.get("celular"))
    turno = obtener_por_codigo(codigo)
    if not turno or not turno.usuario or turno.usuario.celular != celular:
        # Mensaje genérico: no revela si el código existe.
        raise LookupError("No encontramos un turno con ese código y celular.")
    return turno


@turnos_bp.post("/publico/consultar")
@limitar("LIMITE_OTP_POR_MINUTO")
def consultar_turno_publico():
    try:
        datos = request.get_json(silent=True) or {}
        codigo = str(datos.get("codigo", "")).strip().upper()
        celular = normalizar_celular(datos.get("celular"))
        if _celular_verificado(datos, "consulta", codigo) != celular:
            raise ValueError("El celular verificado no coincide con el de la consulta.")
        turno = _turno_publico(datos)
    except ValueError as error:
        return {"error": str(error)}, 400
    except LookupError as error:
        # Mismo 400 que un dato inválido: no revela si el código existe.
        return {"error": str(error)}, 400

    return {"turno": turno_publico_response(turno), "espera": estimar_espera(turno)}, 200


@turnos_bp.post("/publico/consultar-por-celular")
@limitar("LIMITE_OTP_POR_MINUTO")
def consultar_turnos_por_celular():
    """Lista turnos del celular únicamente después de verificar el OTP."""
    try:
        datos = request.get_json(silent=True) or {}
        celular = normalizar_celular(datos.get("celular"))
        token = str(datos.get("token_verificacion", "")).strip()
        if not token:
            raise ValueError("Debes verificar tu celular antes de consultar.")
        try:
            verificacion = _serializador_verificacion().loads(
                token, max_age=VIGENCIA_VERIFICACION_SEG
            )
        except SignatureExpired:
            raise ValueError("La verificación expiró. Verifica tu celular nuevamente.") from None
        except BadSignature:
            raise ValueError("La verificación del celular no es válida.") from None
        if verificacion.get("org_id") != getattr(g, "organizacion_id", 1):
            raise ValueError("La verificación no corresponde a esta organización.")
        if verificacion.get("proposito") != "consulta_celular":
            raise ValueError("Verifica tu celular para consultar tus turnos.")
        if verificacion.get("celular") != celular:
            raise ValueError("El celular verificado no coincide con la consulta.")
        turnos = obtener_por_celular(celular, limite=10)
    except ValueError as error:
        return {"error": str(error)}, 400

    return {
        "turnos": [
            {"turno": turno_publico_response(turno), "espera": estimar_espera(turno)}
            for turno in turnos
        ]
    }, 200


@turnos_bp.post("/publico/cancelar")
@limitar("LIMITE_OTP_POR_MINUTO")
def cancelar_publico():
    try:
        datos = request.get_json(silent=True) or {}
        codigo = str(datos.get("codigo", "")).strip().upper()
        celular = normalizar_celular(datos.get("celular"))
        if _celular_verificado(datos, "cancelacion", codigo) != celular:
            raise ValueError("El celular verificado no coincide con el de la cancelación.")
        turno = _turno_publico(datos)
        turno = cancelar_turno_publico(turno)
    except ValueError as error:
        return {"error": str(error)}, 400
    except LookupError as error:
        # Mismo 400 que un dato inválido: no revela si el código existe.
        return {"error": str(error)}, 400

    return {"mensaje": "Tu turno fue cancelado.", "turno": turno_publico_response(turno)}, 200


# ---------------------------------------------------------------------
# Pantalla de sala de espera (pública, sin datos personales completos)
# ---------------------------------------------------------------------


def _nombre_corto(nombre):
    partes = (nombre or "").split()
    if not partes:
        return ""
    return partes[0] + (f" {partes[1][0]}." if len(partes) > 1 else "")


@turnos_bp.get("/publico/sala")
@limitar("LIMITE_PUBLICO_POR_MINUTO")
def pantalla_sala():
    from datetime import timedelta

    from app import db
    from app.dominios.franjas.modelos import Franja
    from app.dominios.sedes.modelos import Punto
    from app.dominios.turnos.modelos import Turno
    from app.horario import ahora_local, hoy_local, info_horario

    sedes = Punto.query.filter_by(activo=True).order_by(Punto.nombre).all()
    sede_id = request.args.get("sede_id", type=int)
    sede = db.session.get(Punto, sede_id) if sede_id else None
    if not sede or not sede.activo:
        return {"sedes": [{"id": p.id, "nombre": p.nombre} for p in sedes], "sede": None}, 200

    hoy = hoy_local()
    hace_30 = (ahora_local() - timedelta(minutes=30)).astimezone(UTC).replace(tzinfo=None)
    llamados = (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(
            Turno.punto_id == sede.id,
            Franja.fecha == hoy,
            Turno.estado.in_(("LLAMADO", "EN_ATENCION", "ATENDIDO")),
            Turno.fecha_llamado.isnot(None),
            Turno.fecha_llamado >= hace_30,
        )
        .order_by(Turno.fecha_llamado.desc())
        .limit(6)
        .all()
    )
    siguientes = (
        Turno.query.join(Franja, Turno.franja_id == Franja.id)
        .filter(Turno.punto_id == sede.id, Franja.fecha == hoy, Turno.estado == "ESPERANDO")
        .order_by(Franja.hora_inicio.asc(), Turno.hora_solicitud.asc())
        .limit(6)
        .all()
    )
    from app.horario import a_iso_utc

    return {
        "sedes": [{"id": p.id, "nombre": p.nombre} for p in sedes],
        "sede": {"id": sede.id, "nombre": sede.nombre, "direccion": sede.direccion},
        "horario": info_horario(),
        "llamados": [
            {
                "id": t.id,
                "codigo": t.codigo[-6:],
                "nombre": _nombre_corto(t.usuario.nombre if t.usuario else ""),
                "asesor": _nombre_corto(t.agente.nombre if t.agente else ""),
                "estado": t.estado,
                "llamado": a_iso_utc(t.fecha_llamado),
            }
            for t in llamados
        ],
        "siguientes": [
            {
                "codigo": t.codigo[-6:],
                "nombre": _nombre_corto(t.usuario.nombre if t.usuario else ""),
                "hora": f"{t.franja.hora_inicio:%H:%M}",
            }
            for t in siguientes
        ],
    }, 200


# ---------------------------------------------------------------------
# Clientes con cuenta
# ---------------------------------------------------------------------


@turnos_bp.post("/")
@jwt_required()
def solicitar_turno():
    datos = request.get_json(silent=True) or {}
    try:
        turno = crear_turno(
            int(get_jwt_identity()),
            _entero(datos, "tramite_id"),
            _entero(datos, "punto_id"),
            _entero(datos, "franja_id"),
            datos.get("detalle_necesidad"),
            datos.get("respuestas_solicitud"),
        )
        return turno_response(turno), 201
    except ValueError as error:
        return {"error": str(error)}, 400


@turnos_bp.get("/mis-turnos")
@jwt_required()
def obtener_mis_turnos():
    turnos = mis_turnos(int(get_jwt_identity()))
    return {"turnos": [turno_response(t) for t in turnos]}, 200


@turnos_bp.post("/<int:turno_id>/cancelar")
@jwt_required()
def cancelar_mi_turno(turno_id):
    try:
        turno = cancelar_turno(turno_id, int(get_jwt_identity()))
        return {"mensaje": "Turno cancelado.", "turno": turno_response(turno)}, 200
    except ValueError as error:
        return {"error": str(error)}, 400
