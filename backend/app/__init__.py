"""App factory de FilaCero.

Igual que el proyecto de referencia: crea la app, inicializa extensiones,
registra un blueprint por dominio y los manejadores globales de error.

    app/
      __init__.py      <- este archivo (crear_app / create_app)
      config.py        <- configuración leída del .env
      errores.py       <- excepciones de dominio + formato de error
      seguridad.py     <- JWT, roles, contraseñas, límites por IP
      horario.py       <- reglas de horario y cupo por sede
      dominios/<dominio>/{controladores,servicios,repositorios,modelos,dtos}.py
"""

import logging
import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()

log = logging.getLogger("filacero")

# Versión de la API (todas las rutas viven bajo /api/v1)
API_VERSION = "v1"


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    if test_config:
        app.config.update(test_config)

    # Consistencia de cupos (ADR-004): en MySQL/InnoDB el aislamiento por
    # defecto (REPEATABLE READ) fija la "foto" de los datos en la primera
    # lectura de la transacción, antes de tomar el bloqueo de la sede, y el
    # conteo de cupos puede quedar desactualizado bajo concurrencia. Con
    # READ COMMITTED cada consulta ve lo ya confirmado por quien liberó el
    # bloqueo. SQLite (pruebas) no admite este nivel y se omite.
    opciones_motor = dict(app.config.get("SQLALCHEMY_ENGINE_OPTIONS") or {})
    if str(app.config.get("SQLALCHEMY_DATABASE_URI", "")).startswith("mysql"):
        opciones_motor.setdefault("isolation_level", "READ COMMITTED")
    else:
        opciones_motor.pop("isolation_level", None)
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = opciones_motor

    from app.config import validar_configuracion

    validar_configuracion(app)

    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # El aislamiento se aplica en el ORM, no depende de que cada controlador
    # recuerde agregar manualmente el filtro por organización.
    from app.tenancy import instalar_aislamiento_multiempresa, resolver_organizacion_peticion

    instalar_aislamiento_multiempresa()
    resolver_organizacion_peticion(app)

    # CORS restringido a los orígenes configurados y solo a la API.
    CORS(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ALLOWED_ORIGINS"]}},
        allow_headers=["Content-Type", "Authorization", "X-Organization-Slug"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        max_age=600,
    )

    # Modelos: registrar todos antes de usar migraciones.
    from app.dominios.agentes.controladores import admin_agentes_bp, agentes_bp
    from app.dominios.asistente.controladores import asistente_bp
    from app.dominios.auditoria.modelos import Auditoria  # noqa: F401
    from app.dominios.equipos.controladores import equipos_bp
    from app.dominios.equipos.modelos import Equipo  # noqa: F401
    from app.dominios.franjas.admin_controladores import admin_franjas_bp
    from app.dominios.franjas.controladores import franjas_bp
    from app.dominios.franjas.disponibilidad import disponibilidad_bp
    from app.dominios.franjas.modelos import Franja  # noqa: F401
    from app.dominios.organizaciones.controladores import organizaciones_bp
    from app.dominios.organizaciones.modelos import Organizacion  # noqa: F401
    from app.dominios.reclamos.controladores import reclamos_bp
    from app.dominios.reclamos.modelos import Reclamo  # noqa: F401
    from app.dominios.sedes.controladores import puntos_bp
    from app.dominios.sedes.modelos import Punto  # noqa: F401
    from app.dominios.tramites.controladores import tramites_bp
    from app.dominios.tramites.modelos import Tramite  # noqa: F401
    from app.dominios.turnos.controladores import turnos_bp
    from app.dominios.turnos.modelos import Turno  # noqa: F401
    from app.dominios.usuarios.admin_controladores import admin_usuarios_bp
    from app.dominios.usuarios.controladores import usuarios_bp
    from app.dominios.usuarios.modelos import Usuario  # noqa: F401

    app.register_blueprint(usuarios_bp, url_prefix="/api/v1/usuarios")
    app.register_blueprint(puntos_bp, url_prefix="/api/v1/sedes")
    app.register_blueprint(tramites_bp, url_prefix="/api/v1/tramites")
    app.register_blueprint(franjas_bp, url_prefix="/api/v1/franjas")
    app.register_blueprint(admin_franjas_bp, url_prefix="/api/v1/admin/franjas")
    app.register_blueprint(turnos_bp, url_prefix="/api/v1/turnos")
    app.register_blueprint(agentes_bp, url_prefix="/api/v1/agente")
    app.register_blueprint(admin_agentes_bp, url_prefix="/api/v1/admin/agentes")
    app.register_blueprint(disponibilidad_bp, url_prefix="/api/v1/franjas")
    app.register_blueprint(admin_usuarios_bp, url_prefix="/api/v1/admin/usuarios")
    app.register_blueprint(organizaciones_bp, url_prefix="/api/v1/organizacion")
    app.register_blueprint(equipos_bp, url_prefix="/api/v1/equipos")
    app.register_blueprint(reclamos_bp, url_prefix="/api/v1/reclamos")
    app.register_blueprint(asistente_bp, url_prefix="/api/v1/asistente")

    _registrar_manejadores(app)

    from app.errores import registrar_manejadores_de_dominio

    registrar_manejadores_de_dominio(app)

    @app.after_request
    def marcar_exito(respuesta):
        """Contrato uniforme: todo JSON lleva "success" (true si el código < 400)."""
        if respuesta.is_json and not respuesta.direct_passthrough:
            datos = respuesta.get_json(silent=True)
            if isinstance(datos, dict) and "success" not in datos:
                datos = {"success": respuesta.status_code < 400, **datos}
                respuesta.set_data(app.json.dumps(datos))
        return respuesta

    @app.after_request
    def cabeceras_seguridad(respuesta):
        respuesta.headers.setdefault("X-Content-Type-Options", "nosniff")
        respuesta.headers.setdefault("X-Frame-Options", "DENY")
        respuesta.headers.setdefault("Referrer-Policy", "no-referrer")
        respuesta.headers.setdefault("Cache-Control", "no-store")
        respuesta.headers.setdefault(
            "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
        )
        return respuesta

    @app.get("/")
    def inicio():
        return {"proyecto": "FilaCero", "mensaje": "API funcionando"}

    @app.get("/health")
    def health():
        """Vivo: el proceso responde (para el orquestador)."""
        return {"status": "ok", "service": "filacero-api", "version": "v1"}

    @app.get("/health/listo")
    def health_listo():
        """Listo: además la base de datos responde."""
        from sqlalchemy import text

        try:
            db.session.execute(text("SELECT 1"))
            return {"status": "ok", "base_de_datos": "ok"}
        except Exception:
            db.session.rollback()
            log.exception("La base de datos no responde")
            return jsonify({"status": "degradado", "base_de_datos": "sin conexión"}), 503

    @app.get("/api/v1/horario")
    def horario():
        from app.horario import info_horario

        return info_horario()

    return app


def _registrar_manejadores(app):
    @app.errorhandler(ValidationError)
    def error_validacion(error):
        return jsonify({"error": "Datos inválidos.", "detalles": error.messages}), 400

    @app.errorhandler(HTTPException)
    def error_http(error):
        mensajes = {
            400: "Solicitud inválida.",
            401: "Debes iniciar sesión.",
            403: "No tienes permisos para esta acción.",
            404: "Recurso no encontrado.",
            405: "Método no permitido.",
            413: "La solicitud es demasiado grande.",
            429: "Demasiadas solicitudes.",
        }
        return jsonify({"error": mensajes.get(error.code, error.name)}), error.code

    @app.errorhandler(Exception)
    def error_interno(error):
        db.session.rollback()
        log.exception("Error no controlado: %s", error)
        if app.config.get("TESTING"):
            raise error
        return jsonify({"error": "Ocurrió un error interno. Intenta de nuevo."}), 500

    # Respuestas JWT uniformes y en español.
    @jwt.unauthorized_loader
    def sin_token(_motivo):
        return jsonify({"error": "Debes iniciar sesión."}), 401

    @jwt.invalid_token_loader
    def token_invalido(_motivo):
        return jsonify({"error": "Sesión inválida. Inicia sesión de nuevo."}), 401

    @jwt.expired_token_loader
    def token_expirado(_header, _payload):
        return jsonify({"error": "Tu sesión expiró. Inicia sesión de nuevo."}), 401

    @jwt.user_lookup_loader
    def cargar_usuario(_header, payload):
        from app.dominios.usuarios.modelos import Usuario

        try:
            usuario = db.session.get(Usuario, int(payload["sub"]))
        except (KeyError, TypeError, ValueError):
            return None
        # Token emitido antes de un cambio de credenciales / rol / logout.
        # Los JWT heredados pueden no incluir org_id. En ese caso, la
        # organización se deriva del usuario en resolver_organizacion_peticion;
        # si el claim sí existe, debe coincidir exactamente con la BD.
        if usuario and "org_id" in payload:
            try:
                if int(payload["org_id"]) != int(usuario.organizacion_id):
                    return None
            except (TypeError, ValueError):
                return None
        if usuario and not usuario.token_vigente(payload):
            return None
        return usuario

    @jwt.token_verification_loader
    def token_vigente(_header, payload):
        from app.dominios.usuarios.modelos import Usuario

        try:
            usuario = db.session.get(Usuario, int(payload["sub"]))
        except (KeyError, TypeError, ValueError):
            return False
        if usuario is None or not usuario.activo:
            return False
        # Compatibilidad con tokens anteriores a multiempresa: la ausencia
        # del claim no autoriza elegir un tenant; el middleware lo resuelve
        # desde la cuenta autenticada. Un claim presente y falso sí se rechaza.
        if "org_id" in payload:
            try:
                if int(payload["org_id"]) != int(usuario.organizacion_id):
                    return False
            except (TypeError, ValueError):
                return False
        return usuario.token_vigente(payload)

    @jwt.token_verification_failed_loader
    def token_revocado(_header, _payload):
        return jsonify({"error": "Tu sesión ya no es válida. Inicia sesión de nuevo."}), 401

    @jwt.user_lookup_error_loader
    def usuario_no_encontrado(_header, _payload):
        return jsonify({"error": "Sesión inválida. Inicia sesión de nuevo."}), 401


# Nombre en español, igual que en el proyecto de referencia (run.py lo usa).
crear_app = create_app
