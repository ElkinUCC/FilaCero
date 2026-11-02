"""
Genera claves seguras para el archivo .env.

    python scripts/generate_secret.py

Copia las dos líneas en tu .env. NUNCA compartas estas claves ni las subas a Git.
"""

import secrets

print("\n" + "=" * 64)
print("Copia estas líneas en tu archivo .env:")
print("=" * 64)
print(f"SECRET_KEY={secrets.token_urlsafe(48)}")
print(f"JWT_SECRET_KEY={secrets.token_urlsafe(48)}")
print("=" * 64 + "\n")
