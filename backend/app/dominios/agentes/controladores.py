from datetime import UTC, date, datetime, time, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity
from sqlalchemy import func

from app import db
from app.dominios.franjas.modelos import Franja
from app.dominios.sedes.modelos import Punto
from app.dominios.tramites.modelos import Tramite
from app.dominios.turnos.dtos import turno_response
from app.dominios.turnos.modelos import Turno
from app.dominios.turnos.repositorios import ESTADOS
from app.dominios.usuarios.dtos import usuario_response
from app.dominios.usuarios.modelos import Usuario
from app.dominios.usuarios.servicios import registrar_usuario
from app.horario import (
    a_iso_utc,
    ahora_local,
    duracion_max_atencion_min,
    hoy_local,
    info_horario,
    zona,
)
from app.seguridad import encriptar_password, requiere_rol, validar_password_segura

from .despacho import (
    cumplimiento,
    estado_franja_actual,
    proyectar_cola,
    recomendar,
)
from .servicios import (
    consultar_cola,
    devolver_a_cola,
    en_horario_de_atencion,
    finalizar_atencion,
    iniciar_atencion,
    llamar_siguiente,
    llamar_turno,
    marcar_no_asistio,
    turno_activo,
)

agentes_bp = Blueprint("agentes", __name__)
admin_agentes_bp = Blueprint("admin_agentes", __name__)


def _agente_id():
    return int(get_jwt_identity())


def _rango_utc_de_hoy():
    """Inicio y fin del día local expresados en UTC sin zona (como se guardan)."""
    inicio = datetime.combine(hoy_local(), time.min, tzinfo=zona())
    inicio = inicio.astimezone(UTC).replace(tzinfo=None)
    return inicio, inicio + timedelta(days=1)


def _promedio_segundos(turnos):
    duraciones = [
        (t.fecha_fin - t.fecha_inicio).total_seconds()
        for t in turnos
        if t.estado == "ATENDIDO"
        and t.fecha_inicio
        and t.fecha_fin
        and t.fecha_fin >= t.fecha_inicio
    ]
    return round(sum(duraciones) / len(duraciones), 1) if duraciones else None


# =====================================================================
# AGENTE  (/api/v1/agente)
# =====================================================================


def _accion(funcion, *args, mensaje):
    try:
        turno = funcion(_agente_id(), *args)
        return jsonify({"mensaje": mensaje, "turno": turno_response(turno)}), 200
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@agentes_bp.get("/panel")
@requiere_rol("AGENTE")
def panel():
    """Consola del asesor en una sola llamada: reloj, franja, cola con
    proyección de puntualidad y recomendación del asistente."""
    agente = db.session.get(Usuario, _agente_id())
    activo = turno_activo(agente.id)
    ahora = ahora_local()

    error = None
    proyeccion = []
    try:
        consultar_cola(agente.id)  # valida sede asignada y activa
        proyeccion = proyectar_cola(agente.punto_asignado_id, ahora)
    except ValueError as e:
        error = str(e)

    desde, hasta = _rango_utc_de_hoy()
    mios_hoy = Turno.query.filter(
        Turno.agente_id == agente.id,
        Turno.fecha_fin >= desde,
        Turno.fecha_fin < hasta,
    ).all()
    recientes = sorted(
        [t for t in mios_hoy if t.estado in ("ATENDIDO", "NO_ASISTIO")],
        key=lambda t: t.fecha_fin,
        reverse=True,
    )[:5]

    cola = []
    for p in proyeccion:
        datos = turno_response(p["turno"])
        datos.update(
            {
                "puntualidad": p["puntualidad"],
                "inicio_proyectado": p["inicio_proyectado"].strftime("%H:%M"),
                "duracion_estimada_seg": p["duracion_estimada_seg"],
                "margen_seg": p["margen_seg"],
                "es_hoy": p["turno"].franja.fecha == ahora.date(),
            }
        )
        cola.append(datos)

    return (
        jsonify(
            {
                "ahora": ahora.isoformat(timespec="seconds"),
                "agente": {
                    "nombre": agente.nombre,
                    "sede": agente.punto_asignado.nombre if agente.punto_asignado else None,
                    "sede_direccion": (
                        agente.punto_asignado.direccion if agente.punto_asignado else None
                    ),
                },
                "error": error,
                "en_horario": en_horario_de_atencion(),
                "horario": info_horario(),
                "max_atencion_seg": duracion_max_atencion_min() * 60,
                "franja_actual": (
                    estado_franja_actual(agente.punto_asignado_id, ahora)
                    if agente.punto_asignado_id
                    else None
                ),
                "actual": turno_response(activo) if activo else None,
                "recomendacion": (
                    recomendar(agente, activo, proyeccion, ahora) if not error else None
                ),
                "cola": cola,
                "resumen": {
                    "en_espera": len(cola),
                    "en_espera_hoy": sum(1 for t in cola if t["es_hoy"]),
                    "en_riesgo": sum(
                        1 for t in cola if t["puntualidad"] in ("en_riesgo", "atrasado")
                    ),
                    "atendidos_hoy": sum(1 for t in mios_hoy if t.estado == "ATENDIDO"),
                    "no_asistio_hoy": sum(1 for t in mios_hoy if t.estado == "NO_ASISTIO"),
                    "promedio_hoy_segundos": _promedio_segundos(mios_hoy),
                    **cumplimiento(mios_hoy),
                },
                "recientes": [turno_response(t) for t in recientes],
            }
        ),
        200,
    )


