"""Punto de entrada de producción (WSGI).

    waitress-serve --host 0.0.0.0 --port 5000 --threads 8 wsgi:app

Con FLASK_ENV=production la app valida secretos, OTP de prueba y CORS
antes de arrancar (app/config.py: validar_configuracion).
"""

from app import crear_app

app = crear_app()
