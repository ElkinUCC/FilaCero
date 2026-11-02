"""
Cambia el rol de una cuenta del personal (por defecto a ADMIN).

    python scripts/promover_admin.py correo@filacero.co
    python scripts/promover_admin.py correo@filacero.co SUPERVISOR

Útil si se pierde el acceso de administrador. Revoca las sesiones abiertas de
esa cuenta (debe volver a iniciar sesión) y deja el evento en la bitácora.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import crear_app, db  # noqa: E402
from app.dominios.auditoria.servicios import registrar  # noqa: E402
from app.dominios.usuarios.repositorios import buscar_por_correo  # noqa: E402

ROLES = ("ADMIN", "SUPERVISOR", "AGENTE")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    correo = sys.argv[1].strip().lower()
    rol = (sys.argv[2] if len(sys.argv) > 2 else "ADMIN").strip().upper()
    if rol not in ROLES:
        print(f"Rol no válido. Usa uno de: {', '.join(ROLES)}", file=sys.stderr)
        sys.exit(1)

    app = crear_app()
    with app.app_context():
        usuario = buscar_por_correo(correo)
        if not usuario or usuario.rol == "CLIENTE":
            print(f"No existe una cuenta del personal con el correo {correo}.", file=sys.stderr)
            sys.exit(1)
        anterior = usuario.rol
        usuario.rol = rol
        usuario.activo = True
        usuario.bloqueado_hasta = None
        usuario.intentos_fallidos = 0
        usuario.revocar_sesiones()
        db.session.commit()
        registrar("usuario_editado", f"{correo}: {anterior} -> {rol} (script)", usuario_id=None)
        print(f"Listo: {usuario.nombre} <{correo}> ahora es {rol}.")


if __name__ == "__main__":
    main()
