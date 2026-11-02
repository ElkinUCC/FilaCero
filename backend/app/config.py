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


class Config:
    # ------------------------------------------------------------------
    # Entorno
    # ------------------------------------------------------------------
    # FLASK_ENV=production activa validaciones estrictas de seguridad.
    ENTORNO = os.getenv("FLASK_ENV", "development").lower()
    PRODUCCION = ENTORNO == "production"
    DEBUG = _bool("FLASK_DEBUG", not PRODUCCION)

    # ------------------------------------------------------------------
    # Secretos (en producción son obligatorios y deben ser largos)
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
            "http://localhost:5173,http://127.0.0.1:5173",
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

    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or (
        f"mysql+pymysql://"
        f"{DB_USER}:{DB_PASSWORD}@"
        f"{DB_HOST}:{DB_PORT}/"
        f"{DB_NAME}?charset={DB_CHARSET}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # Limita el tamaño de los cuerpos JSON (protección básica DoS).
    MAX_CONTENT_LENGTH = 64 * 1024

    # ------------------------------------------------------------------
    # Horario de atención (todos los días por defecto, 08:00 a 18:00)
    # DIAS_ATENCION: 0=lunes ... 6=domingo
    # ------------------------------------------------------------------
    ZONA_HORARIA = os.getenv("ZONA_HORARIA", "America/Bogota")
    HORA_APERTURA = _int("HORA_APERTURA", 8)
    HORA_CIERRE = _int("HORA_CIERRE", 18)
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

    # ------------------------------------------------------------------
    # Verificación por celular
    # En modo prueba el código se devuelve en la respuesta (NO producción).
    # ------------------------------------------------------------------
    OTP_TEST_MODE = _bool("FILACERO_OTP_TEST_MODE", not PRODUCCION)
    OTP_VIGENCIA_SEG = _int("OTP_VIGENCIA_SEG", 300)
    OTP_MAX_INTENTOS = _int("OTP_MAX_INTENTOS", 5)

    # Bloqueo de cuenta tras intentos fallidos
    MAX_INTENTOS_LOGIN = _int("MAX_INTENTOS_LOGIN", 5)
    MINUTOS_BLOQUEO = _int("MINUTOS_BLOQUEO", 15)

    # Registro público de cuentas con contraseña (los clientes no lo necesitan:
    # reservan con su celular). Desactivado por defecto en producción.
    REGISTRO_PUBLICO = _bool("REGISTRO_PUBLICO", not PRODUCCION)

    # Número de proxies de confianza delante de Flask (nginx = 1). Necesario
    # para que el límite por IP use la IP real del cliente.
    PROXIES_CONFIABLES = _int("PROXIES_CONFIABLES", 0)

    # Límites de peticiones (por IP)
    LIMITE_LOGIN_POR_MINUTO = _int("LIMITE_LOGIN_POR_MINUTO", 10)
    LIMITE_OTP_POR_MINUTO = _int("LIMITE_OTP_POR_MINUTO", 5)
    LIMITE_PUBLICO_POR_MINUTO = _int("LIMITE_PUBLICO_POR_MINUTO", 60)
    RATE_LIMIT_ACTIVO = _bool("RATE_LIMIT_ACTIVO", True)


def validar_configuracion(app):
    """Detiene el arranque en producción si la configuración es insegura."""
    if not app.config.get("PRODUCCION"):
        if len(app.config.get("JWT_SECRET_KEY") or "") < 32:
            import logging

            logging.getLogger("filacero").warning(
                "JWT_SECRET_KEY tiene menos de 32 caracteres. Genera una con: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return

    problemas = []
    for clave in ("SECRET_KEY", "JWT_SECRET_KEY"):
        valor = app.config.get(clave) or ""
        if len(valor) < 32 or valor.startswith("solo-desarrollo"):
            problemas.append(f"{clave} debe tener al menos 32 caracteres aleatorios.")

    if app.config.get("OTP_TEST_MODE"):
        problemas.append("FILACERO_OTP_TEST_MODE no puede estar activo en producción.")

    if app.config.get("DEBUG"):
        problemas.append("FLASK_DEBUG debe estar desactivado en producción.")

    if "*" in app.config.get("CORS_ALLOWED_ORIGINS", []):
        problemas.append("CORS_ALLOWED_ORIGINS no puede ser '*' en producción.")

    if problemas:
        raise RuntimeError("Configuración insegura para producción:\n- " + "\n- ".join(problemas))
