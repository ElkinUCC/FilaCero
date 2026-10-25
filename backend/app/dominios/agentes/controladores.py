
from datetime import date, datetime, time, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy import func

from app import db
from app.dominios.usuarios.modelos import Usuario
from app.dominios.sedes.modelos import Punto
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.dtos import turno_response

from .servicios import (
    consultar_cola,
    llamar_siguiente,
    iniciar_atencion,
    finalizar_atencion,
)

agentes_bp = Blueprint("agentes", __name__)
admin_agentes_bp = Blueprint("admin_agentes", __name__)


# =========================================================
# UTILIDADES DE AUTORIZACION
# =========================================================

def _rol_requerido(rol):
    if get_jwt().get("rol") != rol:
        return jsonify({
            "error": f"Se requiere rol {rol}."
        }), 403
    return None


# =========================================================
# AGENTE: COLA Y ATENCION
# Base URL: /api/v1/agente
# =========================================================

@agentes_bp.before_request
@jwt_required()
def proteger_agentes():
    return _rol_requerido("AGENTE")


@agentes_bp.get("/cola")
def cola():
    try:
        agente_id = int(get_jwt_identity())
        turnos = consultar_cola(agente_id)

        return jsonify({
            "total_en_espera": len(turnos),
            "turnos": [turno_response(t) for t in turnos],
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@agentes_bp.get("/actual")
def turno_actual_agente():
    agente_id = int(get_jwt_identity())

    turno = (
        Turno.query
        .filter(
            Turno.agente_id == agente_id,
            Turno.estado.in_(("LLAMADO", "EN_ATENCION")),
        )
        .order_by(
            Turno.hora_solicitud.desc(),
            Turno.id.desc(),
        )
        .first()
    )

    return jsonify({
        "turno": turno_response(turno) if turno else None,
    }), 200


@agentes_bp.post("/llamar-siguiente")
def llamar():
    try:
        agente_id = int(get_jwt_identity())
        turno = llamar_siguiente(agente_id)

        return jsonify({
            "mensaje": "Turno llamado correctamente.",
            "turno": turno_response(turno),
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@agentes_bp.post("/turnos/<int:turno_id>/iniciar")
def iniciar(turno_id):
    try:
        agente_id = int(get_jwt_identity())
        turno = iniciar_atencion(agente_id, turno_id)

        return jsonify({
            "mensaje": "Atención iniciada.",
            "turno": turno_response(turno),
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@agentes_bp.post("/turnos/<int:turno_id>/finalizar")
def finalizar(turno_id):
    try:
        agente_id = int(get_jwt_identity())
        turno = finalizar_atencion(agente_id, turno_id)

        return jsonify({
            "mensaje": "Atención finalizada.",
            "turno": turno_response(turno),
        }), 200

    except ValueError as error:
        return jsonify({"error": str(error)}), 400


# =========================================================
# ADMIN: VALIDACIONES Y FILTROS
# Base URL: /api/v1/admin/agentes
# =========================================================

def _consulta_turnos_admin():
    consulta = Turno.query

    desde_txt = request.args.get("desde")
    hasta_txt = request.args.get("hasta")
    punto_txt = request.args.get("punto_id")
    tramite_txt = request.args.get("tramite_id")
    estado = request.args.get("estado")

    try:
        desde = date.fromisoformat(desde_txt) if desde_txt else None
        hasta = date.fromisoformat(hasta_txt) if hasta_txt else None
    except ValueError:
        raise ValueError(
            "Las fechas deben usar formato YYYY-MM-DD."
        )

    if desde and hasta and desde > hasta:
        raise ValueError(
            "La fecha inicial no puede superar la fecha final."
        )

    if desde:
        consulta = consulta.filter(
            Turno.hora_solicitud >= datetime.combine(
                desde, time.min
            )
        )

    if hasta:
        consulta = consulta.filter(
            Turno.hora_solicitud < datetime.combine(
                hasta + timedelta(days=1), time.min
            )
        )

    for nombre, valor in (
        ("punto_id", punto_txt),
        ("tramite_id", tramite_txt),
    ):
        if valor is not None:
            try:
                identificador = int(valor)
                if identificador <= 0:
                    raise ValueError
            except ValueError:
                raise ValueError(
                    f"{nombre} debe ser un entero positivo."
                )

            if nombre == "punto_id":
                consulta = consulta.filter(
                    Turno.punto_id == identificador
                )
            else:
                consulta = consulta.filter(
                    Turno.tramite_id == identificador
                )

    estados_validos = {
        "ESPERANDO",
        "LLAMADO",
        "EN_ATENCION",
        "ATENDIDO",
        "CANCELADO",
    }

    if estado:
        if estado not in estados_validos:
            raise ValueError("Estado de turno no válido.")

        consulta = consulta.filter(Turno.estado == estado)

    return consulta


# =========================================================
# ADMIN: LISTAR AGENTES
# GET /api/v1/admin/agentes/
# =========================================================

@admin_agentes_bp.get("/")
@jwt_required()
def listar_agentes():
    error = _rol_requerido("ADMIN")
    if error:
        return error

    agentes = (
        Usuario.query
        .filter_by(rol="AGENTE")
        .order_by(Usuario.nombre.asc())
        .all()
    )

    return jsonify({
        "total": len(agentes),
        "agentes": [
            {
                "id": agente.id,
                "nombre": agente.nombre,
                "correo": agente.correo,
                "activo": agente.activo,
                "punto_asignado_id": agente.punto_asignado_id,
                "sede": (
                    agente.punto_asignado.nombre
                    if agente.punto_asignado
                    else None
                ),
            }
            for agente in agentes
        ],
    }), 200


# =========================================================
# ADMIN: ASIGNAR SEDE A AGENTE
# POST /api/v1/admin/agentes/<usuario_id>/sede
# =========================================================

@admin_agentes_bp.post("/<int:usuario_id>/sede")
@jwt_required()
def asignar_sede(usuario_id):
    error = _rol_requerido("ADMIN")
    if error:
        return error

    datos = request.get_json(silent=True) or {}
    punto_id = datos.get("punto_id")

    if (
        not isinstance(punto_id, int)
        or isinstance(punto_id, bool)
    ):
        return jsonify({
            "error": "punto_id debe ser un entero."
        }), 400

    agente = Usuario.query.filter_by(
        id=usuario_id,
        rol="AGENTE",
        activo=True,
    ).first()

    if not agente:
        return jsonify({
            "error": "No existe un agente activo con ese ID."
        }), 404

    punto = db.session.get(Punto, punto_id)

    if not punto or not punto.activo:
        return jsonify({
            "error": "La sede no existe o está inactiva."
        }), 404

    agente.punto_asignado_id = punto.id

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify({
        "mensaje": "Sede asignada correctamente.",
        "agente_id": agente.id,
        "punto_id": punto.id,
    }), 200


# =========================================================
# ADMIN: DESASIGNAR SEDE
# DELETE /api/v1/admin/agentes/<usuario_id>/sede
# =========================================================

@admin_agentes_bp.delete("/<int:usuario_id>/sede")
@jwt_required()
def desasignar_sede(usuario_id):
    error = _rol_requerido("ADMIN")
    if error:
        return error

    agente = Usuario.query.filter_by(
        id=usuario_id,
        rol="AGENTE",
    ).first()

    if not agente:
        return jsonify({
            "error": "Agente no encontrado."
        }), 404

    if agente.punto_asignado_id is None:
        return jsonify({
            "error": "El agente no tiene una sede asignada."
        }), 400

    agente.punto_asignado_id = None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    return jsonify({
        "mensaje": "Asignación de sede eliminada.",
        "agente_id": agente.id,
        "punto_asignado_id": None,
    }), 200


# =========================================================
# ADMIN: METRICAS GENERALES
# GET /api/v1/admin/agentes/metricas
# =========================================================

@admin_agentes_bp.get("/metricas")
@jwt_required()
def obtener_metricas():
    error = _rol_requerido("ADMIN")
    if error:
        return error

    try:
        turnos = _consulta_turnos_admin().all()
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    estados = (
        "ESPERANDO",
        "LLAMADO",
        "EN_ATENCION",
        "ATENDIDO",
        "CANCELADO",
    )

    por_estado = {
        estado: sum(t.estado == estado for t in turnos)
        for estado in estados
    }

    duraciones = [
        (t.fecha_fin - t.fecha_inicio).total_seconds()
        for t in turnos
        if (
            t.estado == "ATENDIDO"
            and t.fecha_inicio is not None
            and t.fecha_fin is not None
            and t.fecha_fin >= t.fecha_inicio
        )
    ]

    promedio = (
        round(sum(duraciones) / len(duraciones), 2)
        if duraciones
        else None
    )

    return jsonify({
        "total_turnos": len(turnos),
        "por_estado": por_estado,
        "atendidos": por_estado["ATENDIDO"],
        "cancelados": por_estado["CANCELADO"],
        "en_espera": por_estado["ESPERANDO"],
        "en_proceso": (
            por_estado["LLAMADO"]
            + por_estado["EN_ATENCION"]
        ),
        "promedio_atencion_segundos": promedio,
        "filtros": {
            "desde": request.args.get("desde"),
            "hasta": request.args.get("hasta"),
            "punto_id": request.args.get("punto_id"),
            "tramite_id": request.args.get("tramite_id"),
            "estado": request.args.get("estado"),
        },
    }), 200


# =========================================================
# ADMIN: HISTORIAL PAGINADO DE TURNOS
# GET /api/v1/admin/agentes/historial
# =========================================================

@admin_agentes_bp.get("/historial")
@jwt_required()
def historial_turnos():
    error = _rol_requerido("ADMIN")
    if error:
        return error

    try:
        pagina = int(request.args.get("pagina", 1))
        por_pagina = int(request.args.get("por_pagina", 20))

        if pagina < 1:
            raise ValueError(
                "pagina debe ser mayor que cero."
            )

        if not 1 <= por_pagina <= 100:
            raise ValueError(
                "por_pagina debe estar entre 1 y 100."
            )

        consulta = _consulta_turnos_admin()

    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    total = consulta.count()

    turnos = (
        consulta
        .order_by(
            Turno.hora_solicitud.desc(),
            Turno.id.desc(),
        )
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )

    return jsonify({
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total": total,
        "total_paginas": (
            (total + por_pagina - 1) // por_pagina
        ),
        "turnos": [turno_response(t) for t in turnos],
    }), 200


# =========================================================
# ADMIN: METRICAS POR SEDE
# GET /api/v1/admin/agentes/metricas/sedes
# =========================================================

@admin_agentes_bp.get("/metricas/sedes")
@jwt_required()
def metricas_por_sede():
    error = _rol_requerido("ADMIN")
    if error:
        return error

    try:
        consulta = _consulta_turnos_admin()
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    filas = (
        consulta
        .with_entities(
            Turno.punto_id,
            func.count(Turno.id).label("total"),
        )
        .group_by(Turno.punto_id)
        .order_by(Turno.punto_id.asc())
        .all()
    )

    return jsonify({
        "sedes": [
            {
                "punto_id": fila.punto_id,
                "total_turnos": fila.total,
            }
            for fila in filas
        ],
    }), 200


# =========================================================
# ADMIN: METRICAS POR TRAMITE
# GET /api/v1/admin/agentes/metricas/tramites
# =========================================================

@admin_agentes_bp.get("/metricas/tramites")
@jwt_required()
def metricas_por_tramite():
    error = _rol_requerido("ADMIN")
    if error:
        return error

    try:
        consulta = _consulta_turnos_admin()
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    filas = (
        consulta
        .with_entities(
            Turno.tramite_id,
            func.count(Turno.id).label("total"),
        )
        .group_by(Turno.tramite_id)
        .order_by(Turno.tramite_id.asc())
        .all()
    )

    return jsonify({
        "tramites": [
            {
                "tramite_id": fila.tramite_id,
                "total_turnos": fila.total,
            }
            for fila in filas
        ],
    }), 200
