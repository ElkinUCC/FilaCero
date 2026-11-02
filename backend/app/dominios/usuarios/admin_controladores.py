"""Administración de cuentas del personal: credenciales, roles y bitácora.

Roles:
  ADMIN       acceso total.
  SUPERVISOR  solo lectura del panel (resumen, historial, sedes, asesores).
  AGENTE      consola de atención en su sede.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from app import db
from app.dominios.auditoria.modelos import Auditoria
from app.dominios.auditoria.servicios import ACCIONES, evento_response, registrar
from app.dominios.sedes.modelos import Punto
from app.seguridad import encriptar_password, requiere_rol, validar_password_segura

from .dtos import usuario_response
from .modelos import Usuario
from .repositorios import buscar_por_correo
from .servicios import generar_clave_temporal

admin_usuarios_bp = Blueprint("admin_usuarios", __name__)

ROLES = {"ADMIN": "Administrador", "SUPERVISOR": "Supervisor", "AGENTE": "Asesor"}


def _admins_activos(excluir_id=None):
    consulta = Usuario.query.filter_by(rol="ADMIN", activo=True)
    if excluir_id:
        consulta = consulta.filter(Usuario.id != excluir_id)
    return consulta.count()


def _nombre(valor):
    nombre = " ".join(str(valor or "").split())
    if not 3 <= len(nombre) <= 100:
        raise ValueError("El nombre debe tener entre 3 y 100 caracteres.")
    return nombre


def _correo(valor, excluir_id=None):
    correo = str(valor or "").strip().lower()
    if "@" not in correo or "." not in correo.split("@")[-1] or len(correo) > 120:
        raise ValueError("Ingresa un correo válido.")
    if correo.endswith("@publico.filacero.local"):
        raise ValueError("Ese dominio está reservado.")
    existente = buscar_por_correo(correo)
    if existente and existente.id != excluir_id:
        raise ValueError("Ya existe una cuenta con ese correo.")
    return correo


def _rol(valor):
    if valor not in ROLES:
        raise ValueError("Rol no válido.")
    return valor


def _sede(valor):
    if valor in (None, ""):
        return None
    try:
        punto = db.session.get(Punto, int(valor))
    except (TypeError, ValueError):
        raise ValueError("Sede no válida.") from None
    if not punto or not punto.activo:
        raise ValueError("La sede no existe o está inactiva.")
    return punto.id


@admin_usuarios_bp.get("/")
@requiere_rol("ADMIN")
def listar():
    usuarios = (
        Usuario.query.filter(Usuario.rol.in_(tuple(ROLES)))
        .order_by(Usuario.rol.asc(), Usuario.nombre.asc())
        .all()
    )
    return (
        jsonify(
            {
                "usuarios": [usuario_response(u) for u in usuarios],
                "roles": ROLES,
                "yo": current_user.id,
            }
        ),
        200,
    )


@admin_usuarios_bp.post("/")
@requiere_rol("ADMIN")
def crear():
    datos = request.get_json(silent=True) or {}
    try:
        rol = _rol(datos.get("rol"))
        usuario = Usuario(
            nombre=_nombre(datos.get("nombre")),
            correo=_correo(datos.get("correo")),
            rol=rol,
            activo=True,
            punto_asignado_id=_sede(datos.get("punto_id")) if rol == "AGENTE" else None,
        )
        clave = datos.get("password") or None
        temporal = clave is None
        if temporal:
            clave = generar_clave_temporal()
        validar_password_segura(clave)
        usuario.password_hash = encriptar_password(clave)
        usuario.debe_cambiar_clave = temporal
        db.session.add(usuario)
        db.session.commit()
    except ValueError as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400

    registrar("usuario_creado", f"{usuario.correo} como {ROLES[usuario.rol]}")
    respuesta = {"mensaje": "Usuario creado.", "usuario": usuario_response(usuario)}
    if temporal:
        respuesta["clave_temporal"] = clave  # se muestra UNA sola vez
    return jsonify(respuesta), 201


@admin_usuarios_bp.put("/<int:usuario_id>")
@requiere_rol("ADMIN")
def editar(usuario_id):
    usuario = Usuario.query.filter(Usuario.id == usuario_id, Usuario.rol.in_(tuple(ROLES))).first()
    if not usuario:
        return jsonify({"error": "Usuario no encontrado."}), 404

    datos = request.get_json(silent=True) or {}
    es_yo = usuario.id == current_user.id
    if usuario.protegida and (
        ("activo" in datos and not datos["activo"])
        or ("rol" in datos and datos["rol"] != usuario.rol)
        or ("correo" in datos and str(datos["correo"]).strip().lower() != usuario.correo)
    ):
        return (
            jsonify(
                {"error": "Cuenta protegida: no se puede desactivar ni cambiar su rol o correo."}
            ),
            409,
        )
    cambios = []
    eventos = []  # se registran solo si todo el cambio se guarda
    try:
        if "nombre" in datos:
            usuario.nombre = _nombre(datos["nombre"])
        if "correo" in datos:
            nuevo = _correo(datos["correo"], excluir_id=usuario.id)
            if nuevo != usuario.correo:
                cambios.append(f"correo {usuario.correo} → {nuevo}")
                usuario.correo = nuevo
        if "rol" in datos and datos["rol"] != usuario.rol:
            nuevo_rol = _rol(datos["rol"])
            if es_yo:
                raise ValueError("No puedes cambiar tu propio rol.")
            if usuario.rol == "ADMIN" and _admins_activos(excluir_id=usuario.id) == 0:
                raise ValueError("Debe quedar al menos un administrador activo.")
            eventos.append(
                ("rol_cambiado", f"{usuario.correo}: {ROLES[usuario.rol]} → {ROLES[nuevo_rol]}")
            )
            usuario.rol = nuevo_rol
            usuario.revocar_sesiones()
            if nuevo_rol != "AGENTE":
                usuario.punto_asignado_id = None
        if "punto_id" in datos and usuario.rol == "AGENTE":
            usuario.punto_asignado_id = _sede(datos["punto_id"])
        if "activo" in datos and bool(datos["activo"]) != usuario.activo:
            activo = bool(datos["activo"])
            if es_yo and not activo:
                raise ValueError("No puedes desactivar tu propia cuenta.")
            if (
                not activo
                and usuario.rol == "ADMIN"
                and _admins_activos(excluir_id=usuario.id) == 0
            ):
                raise ValueError("Debe quedar al menos un administrador activo.")
            usuario.activo = activo
            if not activo:
                usuario.revocar_sesiones()
            eventos.append(
                ("usuario_activado" if activo else "usuario_desactivado", usuario.correo)
            )
        db.session.commit()
    except ValueError as error:
        db.session.rollback()
        return jsonify({"error": str(error)}), 400

    for accion, detalle in eventos:
        registrar(accion, detalle)
    registrar(
        "usuario_editado", f"{usuario.correo}" + (f" ({'; '.join(cambios)})" if cambios else "")
    )
    return jsonify({"mensaje": "Usuario actualizado.", "usuario": usuario_response(usuario)}), 200


@admin_usuarios_bp.post("/<int:usuario_id>/restablecer-clave")
@requiere_rol("ADMIN")
def restablecer_clave(usuario_id):
    usuario = Usuario.query.filter(Usuario.id == usuario_id, Usuario.rol.in_(tuple(ROLES))).first()
    if not usuario:
        return jsonify({"error": "Usuario no encontrado."}), 404
    if usuario.id == current_user.id:
        return jsonify({"error": "Para tu propia cuenta usa “Cambiar mi contraseña”."}), 400

    clave = generar_clave_temporal()
    usuario.password_hash = encriptar_password(clave)
    usuario.debe_cambiar_clave = True
    usuario.intentos_fallidos = 0
    usuario.bloqueado_hasta = None  # restablecer también desbloquea
    usuario.revocar_sesiones()
    db.session.commit()
    registrar("clave_restablecida", usuario.correo)
    return (
        jsonify(
            {
                "mensaje": "Contraseña restablecida. Deberá cambiarla al ingresar.",
                "clave_temporal": clave,
                "usuario": usuario_response(usuario),
            }
        ),
        200,
    )


@admin_usuarios_bp.get("/auditoria")
@requiere_rol("ADMIN")
def auditoria():
    try:
        pagina = max(1, int(request.args.get("pagina", 1)))
        por_pagina = min(100, max(1, int(request.args.get("por_pagina", 25))))
    except ValueError:
        return jsonify({"error": "Paginación inválida."}), 400

    consulta = Auditoria.query
    accion = request.args.get("accion")
    if accion:
        if accion not in ACCIONES:
            return jsonify({"error": "Acción no válida."}), 400
        consulta = consulta.filter(Auditoria.accion == accion)
    if request.args.get("usuario_id"):
        try:
            consulta = consulta.filter(Auditoria.usuario_id == int(request.args["usuario_id"]))
        except ValueError:
            return jsonify({"error": "usuario_id inválido."}), 400

    total = consulta.count()
    eventos = (
        consulta.order_by(Auditoria.fecha.desc(), Auditoria.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
        .all()
    )
    return (
        jsonify(
            {
                "pagina": pagina,
                "total": total,
                "total_paginas": (total + por_pagina - 1) // por_pagina,
                "acciones": ACCIONES,
                "eventos": [evento_response(e) for e in eventos],
            }
        ),
        200,
    )
