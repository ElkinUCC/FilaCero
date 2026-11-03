"""Núcleo multiempresa: organizaciones y pertenencia de datos.

Revision ID: f6b8c0d2e4a6
Revises: e5a7c9d1f3b4
"""
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "f6b8c0d2e4a6"
down_revision = "e5a7c9d1f3b4"
branch_labels = None
depends_on = None

_TABLAS_TENANT = ("usuarios", "puntos", "tramites", "franjas", "turnos", "auditoria")


def upgrade():
    op.create_table(
        "organizaciones",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(length=160), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("industria", sa.String(length=60), nullable=False),
        sa.Column("pais", sa.String(length=2), nullable=False),
        sa.Column("zona_horaria", sa.String(length=64), nullable=False),
        sa.Column("idioma", sa.String(length=10), nullable=False),
        sa.Column("moneda", sa.String(length=3), nullable=False),
        sa.Column("plan", sa.String(length=30), nullable=False),
        sa.Column("estado", sa.String(length=20), nullable=False),
        sa.Column("configuracion", sa.JSON(), nullable=False),
        sa.Column("creada_en", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("slug", name="uq_organizaciones_slug"),
    )
    op.create_index("ix_organizaciones_estado", "organizaciones", ["estado"], unique=False)

    organizaciones = sa.table(
        "organizaciones",
        sa.column("id", sa.Integer),
        sa.column("nombre", sa.String),
        sa.column("slug", sa.String),
        sa.column("industria", sa.String),
        sa.column("pais", sa.String),
        sa.column("zona_horaria", sa.String),
        sa.column("idioma", sa.String),
        sa.column("moneda", sa.String),
        sa.column("plan", sa.String),
        sa.column("estado", sa.String),
        sa.column("configuracion", sa.JSON),
        sa.column("creada_en", sa.DateTime),
    )
    op.bulk_insert(
        organizaciones,
        [{
            "id": 1,
            "nombre": "FilaCero (organización inicial)",
            "slug": "filacero-demo",
            "industria": "general",
            "pais": "CO",
            "zona_horaria": "America/Bogota",
            "idioma": "es",
            "moneda": "COP",
            "plan": "essential",
            "estado": "activa",
            "configuracion": {},
            "creada_en": datetime.utcnow(),
        }],
    )

    for tabla in _TABLAS_TENANT:
        op.add_column(tabla, sa.Column("organizacion_id", sa.Integer(), nullable=True))
        op.execute(sa.text(f"UPDATE {tabla} SET organizacion_id = 1 WHERE organizacion_id IS NULL"))
        op.alter_column(tabla, "organizacion_id", existing_type=sa.Integer(), nullable=False)
        op.create_index(f"ix_{tabla}_organizacion_id", tabla, ["organizacion_id"], unique=False)
        op.create_foreign_key(
            f"fk_{tabla}_organizacion_id",
            tabla,
            "organizaciones",
            ["organizacion_id"],
            ["id"],
            ondelete="RESTRICT",
        )


def downgrade():
    for tabla in reversed(_TABLAS_TENANT):
        op.drop_constraint(f"fk_{tabla}_organizacion_id", tabla, type_="foreignkey")
        op.drop_index(f"ix_{tabla}_organizacion_id", table_name=tabla)
        op.drop_column(tabla, "organizacion_id")
    op.drop_index("ix_organizaciones_estado", table_name="organizaciones")
    op.drop_table("organizaciones")
