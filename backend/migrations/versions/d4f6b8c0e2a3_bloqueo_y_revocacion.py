"""Bloqueo de cuenta por intentos fallidos y revocación de sesiones.

Revision ID: d4f6b8c0e2a3
Revises: c3e5a7b9d1f2
"""

from alembic import op
import sqlalchemy as sa

revision = "d4f6b8c0e2a3"
down_revision = "c3e5a7b9d1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("usuarios", sa.Column("intentos_fallidos", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("usuarios", sa.Column("bloqueado_hasta", sa.DateTime(), nullable=True))
    op.add_column("usuarios", sa.Column("sesiones_desde", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("usuarios", "sesiones_desde")
    op.drop_column("usuarios", "bloqueado_hasta")
    op.drop_column("usuarios", "intentos_fallidos")
