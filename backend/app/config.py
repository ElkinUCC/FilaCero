import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "fila-cero-secret")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "DEV-ONLY-CHANGE-ME-FilaCero-JWT-Key-2026")

    JWT_ACCESS_TOKEN_EXPIRES = int(
        os.getenv("JWT_EXP_MINUTES", "60")
    ) * 60

    DB_USER = os.getenv("DB_USER", "filacero_user")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3307")
    DB_NAME = os.getenv("DB_NAME", "filacero_db")
    DB_CHARSET = os.getenv("DB_CHARSET", "utf8mb4")

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://"
        f"{DB_USER}:{DB_PASSWORD}@"
        f"{DB_HOST}:{DB_PORT}/"
        f"{DB_NAME}?charset={DB_CHARSET}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False