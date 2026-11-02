"""Versión de sesión: revocación inmediata de tokens (incluso en el mismo segundo)

Revision ID: e5a7c9d1f3b4
Revises: d4f6b8c0e2a3
Create Date: 2026-11-01
"""

import sqlalchemy as sa
from alembic import op

revision = "e5a7c9d1f3b4"
down_revision = "d4f6b8c0e2a3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "usuarios",
        sa.Column("version_sesion", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    with op.batch_alter_table("usuarios") as tabla:
        tabla.drop_column("version_sesion")
