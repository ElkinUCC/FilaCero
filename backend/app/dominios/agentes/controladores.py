"""Controladores HTTP del dominio de atención."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, get_jwt_identity

from app.dominios.auditoria.servicios import registrar
from app.dominios.turnos.dtos import turno_response
from app.dominios.turnos.preparacion import registrar_preparacion
from app.dominios.usuarios.servicios import PRESENCIAS, cambiar_presencia, dar_de_baja
from app.horario import a_iso
from app.seguridad import requiere_rol

from . import admin_servicios
from .consultas import construir_en_vivo, construir_panel
from .dtos import (
    agente_admin_response,
    cola_response,
    historial_response,
    totales_sede_response,
    totales_tramite_response,
    turno_accion_response,
)
from .servicios import (
    cambiar_sede_propia,
    consultar_cola,
    devolver_a_cola,
    finalizar_atencion,
    iniciar_atencion,
    llamar_siguiente,
    llamar_turno,
    marcar_no_asistio,
    obtener_asesor,
    turno_activo,
)

agentes_bp = Blueprint("agentes", __name__)
admin_agentes_bp = Blueprint("admin_agentes", __name__)


def _agente_id():
    return int(get_jwt_identity())


def _error(error):
    """Respuesta de error uniforme; el código sale del tipo de error de dominio."""
    return jsonify({"success": False, "error": str(error)}), getattr(error, "codigo_http", 400)


# AGENTE (/api/v1/agente)


def _accion(funcion, *args, mensaje):
    try:
        turno = funcion(_agente_id(), *args)
    except ValueError as error:
        return _error(error)
    return jsonify(turno_accion_response(turno, mensaje)), 200


@agentes_bp.get("/panel")
@requiere_rol("AGENTE")
def panel():
    """Consola del asesor en una sola llamada (ver ``consultas.construir_panel``)."""
    return jsonify(construir_panel(obtener_asesor(_agente_id()))), 200


@agentes_bp.put("/sede")
@requiere_rol("AGENTE")
def cambiar_mi_sede():
    """El asesor rota de sede desde su consola (registro en la bitácora)."""
    datos = request.get_json(silent=True) or {}
    agente, anterior = cambiar_sede_propia(_agente_id(), datos.get("punto_id"))
    sede = agente.punto_asignado.nombre
    if anterior is not None:
        registrar("sede_cambiada", f"{agente.nombre}: {anterior} → {sede}")
    return {
        "mensaje": f"Ahora atiendes en {sede}.",
        "sede_id": agente.punto_asignado_id,
        "sede": sede,
    }, 200


@agentes_bp.put("/presencia")
@requiere_rol("AGENTE")
def cambiar_presencia_propia():
    """El asesor indica qué está haciendo: disponible, pausa, almuerzo o fuera de turno."""
    agente = obtener_asesor(_agente_id())
    datos = request.get_json(silent=True) or {}
    anterior = agente.presencia or "DISPONIBLE"
    cambiar_presencia(agente, datos.get("presencia"), bool(turno_activo(agente.id)))
    if anterior != agente.presencia:
        registrar("presencia_cambiada", f"{agente.nombre}: {PRESENCIAS[agente.presencia]}")
    return {
        "mensaje": f"Tu estado: {PRESENCIAS[agente.presencia]}.",
        "presencia": agente.presencia,
        "presencia_desde": a_iso(agente.presencia_desde),
    }, 200


@agentes_bp.get("/cola")
@requiere_rol("AGENTE")
def cola():
    try:
        turnos = consultar_cola(_agente_id())
    except ValueError as error:
        return _error(error)
    return jsonify(cola_response(turnos)), 200


@agentes_bp.get("/actual")
@requiere_rol("AGENTE")
def turno_actual_agente():
    turno = turno_activo(_agente_id())
    return jsonify({"turno": turno_response(turno) if turno else None}), 200


@agentes_bp.post("/llamar-siguiente")
@requiere_rol("AGENTE")
def llamar():
    try:
        turno = llamar_siguiente(_agente_id())
    except ValueError as error:
        return _error(error)
    return jsonify(turno_accion_response(turno, "Turno llamado correctamente.")), 200


@agentes_bp.post("/turnos/<int:turno_id>/llamar")
@requiere_rol("AGENTE")
def llamar_especifico(turno_id):
    return _accion(llamar_turno, turno_id, mensaje="Turno llamado.")


@agentes_bp.post("/turnos/<int:turno_id>/iniciar")
@requiere_rol("AGENTE")
def iniciar(turno_id):
    return _accion(iniciar_atencion, turno_id, mensaje="Atención iniciada.")


@agentes_bp.post("/turnos/<int:turno_id>/finalizar")
@requiere_rol("AGENTE")
def finalizar(turno_id):
    return _accion(finalizar_atencion, turno_id, mensaje="Atención finalizada.")


@agentes_bp.post("/turnos/<int:turno_id>/no-asistio")
@requiere_rol("AGENTE")
def no_asistio(turno_id):
    return _accion(marcar_no_asistio, turno_id, mensaje="Turno marcado como no asistió.")


@agentes_bp.post("/turnos/<int:turno_id>/devolver")
@requiere_rol("AGENTE")
def devolver(turno_id):
    return _accion(devolver_a_cola, turno_id, mensaje="El turno volvió a la cola.")


MENSAJES_PREPARACION = {
    "LISTO": "Turno preparado: el ciudadano verá que todo está listo.",
    "NOVEDAD": "Novedad registrada: el ciudadano la verá al consultar su turno.",
    "EN_PREPARACION": "Marcado en preparación.",
    "PENDIENTE": "Preparación reiniciada.",
}


@agentes_bp.post("/turnos/<int:turno_id>/preparacion")
@requiere_rol("AGENTE")
def preparar(turno_id):
    """Preparación previa: el asesor alista lo que pidió el ciudadano."""
    datos = request.get_json(silent=True) or {}
    turno = registrar_preparacion(_agente_id(), turno_id, datos.get("estado"), datos.get("nota"))
    texto = turno_response(turno)["preparacion"]
    registrar(
        "turno_preparado",
        f"{turno.codigo}: {texto['texto'] if texto else 'Sin preparación'}",
    )
    mensaje = MENSAJES_PREPARACION.get(turno.estado_preparacion, "Preparación actualizada.")
    return jsonify(turno_accion_response(turno, mensaje)), 200


# ADMIN (/api/v1/admin/agentes)


@admin_agentes_bp.get("/")
@requiere_rol("ADMIN", "SUPERVISOR")
def listar_agentes():
    agentes = admin_servicios.listar_agentes()
    return (
        jsonify(
            {"total": len(agentes), "agentes": [agente_admin_response(a, t) for a, t in agentes]}
        ),
        200,
    )


@admin_agentes_bp.post("/")
@requiere_rol("ADMIN")
def crear_agente():
    try:
        agente = admin_servicios.crear_agente(request.get_json(silent=True) or {})
    except ValueError as error:
        return _error(error)
    registrar("usuario_creado", f"{agente.correo} como Asesor")
    respuesta = agente_admin_response(agente, admin_servicios.turno_en_curso(agente))
    return jsonify({"mensaje": "Agente creado.", "agente": respuesta}), 201


@admin_agentes_bp.put("/<int:usuario_id>")
@requiere_rol("ADMIN")
def actualizar_agente(usuario_id):
    try:
        agente = admin_servicios.actualizar_agente(usuario_id, request.get_json(silent=True) or {})
    except ValueError as error:
        return _error(error)
    registrar("usuario_editado", agente.correo)
    respuesta = agente_admin_response(agente, admin_servicios.turno_en_curso(agente))
    return jsonify({"mensaje": "Agente actualizado.", "agente": respuesta}), 200


@admin_agentes_bp.delete("/<int:usuario_id>")
@requiere_rol("ADMIN")
def eliminar_agente(usuario_id):
    """Baja definitiva del asesor. Conserva sus atenciones en el historial."""
    agente, correo = dar_de_baja(usuario_id, current_user.id, roles=("AGENTE",))
    registrar("usuario_eliminado", f"{correo} ({agente.nombre})")
    return jsonify({"mensaje": f"{agente.nombre} fue eliminado. Su historial se conserva."}), 200


@admin_agentes_bp.post("/<int:usuario_id>/sede")
@requiere_rol("ADMIN")
def asignar_sede(usuario_id):
    datos = request.get_json(silent=True) or {}
    try:
        agente = admin_servicios.asignar_sede(usuario_id, datos.get("punto_id"))
    except ValueError as error:
        return _error(error)
    return (
        jsonify(
            {
                "mensaje": "Sede asignada correctamente.",
                "agente_id": agente.id,
                "punto_id": agente.punto_asignado_id,
            }
        ),
        200,
    )


@admin_agentes_bp.delete("/<int:usuario_id>/sede")
@requiere_rol("ADMIN")
def desasignar_sede(usuario_id):
    try:
        agente = admin_servicios.desasignar_sede(usuario_id)
    except ValueError as error:
        return _error(error)
    return (
        jsonify(
            {
                "mensaje": "Asignación de sede eliminada.",
                "agente_id": agente.id,
                "punto_asignado_id": None,
            }
        ),
        200,
    )


@admin_agentes_bp.get("/metricas")
@requiere_rol("ADMIN", "SUPERVISOR")
def obtener_metricas():
    try:
        return jsonify(admin_servicios.metricas(request.args)), 200
    except ValueError as error:
        return _error(error)


@admin_agentes_bp.get("/tablero")
@requiere_rol("ADMIN", "SUPERVISOR")
def tablero_ejecutivo():
    """Tablero ejecutivo del periodo frente al periodo anterior (solo lectura)."""
    from .tablero import construir_tablero

    try:
        datos = construir_tablero(*admin_servicios.leer_parametros_tablero(request.args))
    except ValueError as error:
        mensaje = str(error)
        if "invalid literal" in mensaje:
            mensaje = "Parámetros no válidos."
        return jsonify({"success": False, "error": mensaje}), 400
    return jsonify(datos), 200


@admin_agentes_bp.get("/historial")
@requiere_rol("ADMIN", "SUPERVISOR")
def historial_turnos():
    try:
        pagina, por_pagina, total, turnos = admin_servicios.historial(request.args)
    except ValueError as error:
        return _error(error)
    return jsonify(historial_response(pagina, por_pagina, total, turnos)), 200


@admin_agentes_bp.get("/metricas/sedes")
@requiere_rol("ADMIN", "SUPERVISOR")
def metricas_por_sede():
    try:
        return jsonify(totales_sede_response(admin_servicios.totales_por_sede(request.args))), 200
    except ValueError as error:
        return _error(error)


@admin_agentes_bp.get("/metricas/tramites")
@requiere_rol("ADMIN", "SUPERVISOR")
def metricas_por_tramite():
    try:
        filas = admin_servicios.totales_por_tramite(request.args)
    except ValueError as error:
        return _error(error)
    return jsonify(totales_tramite_response(filas)), 200


@admin_agentes_bp.get("/en-vivo")
@requiere_rol("ADMIN", "SUPERVISOR")
def en_vivo():
    """Estado actual de cada sede activa y las últimas reservas que llegaron."""
    return jsonify(construir_en_vivo()), 200
