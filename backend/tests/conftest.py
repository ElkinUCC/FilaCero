"""
Configuración de pruebas y fixtures compartidos (como el proyecto de referencia).

Cada prueba recibe una app nueva con SQLite en memoria: no toca la base MySQL
del desarrollador ni depende del orden de ejecución. Los archivos de prueba
que definen su propio fixture ``app`` lo sobrescriben localmente.
"""

import os

# Antes de importar la app: que load_dotenv() no cambie el modo de prueba.
os.environ.setdefault("FILACERO_OTP_TEST_MODE", "true")

import pytest  # noqa: E402

from app import crear_app  # noqa: E402
from app import db as _db  # noqa: E402
from app.seguridad import encriptar_password, reiniciar_limites  # noqa: E402

CONFIG_PRUEBAS = {
    "TESTING": True,
    "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
    "JWT_SECRET_KEY": "PRUEBAS-FilaCero-JWT-Clave-Segura-2026",
    "SECRET_KEY": "PRUEBAS-FilaCero-Secret-Key-Segura-2026",
    "RATE_LIMIT_ACTIVO": False,
}

CLAVE_PRUEBA = "Prueba12345"


@pytest.fixture
def app():
    """App Flask en modo prueba con las tablas creadas."""
    reiniciar_limites()
    aplicacion = crear_app(CONFIG_PRUEBAS)
    with aplicacion.app_context():
        _db.create_all()
        yield aplicacion
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    """Cliente HTTP para pruebas."""
    return app.test_client()


@pytest.fixture
def db(app):
    """Sesión de base de datos para pruebas."""
    return _db


@pytest.fixture
def crear_personal(app):
    """Fábrica: crea una cuenta del personal y la devuelve."""
    from app.dominios.usuarios.modelos import Usuario

    contador = {"n": 0}

    def _crear(rol="ADMIN", punto_id=None, clave=CLAVE_PRUEBA):
        contador["n"] += 1
        usuario = Usuario(
            nombre=f"{rol.title()} {contador['n']}",
            correo=f"{rol.lower()}{contador['n']}@prueba.filacero.co",
            password_hash=encriptar_password(clave),
            rol=rol,
            activo=True,
            punto_asignado_id=punto_id,
        )
        _db.session.add(usuario)
        _db.session.commit()
        return usuario

    return _crear


@pytest.fixture
def auth(client):
    """Inicia sesión por la API (como lo hace el frontend) y devuelve las cabeceras."""

    def _auth(usuario, clave=CLAVE_PRUEBA):
        respuesta = client.post(
            "/api/v1/usuarios/login", json={"correo": usuario.correo, "password": clave}
        )
        assert respuesta.status_code == 200, respuesta.get_json()
        return {"Authorization": f"Bearer {respuesta.get_json()['access_token']}"}

    return _auth


@pytest.fixture
def admin_auth(crear_personal, auth):
    """Cabeceras de un administrador con sesión iniciada."""
    return auth(crear_personal("ADMIN"))


@pytest.fixture
def agente_auth(crear_personal, auth):
    """Cabeceras de un asesor con sesión iniciada."""
    return auth(crear_personal("AGENTE"))
