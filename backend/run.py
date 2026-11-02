"""Punto de entrada del backend en localhost.

    python run.py   ->  http://127.0.0.1:5000
"""

import os

from app import crear_app

app = crear_app()

if __name__ == "__main__":
    # debug solo si FLASK_DEBUG=true en el .env
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=app.config.get("DEBUG", False),
    )
