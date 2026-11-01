"""Punto de entrada de producción (no usar `flask run` ni run.py en producción).

    waitress-serve --host 0.0.0.0 --port 5000 --threads 8 wsgi:app

Waitress funciona igual en Windows y Linux (ver ADR-0006).
"""
from app import create_app

app = create_app()
