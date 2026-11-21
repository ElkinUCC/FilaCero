"""Genera claves seguras para el archivo .env."""

import secrets

print("\n" + "=" * 64)
print("Copia estas líneas en tu archivo .env:")
print("=" * 64)
print(f"SECRET_KEY={secrets.token_urlsafe(48)}")
print(f"JWT_SECRET_KEY={secrets.token_urlsafe(48)}")
print("=" * 64 + "\n")
