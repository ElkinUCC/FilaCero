from flask import Blueprint, current_app, g, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.dominios.usuarios.servicios import registrar_cliente_publico
from app.seguridad import enmascarar_celular, limitar, normalizar_celular

from . import otp
from .dtos import turno_publico_response, turno_response
from .prediccion import estimar_espera, tiempo_espera_autorizado
from .sala import pantalla_de_sala
from .servicios import (
    buscar_turno_por_codigo,
    cancelar_turno,
    cancelar_turno_publico,
    crear_turno,
    mis_turnos,
    normalizar_codigo,
    turnos_del_celular,
    validar_vinculos_del_flujo,
    vincular_al_turno,
)

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


def _error(error):
    """Error uniforme; el código HTTP sale del tipo de error de dominio (400 por defecto)."""
    return {"success": False, "error": str(error)}, getattr(error, "codigo_http", 400)


def _entero(datos, campo):
    valor = datos.get(campo)
    if isinstance(valor, bool):
        raise ValueError(f"{campo} no es válido.")
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValueError(f"{campo} no es válido.") from None


# Verificación del celular


def _celular_de(datos, campo="codigo_turno"):
    """Consulta "por código": si no llega el celular, se usa el del dueño del turno."""
    if datos.get("celular"):
        return normalizar_celular(datos.get("celular"))
    codigo = normalizar_codigo(datos.get(campo))
    turno = buscar_turno_por_codigo(codigo) if codigo else None
    if not turno or not turno.usuario or not turno.usuario.celular:
        raise ValueError("No encontramos un turno con ese código. Revisa que esté bien escrito.")
    return turno.usuario.celular


@turnos_bp.post("/publico/solicitar-codigo")
@limitar("LIMITE_OTP_POR_MINUTO")
def solicitar_codigo_celular():
    datos = request.get_json(silent=True) or {}
    try:
        celular = _celular_de(datos)
    except ValueError as error:
        return _error(error)

    try:
        codigo = otp.generar_codigo(celular, getattr(g, "organizacion_id", 1))
    except ValueError as error:
        return {"error": str(error)}, 403
    except RuntimeError:
        return {"error": "La verificación por SMS no está disponible en este momento."}, 503

    respuesta = {
        "mensaje": "Te enviamos un código de verificación.",
        "modo_prueba": False,
        "celular_enmascarado": enmascarar_celular(celular),
    }
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
        celular = _celular_de(datos)
        if not codigo.isdigit():
            raise ValueError("Ingresa el código numérico que recibiste.")
        proposito = str(datos.get("proposito", "reserva")).strip().lower()
        if proposito not in PROPOSITOS_VERIFICACION:
            raise ValueError("El propósito de verificación no es válido.")
        codigo_turno = normalizar_codigo(datos.get("codigo_turno"))
        if proposito in {"consulta", "cancelacion"} and not codigo_turno:
            raise ValueError("Ingresa el código del turno que deseas verificar.")
        if len(codigo_turno) > 30:
            raise ValueError("El código del turno no es válido.")
        otp.verificar_codigo(celular, codigo, getattr(g, "organizacion_id", 1))
    except ValueError as error:
        return _error(error)

    token = _token_verificacion(
        celular,
        proposito=proposito,
        codigo_turno=codigo_turno if proposito in {"consulta", "cancelacion"} else None,
    )
    return {"mensaje": "Celular verificado correctamente.", "token_verificacion": token}, 200


def _variantes_codigo(datos):
    """Código escrito por el ciudadano: completo (FC-...-XXXXXX) o corto (XXXXXX)."""
    codigo = normalizar_codigo(datos.get("codigo"))
    return (codigo, codigo[-6:]) if len(codigo) > 6 else (codigo,)


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
    aceptados = codigo_turno if isinstance(codigo_turno, tuple) else (codigo_turno,)
    firmado = verificacion.get("codigo_turno") or ""
    coincide = firmado in aceptados or firmado[-6:] in aceptados
    if proposito != "reserva" and not coincide:
        raise ValueError("La verificación no corresponde a este turno.")
    return verificacion.get("celular")


# Reserva pública (sin cuenta)


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
        vinculos = validar_vinculos_del_flujo(tramite_id, usuario, datos)
        turno = crear_turno(
            usuario.id,
            tramite_id,
            punto_id,
            franja_id,
            datos.get("detalle_necesidad"),
            datos.get("respuestas_solicitud"),
        )
        vincular_al_turno(turno, usuario, punto_id, vinculos)
    except ValueError as error:
        return _error(error)

    return {
        "mensaje": "Tu turno fue reservado correctamente.",
        "turno": turno_publico_response(turno),
        "espera": estimar_espera(turno),
        "token_consulta": _token_verificacion(celular, "consulta", turno.codigo),
    }, 201


def _turno_publico(datos):
    """Busca un turno por código y celular. Ambos deben coincidir."""
    codigo = normalizar_codigo(datos.get("codigo"))
    if not codigo:
        raise ValueError("Ingresa el código de tu turno.")
    celular = normalizar_celular(datos.get("celular"))
    turno = buscar_turno_por_codigo(codigo, celular)
    if not turno or not turno.usuario or turno.usuario.celular != celular:
        # Mensaje genérico: no revela si el código existe.
        raise LookupError("No encontramos un turno con ese código y celular.")
    return turno


@turnos_bp.post("/publico/consultar")
@limitar("LIMITE_OTP_POR_MINUTO")
def consultar_turno_publico():
    try:
        datos = request.get_json(silent=True) or {}
        celular = _celular_de(datos, "codigo")
        datos = {**datos, "celular": celular}
        # Primero se valida la verificación y DESPUÉS se busca el turno
        if _celular_verificado(datos, "consulta", _variantes_codigo(datos)) != celular:
            raise ValueError("El celular verificado no coincide con el de la consulta.")
        turno = _turno_publico(datos)
    except ValueError as error:
        return _error(error)
    except LookupError as error:
        # Mismo 400 que un dato inválido: no revela si el código existe.
        return _error(error)

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
        turnos = turnos_del_celular(celular, limite=10)
    except ValueError as error:
        return _error(error)

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
        celular = _celular_de(datos, "codigo")
        datos = {**datos, "celular": celular}
        if _celular_verificado(datos, "cancelacion", _variantes_codigo(datos)) != celular:
            raise ValueError("El celular verificado no coincide con el de la cancelación.")
        turno = _turno_publico(datos)
        turno = cancelar_turno_publico(turno)
    except ValueError as error:
        return _error(error)
    except LookupError as error:
        # Mismo 400 que un dato inválido: no revela si el código existe.
        return _error(error)

    return {"mensaje": "Tu turno fue cancelado.", "turno": turno_publico_response(turno)}, 200


# Pantalla de sala de espera (pública, sin datos personales completos)


@turnos_bp.get("/publico/sala")
@limitar("LIMITE_PUBLICO_POR_MINUTO")
def pantalla_sala():
    return pantalla_de_sala(request.args.get("sede_id", type=int)), 200


# Clientes con cuenta


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
        return _error(error)


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
        return _error(error)


# Tiempo de espera estimado (personal o cliente con cuenta)


@turnos_bp.get("/<int:turno_id>/tiempo-espera")
@jwt_required()
def tiempo_espera(turno_id):
    try:
        return tiempo_espera_autorizado(turno_id, int(get_jwt_identity())), 200
    except ValueError as error:
        return _error(error)
