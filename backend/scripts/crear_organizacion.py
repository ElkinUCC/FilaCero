"""Provisiona una organización en una instalación ya migrada de FilaCero."""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app, db  # noqa: E402
from app.dominios.organizaciones.modelos import Organizacion  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Crear una organización FilaCero")
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--industria", default="general")
    parser.add_argument("--pais", default="CO")
    parser.add_argument("--zona-horaria", default="America/Bogota")
    parser.add_argument("--idioma", default="es")
    parser.add_argument("--moneda", default="COP")
    args = parser.parse_args()

    slug = args.slug.strip().lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?", slug):
        parser.error("El slug solo admite minúsculas, números y guiones.")
    if not re.fullmatch(r"[A-Z]{2}", args.pais):
        parser.error("--pais debe ser un código ISO 3166-1 alpha-2, por ejemplo CO.")
    if not re.fullmatch(r"[A-Z]{3}", args.moneda):
        parser.error("--moneda debe ser un código ISO 4217, por ejemplo COP.")

    app = create_app()
    with app.app_context():
        if Organizacion.query.filter_by(slug=slug).first():
            parser.error(f"Ya existe una organización con slug '{slug}'.")
        organizacion = Organizacion(
            nombre=args.nombre.strip(),
            slug=slug,
            industria=args.industria.strip().lower(),
            pais=args.pais,
            zona_horaria=args.zona_horaria,
            idioma=args.idioma,
            moneda=args.moneda,
            plan="essential",
            estado="activa",
            configuracion={},
        )
        db.session.add(organizacion)
        db.session.commit()
        print(f"Organización creada: id={organizacion.id}, slug={organizacion.slug}")
        print(f'En frontend/src/js/config.js usa ORGANIZATION_SLUG: "{organizacion.slug}"')


if __name__ == "__main__":
    main()
