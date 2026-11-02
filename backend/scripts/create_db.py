"""
Crea la base de datos MySQL de FilaCero si no existe.

Lee las credenciales del archivo .env (nunca del código):
    DB_USER, DB_PASSWORD, DB_HOST (localhost), DB_PORT (3307),
    DB_NAME (filacero_db), DB_CHARSET (utf8mb4)

Uso (carpeta backend, venv activo):
    python scripts/create_db.py
    flask db upgrade
"""

import os
import sys

import pymysql
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER", "").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "").strip()
DB_HOST = os.getenv("DB_HOST", "localhost").strip()
DB_PORT = int(os.getenv("DB_PORT", "3307"))
DB_NAME = os.getenv("DB_NAME", "filacero_db").strip()
DB_CHARSET = os.getenv("DB_CHARSET", "utf8mb4").strip()

if not DB_USER or not DB_NAME:
    print("Falta DB_USER o DB_NAME en el archivo .env (copia .env.example).", file=sys.stderr)
    sys.exit(1)

if not DB_NAME.replace("_", "").isalnum() or not DB_CHARSET.isalnum():
    print("DB_NAME y DB_CHARSET solo pueden tener letras, números y guion bajo.", file=sys.stderr)
    sys.exit(1)

print(f'Conectando a MySQL en {DB_HOST}:{DB_PORT} como "{DB_USER}"...')
conexion = None
try:
    conexion = pymysql.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, charset=DB_CHARSET
    )
    with conexion.cursor() as cursor:
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
            f"CHARACTER SET {DB_CHARSET} COLLATE {DB_CHARSET}_unicode_ci;"
        )
    conexion.commit()
    print(f"Base de datos '{DB_NAME}' lista. Siguiente paso: flask db upgrade")
except pymysql.MySQLError as error:
    print(f"No se pudo crear la base de datos: {error}", file=sys.stderr)
    sys.exit(1)
finally:
    if conexion is not None and conexion.open:
        conexion.close()
