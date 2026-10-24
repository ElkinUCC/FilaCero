"""Asignación de agentes y ciclo de atención.

Revision ID: a91c6d8e42f0
Revises: 7fb57bf505c3
"""

from alembic import op
import sqlalchemy as sa

revision = "a91c6d8e42f0"
down_revision = "7fb57bf505c3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "usuarios",
        sa.Column("punto_asignado_id", sa.Integer(), nullable=True)
    )
    op.create_index(
        "ix_usuarios_punto_asignado_id",
        "usuarios",
        ["punto_asignado_id"]
    )
    op.create_foreign_key(
        "fk_usuarios_punto_asignado",
        "usuarios",
        "puntos",
        ["punto_asignado_id"],
        ["id"]
    )

    op.add_column(
        "turnos",
        sa.Column("agente_id", sa.Integer(), nullable=True)
    )
    op.add_column(
        "turnos",
        sa.Column("fecha_inicio", sa.DateTime(), nullable=True)
    )
    op.add_column(
        "turnos",
        sa.Column("fecha_fin", sa.DateTime(), nullable=True)
    )
    op.create_index(
        "ix_turnos_agente_id",
        "turnos",
        ["agente_id"]
    )
    op.create_foreign_key(
        "fk_turnos_agente",
        "turnos",
        "usuarios",
        ["agente_id"],
        ["id"]
    )


def downgrade():
    op.drop_constraint(
        "fk_turnos_agente", "turnos", type_="foreignkey"
    )
    op.drop_index("ix_turnos_agente_id", table_name="turnos")
    op.drop_column("turnos", "fecha_fin")
    op.drop_column("turnos", "fecha_inicio")
    op.drop_column("turnos", "agente_id")

    op.drop_constraint(
        "fk_usuarios_punto_asignado",
        "usuarios",
        type_="foreignkey"
    )
    op.drop_index(
        "ix_usuarios_punto_asignado_id",
        table_name="usuarios"
    )
    op.drop_column("usuarios", "punto_asignado_id")