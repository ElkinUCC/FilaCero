# API de FilaCero (Flask + waitress), imagen liviana y sin privilegios.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FLASK_ENV=production

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN useradd --create-home --uid 10001 filacero && chown -R filacero /app
USER filacero

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health', timeout=4)"

# Aplica migraciones pendientes y arranca el servidor de producción.
CMD ["sh", "-c", "flask --app wsgi db upgrade && waitress-serve --host 0.0.0.0 --port 5000 --threads 8 wsgi:app"]
