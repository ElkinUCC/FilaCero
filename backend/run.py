"""Punto de entrada del backend en localhost."""

import os

from app import crear_app

app = crear_app()

if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    # El depurador de Werkzeug ejecuta código arbitrario: solo se permite en loopback.
    debug = app.config.get("DEBUG", False) and host in ("127.0.0.1", "localhost", "::1")
    if app.config.get("DEBUG") and not debug:
        print("Aviso: FLASK_DEBUG ignorado porque FLASK_HOST no es localhost.")
    app.run(host=host, port=int(os.getenv("FLASK_PORT", "5000")), debug=debug)


