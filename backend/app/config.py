import os

from dotenv import load_dotenv

load_dotenv()


def _bool(nombre, defecto=False):
    valor = os.getenv(nombre)
    if valor is None:
        return defecto
    return valor.strip().lower() in ("1", "true", "si", "sí", "yes", "on")


def _int(nombre, defecto):
    try:
        return int(os.getenv(nombre, defecto))
    except (TypeError, ValueError):
        return defecto


def _url_base_de_datos():
    """DATABASE_URL opcional (por ejemplo SQLite para mostrar pantallas sin MySQL).
    Si es MySQL se adapta al conector PyMySQL y se fuerza utf8mb4."""
    url = os.getenv("DATABASE_URL")
    if not url:
        return None
    if url.startswith("mysql://"):
        url = "mysql+pymysql://" + url[len("mysql://") :]
    if url.startswith("mysql") and "charset=" not in url:
        url += ("&" if "?" in url else "?") + "charset=utf8mb4"
    return url


def _opciones_motor():
    """pool_pre_ping/recycle: evita usar conexiones que MySQL cerró por inactividad."""
    return {"pool_pre_ping": True, "pool_recycle": 280}


_URL_BD = _url_base_de_datos()


class Config:
    # ------------------------------------------------------------------
    # Entorno
    # ------------------------------------------------------------------
    # FilaCero se ejecuta solo en localhost (ADR-012).
    DEBUG = _bool("FLASK_DEBUG", True)

    # ------------------------------------------------------------------
    # Secretos (genera los tuyos con scripts/generate_secret.py)
    # ------------------------------------------------------------------
    SECRET_KEY = os.getenv("SECRET_KEY") or "solo-desarrollo-cambiar-secret-key-filacero"
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or "solo-desarrollo-cambiar-jwt-key-filacero"
    JWT_ACCESS_TOKEN_EXPIRES = _int("JWT_EXP_MINUTES", 60) * 60

    # ------------------------------------------------------------------
    # CORS: lista separada por comas
    # ------------------------------------------------------------------
    CORS_ALLOWED_ORIGINS = [
        origen.strip()
        for origen in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5500,http://127.0.0.1:5500",
        ).split(",")
        if origen.strip()
    ]

    # ------------------------------------------------------------------
    # Base de datos
    # DATABASE_URL tiene prioridad (útil para SQLite en demos/pruebas).
    # ------------------------------------------------------------------
    DB_USER = os.getenv("DB_USER", "filacero_user")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3307")
    DB_NAME = os.getenv("DB_NAME", "filacero_db")
    DB_CHARSET = os.getenv("DB_CHARSET", "utf8mb4")
    DEFAULT_ORGANIZATION_SLUG = os.getenv("DEFAULT_ORGANIZATION_SLUG", "filacero-demo").strip().lower()

    SQLALCHEMY_DATABASE_URI = _URL_BD or (
        f"mysql+pymysql://"
        f"{DB_USER}:{DB_PASSWORD}@"
        f"{DB_HOST}:{DB_PORT}/"
        f"{DB_NAME}?charset={DB_CHARSET}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = _opciones_motor()

    # Limita el tamaño de los cuerpos JSON (protección básica DoS).
    MAX_CONTENT_LENGTH = 64 * 1024

    # ------------------------------------------------------------------
    # Horario de atención (todos los días por defecto, 24 horas)
    # DIAS_ATENCION: 0=lunes ... 6=domingo
    # ------------------------------------------------------------------
    ZONA_HORARIA = os.getenv("ZONA_HORARIA", "America/Bogota")
    HORA_APERTURA = _int("HORA_APERTURA", 0)
    HORA_CIERRE = _int("HORA_CIERRE", 24)
    DIAS_ATENCION = [
        int(d)
        for d in os.getenv("DIAS_ATENCION", "0,1,2,3,4,5,6").split(",")
        if d.strip().isdigit()
    ]
    DURACION_FRANJA_MIN = _int("DURACION_FRANJA_MIN", 30)
    # Regla de negocio: cada atención dura máximo 10 min, así un asesor
    # cubre 3 personas por franja de 30 min. El cupo es POR SEDE y franja
    # (suma de todos los trámites) x número de asesores activos.
    DURACION_MAX_ATENCION_MIN = _int("DURACION_MAX_ATENCION_MIN", 10)
    CUPOS_POR_ASESOR_FRANJA = _int("CUPOS_POR_ASESOR_FRANJA", 0)  # 0 = calcular
    # Pausa activa sugerida al asesor cuando va adelantado (segundos).
    PAUSA_ACTIVA_SEG = _int("PAUSA_ACTIVA_SEG", 90)
    DIAS_MAX_RESERVA = _int("DIAS_MAX_RESERVA", 30)
    # Genera franjas automáticamente cuando una sede/trámite/fecha no tiene.
    FRANJAS_AUTOMATICAS = _bool("FRANJAS_AUTOMATICAS", True)
    # Si es True, el agente solo puede llamar turnos dentro del horario.
    # Ponlo en false para hacer pruebas de noche.
    RESTRINGIR_ATENCION_HORARIO = _bool("RESTRINGIR_ATENCION_HORARIO", True)
    # True: el asesor solo ve y llama turnos de HOY (operación real).
    # False: también ve los próximos días (útil para pruebas).
    COLA_SOLO_HOY = _bool("COLA_SOLO_HOY", False)
    # Pantalla de sala: nombre completo de la persona llamada (decisión de
    # usabilidad, ver ADR-008). false = solo nombre e inicial del apellido.
    # El celular nunca se muestra en la sala.
    SALA_NOMBRE_COMPLETO = _bool("SALA_NOMBRE_COMPLETO", True)

    # ------------------------------------------------------------------
    # Verificación por celular
    # En modo prueba (localhost) el código se devuelve en la respuesta para la demo.
    # ------------------------------------------------------------------
    OTP_TEST_MODE = _bool("FILACERO_OTP_TEST_MODE", True)
    OTP_VIGENCIA_SEG = _int("OTP_VIGENCIA_SEG", 300)
    OTP_MAX_INTENTOS = _int("OTP_MAX_INTENTOS", 5)

    # Bloqueo de cuenta tras intentos fallidos
    MAX_INTENTOS_LOGIN = _int("MAX_INTENTOS_LOGIN", 5)
    MINUTOS_BLOQUEO = _int("MINUTOS_BLOQUEO", 15)

    # Registro público de cuentas con contraseña (los clientes no lo necesitan:
    # reservan con su celular).
    REGISTRO_PUBLICO = _bool("REGISTRO_PUBLICO", True)

    # Cuentas protegidas (correos separados por coma): no se pueden desactivar
    # ni cambiar de rol o correo desde el panel, y la simulación las conserva
    # al borrar y recargar los datos. Sus contraseñas viven solo en la BD (hash).
    CUENTAS_PROTEGIDAS = [
        c.strip().lower() for c in os.getenv("CUENTAS_PROTEGIDAS", "").split(",") if c.strip()
    ]

    # Límites de peticiones (por IP)
    LIMITE_LOGIN_POR_MINUTO = _int("LIMITE_LOGIN_POR_MINUTO", 10)
    LIMITE_OTP_POR_MINUTO = _int("LIMITE_OTP_POR_MINUTO", 5)
    LIMITE_PUBLICO_POR_MINUTO = _int("LIMITE_PUBLICO_POR_MINUTO", 60)
    RATE_LIMIT_ACTIVO = _bool("RATE_LIMIT_ACTIVO", True)
    LIMITE_ASISTENTE_POR_MINUTO = _int("LIMITE_ASISTENTE_POR_MINUTO", 30)

    # ------------------------------------------------------------------
    # Asistente FilaCero IA
    # Sin ANTHROPIC_API_KEY responde el motor local (gratis y sin internet).
    # Con clave, Claude redacta las respuestas a partir de los mismos datos.
    # IA_PROVEEDOR=local fuerza el motor local aunque haya clave.
    # ------------------------------------------------------------------
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
    IA_PROVEEDOR = os.getenv("IA_PROVEEDOR", "auto").strip().lower()
    IA_MODELO = os.getenv("IA_MODELO", "claude-haiku-5-5").strip()
    IA_TIMEOUT_SEG = _int("IA_TIMEOUT_SEG", 12)


def validar_configuracion(app):
    """Avisa al arrancar si las claves locales son demasiado cortas."""
    if len(app.config.get("JWT_SECRET_KEY") or "") < 32:
        import logging

        logging.getLogger("filacero").warning(
            "JWT_SECRET_KEY tiene menos de 32 caracteres. Genera una con: "
            'python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
