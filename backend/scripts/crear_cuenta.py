"""
Crea (o actualiza) una cuenta del personal. La contraseña se escribe a mano
y NO queda en ningún archivo: solo su hash en la base de datos.

    python scripts/crear_cuenta.py elkinadmin@filacero.com ADMIN "Elkin Administrador"
    python scripts/crear_cuenta.py elkinagente@filacero.com AGENTE "Elkin Asesor" "Sede Centro"
    python scripts/crear_cuenta.py admin@cooperativa.com ADMIN "Admin Cooperativa" --organizacion-id 2

Para que la cuenta no se pueda desactivar desde el panel y sobreviva a
`python simulacion.py --cargar`, agrégala en tu .env:

    CUENTAS_PROTEGIDAS=elkinadmin@filacero.com,elkinagente@filacero.com
"""

import argparse
import getpass
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import crear_app, db  # noqa: E402
from app.dominios.auditoria.servicios import registrar  # noqa: E402
from app.dominios.organizaciones.modelos import Organizacion  # noqa: E402
from app.dominios.sedes.modelos import Punto  # noqa: E402
from app.dominios.usuarios.modelos import Usuario  # noqa: E402
from app.seguridad import encriptar_password, validar_password_segura  # noqa: E402
from app.tenancy import contexto_organizacion  # noqa: E402

ROLES = ("ADMIN", "SUPERVISOR", "AGENTE")


def pedir_clave():
    while True:
        clave = getpass.getpass("Contraseña (no se ve al escribir): ")
        try:
            validar_password_segura(clave)
        except ValueError as error:
            print(f"  {error}")
            continue
        if getpass.getpass("Repítela: ") != clave:
            print("  No coinciden, intenta de nuevo.")
            continue
        return clave


def main():
    parser = argparse.ArgumentParser(description="Crear o actualizar una cuenta de personal FilaCero")
    parser.add_argument("correo")
    parser.add_argument("rol", choices=ROLES)
    parser.add_argument("nombre")
    parser.add_argument("sede", nargs="?", help="Nombre de sede (solo para AGENTE)")
    parser.add_argument("--organizacion-id", type=int, default=1)
    args = parser.parse_args()

    correo = args.correo.strip().lower()
    rol = args.rol.strip().upper()
    nombre = " ".join(args.nombre.split())

    app = crear_app()
    with app.app_context():
        organizacion = db.session.get(Organizacion, args.organizacion_id)
        if not organizacion or not organizacion.activa:
            print("La organización indicada no existe o está inactiva.")
            sys.exit(1)

        with contexto_organizacion(organizacion.id):
            sede = None
            if rol == "AGENTE":
                consulta = Punto.query.filter_by(activo=True)
                sede = (
                    consulta.filter_by(nombre=args.sede).first()
                    if args.sede
                    else consulta.order_by(Punto.id).first()
                )
                if not sede:
                    disponibles = ", ".join(p.nombre for p in Punto.query.filter_by(activo=True))
                    print(f"No encontré esa sede. Sedes activas: {disponibles or 'ninguna'}")
                    sys.exit(1)

            clave = pedir_clave()
            usuario = Usuario.query.filter_by(correo=correo).first()
            nuevo = usuario is None
            if nuevo:
                usuario = Usuario(correo=correo)
                db.session.add(usuario)
            usuario.nombre = nombre
            usuario.rol = rol
            usuario.activo = True
            usuario.password_hash = encriptar_password(clave)
            usuario.debe_cambiar_clave = False
            usuario.intentos_fallidos = 0
            usuario.bloqueado_hasta = None
            usuario.punto_asignado_id = sede.id if sede else None
            if not nuevo:
                usuario.revocar_sesiones()
            db.session.commit()
            registrar("usuario_creado" if nuevo else "usuario_editado", f"{correo} (script)")

            print(f"\nListo: {nombre} <{correo}> · {rol} · {organizacion.nombre}" + (f" · {sede.nombre}" if sede else ""))
            if correo not in app.config.get("CUENTAS_PROTEGIDAS", []):
                print("Recuerda agregarla a CUENTAS_PROTEGIDAS en tu .env para protegerla.")


if __name__ == "__main__":
    main()