@agentes_bp.get("/cola")
@requiere_rol("AGENTE")
def cola():
    try:
        turnos = consultar_cola(_agente_id())
        return (
            jsonify(
                {
                    "total_en_espera": len(turnos),
                    "turnos": [turno_response(t) for t in turnos],
                }
            ),
            200,
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


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
        return (
            jsonify({"mensaje": "Turno llamado correctamente.", "turno": turno_response(turno)}),
            200,
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


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


# =====================================================================
# ADMIN  (/api/v1/admin/agentes)
# =====================================================================


def _consulta_turnos_admin():
    consulta = Turno.query.join(Franja, Turno.franja_id == Franja.id)

    try:
        desde = date.fromisoformat(request.args["desde"]) if request.args.get("desde") else None
        hasta = date.fromisoformat(request.args["hasta"]) if request.args.get("hasta") else None
    except ValueError:
        raise ValueError("Las fechas deben usar formato YYYY-MM-DD.") from None

    if desde and hasta and desde > hasta:
        raise ValueError("La fecha inicial no puede superar la fecha final.")

    # El filtro de fechas se aplica sobre la fecha de la cita (franja).
    if desde:
        consulta = consulta.filter(Franja.fecha >= desde)
    if hasta:
        consulta = consulta.filter(Franja.fecha <= hasta)

    for nombre, columna in (("punto_id", Turno.punto_id), ("tramite_id", Turno.tramite_id)):
        valor = request.args.get(nombre)
        if valor not in (None, ""):
            try:
                identificador = int(valor)
                if identificador <= 0:
                    raise ValueError
            except ValueError:
                raise ValueError(f"{nombre} debe ser un entero positivo.") from None
            consulta = consulta.filter(columna == identificador)

    estado = request.args.get("estado")
    if estado:
        if estado not in ESTADOS:
            raise ValueError("Estado de turno no válido.")
        consulta = consulta.filter(Turno.estado == estado)

    buscar = (request.args.get("buscar") or "").strip()
    if buscar:
        patron = f"%{buscar[:40]}%"
        consulta = consulta.join(Usuario, Turno.usuario_id == Usuario.id).filter(
            db.or_(
                Turno.codigo.ilike(patron),
                Usuario.nombre.ilike(patron),
                Usuario.celular.ilike(patron),
            )
        )
    return consulta


def _agente_dict(agente):
    datos = usuario_response(agente)
    activo = Turno.query.filter(
        Turno.agente_id == agente.id, Turno.estado.in_(("LLAMADO", "EN_ATENCION"))
    ).first()
    datos["turno_actual"] = activo.codigo if activo else None
    datos["estado_turno_actual"] = activo.estado if activo else None
    return datos


@admin_agentes_bp.get("/")
@requiere_rol("ADMIN", "SUPERVISOR")
def listar_agentes():
    agentes = Usuario.query.filter_by(rol="AGENTE").order_by(Usuario.nombre.asc()).all()
    return jsonify({"total": len(agentes), "agentes": [_agente_dict(a) for a in agentes]}), 200


def _sede_valida(punto_id):
    if punto_id in (None, ""):
        return None
    if isinstance(punto_id, bool):
        raise ValueError("punto_id debe ser un entero.")
    try:
        punto_id = int(punto_id)
    except (TypeError, ValueError):
        raise ValueError("punto_id debe ser un entero.") from None
    punto = db.session.get(Punto, punto_id)
    if not punto or not punto.activo:
        raise ValueError("La sede no existe o está inactiva.")
    return punto.id


@admin_agentes_bp.post("/")
@requiere_rol("ADMIN")
def crear_agente():
    datos = request.get_json(silent=True) or {}
    nombre = " ".join(str(datos.get("nombre", "")).split())
    correo = str(datos.get("correo", "")).strip().lower()
    try:
        if len(nombre) < 3 or len(nombre) > 100:
            raise ValueError("El nombre debe tener entre 3 y 100 caracteres.")
        if "@" not in correo or len(correo) > 120:
            raise ValueError("Ingresa un correo válido.")
        punto_id = _sede_valida(datos.get("punto_id"))
        agente = registrar_usuario(
            nombre, correo, datos.get("password", ""), rol="AGENTE", punto_id=punto_id
        )
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    from app.dominios.auditoria.servicios import registrar

    registrar("usuario_creado", f"{agente.correo} como Asesor")
    return jsonify({"mensaje": "Agente creado.", "agente": _agente_dict(agente)}), 201


@admin_agentes_bp.put("/<int:usuario_id>")
@requiere_rol("ADMIN")
def actualizar_agente(usuario_id):
    agente = Usuario.query.filter_by(id=usuario_id, rol="AGENTE").first()
    if not agente:
        return jsonify({"error": "Agente no encontrado."}), 404

    datos = request.get_json(silent=True) or {}
    try:
        if "nombre" in datos:
            nombre = " ".join(str(datos["nombre"]).split())
            if len(nombre) < 3 or len(nombre) > 100:
                raise ValueError("El nombre debe tener entre 3 y 100 caracteres.")
            agente.nombre = nombre
        if "punto_id" in datos:
            agente.punto_asignado_id = _sede_valida(datos["punto_id"])
        if "activo" in datos:
            agente.activo = bool(datos["activo"])
        if datos.get("password"):
            validar_password_segura(datos["password"])
            agente.password_hash = encriptar_password(datos["password"])
        db.session.commit()
    except ValueError as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400
    from app.dominios.auditoria.servicios import registrar

    registrar("usuario_editado", agente.correo)
    return jsonify({"mensaje": "Agente actualizado.", "agente": _agente_dict(agente)}), 200


@admin_agentes_bp.post("/<int:usuario_id>/sede")
@requiere_rol("ADMIN")
def asignar_sede(usuario_id):
    datos = request.get_json(silent=True) or {}
    punto_id = datos.get("punto_id")
    if not isinstance(punto_id, int) or isinstance(punto_id, bool):
        return jsonify({"error": "punto_id debe ser un entero."}), 400

    agente = Usuario.query.filter_by(id=usuario_id, rol="AGENTE", activo=True).first()
    if not agente:
        return jsonify({"error": "No existe un agente activo con ese ID."}), 404

    punto = db.session.get(Punto, punto_id)
    if not punto or not punto.activo:
        return jsonify({"error": "La sede no existe o está inactiva."}), 404

    agente.punto_asignado_id = punto.id
    db.session.commit()
    return (
        jsonify(
            {
                "mensaje": "Sede asignada correctamente.",
                "agente_id": agente.id,
                "punto_id": punto.id,
            }
        ),
        200,
    )


@admin_agentes_bp.delete("/<int:usuario_id>/sede")
@requiere_rol("ADMIN")
def desasignar_sede(usuario_id):
    agente = Usuario.query.filter_by(id=usuario_id, rol="AGENTE").first()
    if not agente:
        return jsonify({"error": "Agente no encontrado."}), 404
    if agente.punto_asignado_id is None:
        return jsonify({"error": "El agente no tiene una sede asignada."}), 400
    agente.punto_asignado_id = None
    db.session.commit()
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
        turnos = _consulta_turnos_admin().all()
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    por_estado = {estado: sum(t.estado == estado for t in turnos) for estado in ESTADOS}
    return (
        jsonify(
            {
                "total_turnos": len(turnos),
                "por_estado": por_estado,
                "atendidos": por_estado["ATENDIDO"],
                "cancelados": por_estado["CANCELADO"],
                "no_asistio": por_estado["NO_ASISTIO"],
                "en_espera": por_estado["ESPERANDO"],
                "en_proceso": por_estado["LLAMADO"] + por_estado["EN_ATENCION"],
                "promedio_atencion_segundos": _promedio_segundos(turnos),
                "max_atencion_seg": duracion_max_atencion_min() * 60,
                **cumplimiento(turnos),
                "agentes_activos": Usuario.query.filter_by(rol="AGENTE", activo=True).count(),
                "filtros": {
                    k: request.args.get(k)
                    for k in ("desde", "hasta", "punto_id", "tramite_id", "estado")
                },
            }
        ),
        200,
    )


@admin_agentes_bp.get("/historial")
@requiere_rol("ADMIN", "SUPERVISOR")
def historial_turnos():
    try:
        pagina = int(request.args.get("pagina", 1))
        por_pagina = int(request.args.get("por_pagina", 20))
        if pagina < 1:
            raise ValueError("pagina debe ser mayor que cero.")
        if not 1 <= por_pagina <= 100:
            raise ValueError("por_pagina debe estar entre 1 y 100.")
        consulta = _consulta_turnos_admin()
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    total = consulta.count()
    turnos = (
        consulta.order_by(Franja.fecha.desc(), Franja.hora_inicio.desc(), Turno.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return (
        jsonify(
            {
                "pagina": pagina,
                "por_pagina": por_pagina,
                "total": total,
                "total_paginas": (total + por_pagina - 1) // por_pagina,
                "turnos": [turno_response(t) for t in turnos],
            }
        ),
        200,
    )


@admin_agentes_bp.get("/metricas/sedes")
@requiere_rol("ADMIN", "SUPERVISOR")
def metricas_por_sede():
    try:
        consulta = _consulta_turnos_admin()
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    filas = (
        consulta.join(Punto, Turno.punto_id == Punto.id)
        .with_entities(
            Turno.punto_id,
            Punto.nombre,
            func.count(Turno.id).label("total"),
            func.sum(db.case((Turno.estado == "ESPERANDO", 1), else_=0)).label("espera"),
            func.sum(db.case((Turno.estado == "ATENDIDO", 1), else_=0)).label("atendidos"),
        )
        .group_by(Turno.punto_id, Punto.nombre)
        .order_by(func.count(Turno.id).desc())
        .all()
    )
    return (
        jsonify(
            {
                "sedes": [
                    {
                        "punto_id": f.punto_id,
                        "nombre": f.nombre,
                        "total_turnos": f.total,
                        "en_espera": int(f.espera or 0),
                        "atendidos": int(f.atendidos or 0),
                    }
                    for f in filas
                ]
            }
        ),
        200,
    )


@admin_agentes_bp.get("/metricas/tramites")
@requiere_rol("ADMIN", "SUPERVISOR")
def metricas_por_tramite():
    try:
        consulta = _consulta_turnos_admin()
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    filas = (
        consulta.join(Tramite, Turno.tramite_id == Tramite.id)
        .with_entities(Turno.tramite_id, Tramite.nombre, func.count(Turno.id).label("total"))
        .group_by(Turno.tramite_id, Tramite.nombre)
        .order_by(func.count(Turno.id).desc())
        .all()
    )
    return (
        jsonify(
            {
                "tramites": [
                    {"tramite_id": f.tramite_id, "nombre": f.nombre, "total_turnos": f.total}
                    for f in filas
                ]
            }
        ),
        200,
    )


@admin_agentes_bp.get("/en-vivo")
@requiere_rol("ADMIN", "SUPERVISOR")
def en_vivo():
    """Estado actual de cada sede activa y las últimas reservas que llegaron."""
    ahora = ahora_local()
    sedes = Punto.query.filter_by(activo=True).order_by(Punto.nombre).all()
    resultado = []
    for sede in sedes:
        proyeccion = proyectar_cola(sede.id, ahora)
        hoy = [p for p in proyeccion if p["turno"].franja.fecha == ahora.date()]
        # Próxima franja de hoy con personas esperando (para que se vea que
        # los turnos sí llegaron aunque la franja en curso esté vacía).
        proxima = None
        if hoy:
            primero = hoy[0]["turno"].franja
            proxima = {
                "hora": f"{primero.hora_inicio:%H:%M}",
                "cantidad": sum(
                    1 for p in hoy if p["turno"].franja.hora_inicio == primero.hora_inicio
                ),
            }
        asesores = Usuario.query.filter_by(
            rol="AGENTE", activo=True, punto_asignado_id=sede.id
        ).all()
        resultado.append(
            {
                "punto_id": sede.id,
                "nombre": sede.nombre,
                "franja_actual": estado_franja_actual(sede.id, ahora),
                "proxima": proxima,
                "en_espera_hoy": len(hoy),
                "en_riesgo": sum(1 for p in hoy if p["puntualidad"] in ("en_riesgo", "atrasado")),
                "asesores": [
                    {
                        "nombre": a.nombre,
                        "turno": t.codigo if t else None,
                        "estado": t.estado if t else "LIBRE",
                    }
                    for a in asesores
                    for t in [
                        Turno.query.filter(
                            Turno.agente_id == a.id, Turno.estado.in_(("LLAMADO", "EN_ATENCION"))
                        ).first()
                    ]
                ],
            }
        )

    recientes = Turno.query.order_by(Turno.hora_solicitud.desc(), Turno.id.desc()).limit(8).all()
    return (
        jsonify(
            {
                "ahora": ahora.isoformat(timespec="seconds"),
                "sedes": resultado,
                "recientes": [
                    {
                        "id": t.id,
                        "codigo": t.codigo,
                        "sede": t.punto.nombre if t.punto else None,
                        "tramite": t.tramite.nombre if t.tramite else None,
                        "fecha": t.franja.fecha.isoformat(),
                        "hora": f"{t.franja.hora_inicio:%H:%M}",
                        "estado": t.estado,
                        "reservado": a_iso_utc(t.hora_solicitud),
                    }
                    for t in recientes
                ],
            }
        ),
        200,
    )
