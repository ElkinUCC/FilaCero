"""Minichat de reclamos y consultas (ciudadano, asesor y asistente automático)

Revision ID: d2f4b6c8e0a1
Revises: c1e3a5b7d9f0
"""

import sqlalchemy as sa
from alembic import op

revision = "d2f4b6c8e0a1"
down_revision = "c1e3a5b7d9f0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mensajes_reclamo",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "organizacion_id",
            sa.Integer(),
            sa.ForeignKey("organizaciones.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reclamo_id", sa.Integer(), sa.ForeignKey("reclamos.id"), nullable=False, index=True
        ),
        sa.Column("autor", sa.String(length=12), nullable=False),
        sa.Column("autor_nombre", sa.String(length=100), nullable=True),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("fecha", sa.DateTime(), nullable=False),
        sa.Column("leido_cliente", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("leido_asesor", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade():
    op.drop_table("mensajes_reclamo")
