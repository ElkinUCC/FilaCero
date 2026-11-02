"""Punto de entrada en desarrollo (igual que el proyecto de referencia).

    python app.py              -> http://127.0.0.1:5000
    flask --app app db upgrade -> aplica migraciones

En producción se usa wsgi.py con waitress (ver ADR-0006).
"""

import os

from app import crear_app

# Creamos la aplicación
app = crear_app()

if __name__ == "__main__":
    # debug solo si FLASK_DEBUG=true en el .env (nunca en producción)
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=app.config.get("DEBUG", False),
    )
