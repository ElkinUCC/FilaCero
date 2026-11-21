import secrets
import threading
from collections import defaultdict
from datetime import datetime

from app import db
from app.dominios.franjas.repositorios import obtener_para_reserva
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.usuarios.modelos import Usuario
from app.errores import ConflictoError
from app.horario import ahora_local, capacidad_sede, ocupacion_sede, zona
from scripts.turnos.preparacion import estado_inicial

from .modelos import Turno
from .repositorios import (
    ESTADOS_ACTIVOS,
    guardar,
    normalizar_codigo,  # noqa: F401 - se reexporta para los controladores
    obtener_por_celular,
    obtener_por_codigo,
    obtener_por_id,
    obtener_por_usuario,
)

MAX_TURNOS_ACTIVOS_POR_CLIENTE = 3

# Reservas de una misma sede se procesan de a una (ver ADR-0004)
_candados_sede = defaultdict(threading.Lock)
_candado_global = threading.Lock()


def _candado_de(punto_id):
    with _candado_global:
        return _candados_sede[punto_id]


def _generar_codigo(ahora):
    for _ in range(5):
        codigo = f"FC-{ahora:%Y%m%d}-{secrets.token_hex(3).upper()}"
        if not Turno.query.filter_by(codigo=codigo).first():
            return codigo
    raise ValueError("No se pudo generar el código del turno. Intenta de nuevo.")


def _validar_solicitud(tramite, detalle_necesidad, valores):
    if detalle_necesidad is None:
        detalle_necesidad = ""
    if not isinstance(detalle_necesidad, str):
        raise ValueError("El detalle de la necesidad debe ser texto.")
    detalle_necesidad = detalle_necesidad.strip()
    if len(detalle_necesidad) > 1000:
        raise ValueError("El detalle de la necesidad no puede superar 1000 caracteres.")
    if valores is None:
        valores = {}
    if not isinstance(valores, dict):
        raise ValueError("Las respuestas del formulario no son válidas.")
    campos = tramite.campos_solicitud or []
    permitidos = {campo["id"] for campo in campos}
    if set(valores) - permitidos:
        raise ValueError("El formulario cambió. Actualiza la página e intenta de nuevo.")

    respuestas = []
    for campo in campos:
        valor = valores.get(campo["id"])
        if campo["tipo"] == "si_no":
            if valor is not None and not isinstance(valor, bool):
                raise ValueError(f"Responde Sí o No en: {campo['etiqueta']}.")
            vacio = valor is None
        else:
            if valor is not None and not isinstance(valor, str):
                raise ValueError(f"La respuesta de {campo['etiqueta']} no es válida.")
            valor = valor.strip() if isinstance(valor, str) else ""
            limite = 1000 if campo["tipo"] == "parrafo" else 150
            if len(valor) > limite:
                raise ValueError(f"La respuesta de {campo['etiqueta']} supera {limite} caracteres.")
            if campo["tipo"] == "seleccion" and valor and valor not in campo["opciones"]:
                raise ValueError(f"Selecciona una opción válida en: {campo['etiqueta']}.")
            vacio = not valor

        if vacio:
            if campo["obligatorio"]:
                raise ValueError(f"Completa la pregunta: {campo['etiqueta']}.")
            continue
        respuestas.append(
            {
                "id": campo["id"],
                "etiqueta": campo["etiqueta"],
                "tipo": campo["tipo"],
                "valor": valor,
            }
        )
    return detalle_necesidad or None, respuestas or None


def crear_turno(
    usuario_id,
    tramite_id,
    punto_id,
    franja_id,
    detalle_necesidad=None,
    respuestas_solicitud=None,
):
    with _candado_de(punto_id):
        return _crear_turno(
            usuario_id,
            tramite_id,
            punto_id,
            franja_id,
            detalle_necesidad,
            respuestas_solicitud,
        )


