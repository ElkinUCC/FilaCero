# API de FilaCero (Flask) servida con waitress.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY wsgi.py run.py simulacion.py ./

# Usuario sin privilegios
RUN useradd --create-home --uid 10001 filacero
USER filacero

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health/listo')"

# Aplica migraciones y arranca el servidor de producción.
CMD ["sh", "-c", "flask --app wsgi db upgrade -d migrations && waitress-serve --host=0.0.0.0 --port=5000 --threads=8 wsgi:app"]
