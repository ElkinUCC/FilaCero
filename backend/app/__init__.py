from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_object("app.config.Config")

    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    CORS(app)

    from app.dominios.usuarios.modelos import Usuario
    from app.dominios.sedes.modelos import Punto
    from app.dominios.tramites.modelos import Tramite
    from app.dominios.franjas.modelos import Franja
    from app.dominios.turnos.modelos import Turno

    from app.dominios.usuarios.controladores import usuarios_bp
    from app.dominios.sedes.controladores import puntos_bp
    from app.dominios.tramites.controladores import tramites_bp
    from app.dominios.franjas.controladores import franjas_bp
    from app.dominios.turnos.controladores import turnos_bp

    app.register_blueprint(usuarios_bp, url_prefix="/api/v1/usuarios")
    app.register_blueprint(puntos_bp, url_prefix="/api/v1/sedes")
    app.register_blueprint(tramites_bp, url_prefix="/api/v1/tramites")
    app.register_blueprint(franjas_bp, url_prefix="/api/v1/franjas")
    app.register_blueprint(turnos_bp, url_prefix="/api/v1/turnos")

    @app.get("/")
    def inicio():
        return {"proyecto": "FilaCero", "mensaje": "API funcionando"}

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "service": "filacero-api",
            "version": "v1"
        }

    return app
