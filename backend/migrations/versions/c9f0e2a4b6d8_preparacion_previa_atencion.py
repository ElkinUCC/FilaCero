"""Añade instrucciones del trámite y detalle de necesidad al turno.

Revision ID: c9f0e2a4b6d8
Revises: f6b8c0d2e4a6
"""

import sqlalchemy as sa
from alembic import op

revision = "c9f0e2a4b6d8"
down_revision = "f6b8c0d2e4a6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tramites", sa.Column("instrucciones_preparacion", sa.Text(), nullable=True))
    op.add_column("turnos", sa.Column("detalle_necesidad", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("turnos") as tabla:
        tabla.drop_column("detalle_necesidad")
    with op.batch_alter_table("tramites") as tabla:
        tabla.drop_column("instrucciones_preparacion")
