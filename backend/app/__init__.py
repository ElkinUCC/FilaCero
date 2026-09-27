from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)

    app.config.from_object("app.config.Config")

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    CORS(app)

    from app.dominios.usuarios.controladores import usuarios_bp

    app.register_blueprint(usuarios_bp, url_prefix="/api/v1/usuarios")

    @app.get("/")
    def inicio():
        return {"proyecto": "FilaCero", "mensaje": "API funcionando"}

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "filacero-api", "version": "v1"}

    return app