def _crear_turno(
    usuario_id,
    tramite_id,
    punto_id,
    franja_id,
    detalle_necesidad=None,
    respuestas_solicitud=None,
):
    try:
        usuario = db.session.get(Usuario, usuario_id)
        tramite = db.session.get(Tramite, tramite_id)
        # Bloquea la sede
        punto = db.session.query(Punto).filter_by(id=punto_id).with_for_update().first()

        if not usuario or not usuario.activo:
            raise ValueError("El usuario no existe o está inactivo.")
        if not tramite or not tramite.activo:
            raise ValueError("El trámite no existe o está inactivo.")
        detalle_necesidad, respuestas_solicitud = _validar_solicitud(
            tramite, detalle_necesidad, respuestas_solicitud
        )
        if not punto or not punto.activo:
            raise ValueError("La sede no existe o está inactiva.")

        # Bloqueo de fila: evita sobrecupo con reservas simultáneas (MySQL).
        franja = obtener_para_reserva(franja_id)
        if not franja or not franja.activa:
            raise ValueError("La franja no existe o está inactiva.")
        if franja.punto_id != punto_id or franja.tramite_id != tramite_id:
            raise ValueError("La franja no corresponde a la sede y trámite.")

        ahora = ahora_local()
        inicio = datetime.combine(franja.fecha, franja.hora_inicio, tzinfo=zona())
        if inicio <= ahora:
            raise ValueError("No se pueden reservar franjas que ya comenzaron.")

        reservados = Turno.query.filter(
            Turno.franja_id == franja.id, Turno.estado != "CANCELADO"
        ).count()
        if reservados >= franja.capacidad:
            raise ConflictoError("La franja ya no tiene cupos disponibles.")

        # Regla de puntualidad
        if ocupacion_sede(punto_id, franja.fecha, franja.hora_inicio) >= capacidad_sede(punto_id):
            raise ConflictoError("La franja ya no tiene cupos disponibles.")

        duplicado = Turno.query.filter(
            Turno.usuario_id == usuario_id,
            Turno.franja_id == franja.id,
            Turno.estado != "CANCELADO",
        ).first()
        if duplicado:
            raise ConflictoError("Ya tienes una reserva activa en esta franja.")

        activos = Turno.query.filter(
            Turno.usuario_id == usuario_id, Turno.estado.in_(ESTADOS_ACTIVOS)
        ).count()
        if activos >= MAX_TURNOS_ACTIVOS_POR_CLIENTE:
            raise ValueError(
                f"Ya tienes {MAX_TURNOS_ACTIVOS_POR_CLIENTE} turnos activos. "
                "Cancela uno para reservar otro."
            )

        turno = Turno(
            codigo=_generar_codigo(ahora),
            usuario_id=usuario_id,
            tramite_id=tramite_id,
            punto_id=punto_id,
            franja_id=franja.id,
            detalle_necesidad=detalle_necesidad,
            respuestas_solicitud=respuestas_solicitud,
            estado="ESPERANDO",
            estado_preparacion=estado_inicial(tramite),
        )
        return guardar(turno)

    except Exception:
        db.session.rollback()
        raise


def mis_turnos(usuario_id):
    return obtener_por_usuario(usuario_id)


def _cancelar(turno):
    if turno.estado != "ESPERANDO":
        raise ValueError("Solo se pueden cancelar turnos en espera.")
    turno.estado = "CANCELADO"
    db.session.commit()
    return turno


def cancelar_turno(turno_id, usuario_id):
    try:
        turno = obtener_por_id(turno_id)
        if not turno:
            raise ValueError("El turno no existe.")
        if turno.usuario_id != usuario_id:
            raise ValueError("No puedes cancelar un turno de otro usuario.")
        return _cancelar(turno)
    except Exception:
        db.session.rollback()
        raise


def cancelar_turno_publico(turno):
    try:
        return _cancelar(turno)
    except Exception:
        db.session.rollback()
        raise


# Vínculos según el tipo de trámite (entrega, garantía, reclamo)


def validar_vinculos_del_flujo(tramite_id, usuario, datos):
    """Valida, ANTES de reservar, lo que exige el tipo de trámite."""
    from app.dominios.equipos.servicios import datos_garantia, equipo_para_entrega
    from app.dominios.reclamos.repositorios import obtener as obtener_reclamo

    tramite = db.session.get(Tramite, tramite_id)
    flujo = getattr(tramite, "tipo_flujo", None) or "GENERAL"
    if flujo == "ENTREGA":
        return {"equipo": equipo_para_entrega(datos.get("equipo_id"), usuario)}
    if flujo == "GARANTIA":
        return {"garantia": datos_garantia(datos.get("garantia"))}
    if flujo == "RECLAMO" and datos.get("reclamo_id"):
        reclamo = obtener_reclamo(int(datos["reclamo_id"]))
        if not reclamo or reclamo.cliente_id != usuario.id:
            raise ValueError("El reclamo no corresponde a tu celular.")
        return {"reclamo": reclamo}
    return {}


def vincular_al_turno(turno, usuario, punto_id, vinculos):
    """Asocia al turno ya creado el equipo o el reclamo correspondiente."""
    from app.dominios.equipos.servicios import registrar as registrar_equipo

    if not vinculos:
        return turno
    if "garantia" in vinculos:
        equipo = registrar_equipo(
            usuario, punto_id, vinculos["garantia"], None, "GARANTIA", "POR_RECIBIR"
        )
        turno.equipo_id = equipo.id
    if "equipo" in vinculos:
        turno.equipo_id = vinculos["equipo"].id
    if "reclamo" in vinculos:
        reclamo = vinculos["reclamo"]
        turno.reclamo_id = reclamo.id
        reclamo.presencial = True
    db.session.commit()
    return turno


# Consultas para la capa de presentación (ADR-017: controlador → servicio → repositorio)


def buscar_turno_por_codigo(codigo, celular=None):
    """Turno por código completo o, con el celular del dueño, por el corto."""
    return obtener_por_codigo(codigo, celular)


def turnos_del_celular(celular, limite=10):
    """Turnos recientes del ciudadano dentro de la organización activa."""
    return obtener_por_celular(celular, limite=limite)
