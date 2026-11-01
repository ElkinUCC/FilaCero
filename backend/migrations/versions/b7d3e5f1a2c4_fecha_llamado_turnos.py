"""Hora en que el asesor llamó el turno (para el asistente de despacho).

Revision ID: b7d3e5f1a2c4
Revises: 022e0d1be8c5
"""

from alembic import op
import sqlalchemy as sa

revision = "b7d3e5f1a2c4"
down_revision = "022e0d1be8c5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("turnos", sa.Column("fecha_llamado", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("turnos", "fecha_llamado")
