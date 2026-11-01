"""Permisos y auditoría: último acceso, cambio obligatorio de clave y bitácora.

Revision ID: c3e5a7b9d1f2
Revises: b7d3e5f1a2c4
"""

from alembic import op
import sqlalchemy as sa

revision = "c3e5a7b9d1f2"
down_revision = "b7d3e5f1a2c4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "usuarios",
        sa.Column("debe_cambiar_clave", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("usuarios", sa.Column("ultimo_acceso", sa.DateTime(), nullable=True))

    op.create_table(
        "auditoria",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("fecha", sa.DateTime(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("accion", sa.String(length=40), nullable=False),
        sa.Column("detalle", sa.String(length=255), nullable=True),
        sa.Column("ip", sa.String(length=45), nullable=True),
    )
    op.create_index("ix_auditoria_fecha", "auditoria", ["fecha"])
    op.create_index("ix_auditoria_usuario_id", "auditoria", ["usuario_id"])
    op.create_index("ix_auditoria_accion", "auditoria", ["accion"])


def downgrade():
    op.drop_index("ix_auditoria_accion", table_name="auditoria")
    op.drop_index("ix_auditoria_usuario_id", table_name="auditoria")
    op.drop_index("ix_auditoria_fecha", table_name="auditoria")
    op.drop_table("auditoria")
    op.drop_column("usuarios", "ultimo_acceso")
    op.drop_column("usuarios", "debe_cambiar_clave")
