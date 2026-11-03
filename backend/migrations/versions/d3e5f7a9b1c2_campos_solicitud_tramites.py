"""Añade preguntas configurables y respuestas a la solicitud previa.

Revision ID: d3e5f7a9b1c2
Revises: c9f0e2a4b6d8
"""

import sqlalchemy as sa
from alembic import op

revision = "d3e5f7a9b1c2"
down_revision = "c9f0e2a4b6d8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tramites", sa.Column("campos_solicitud", sa.JSON(), nullable=True))
    op.add_column("turnos", sa.Column("respuestas_solicitud", sa.JSON(), nullable=True))
    op.execute(sa.text("UPDATE tramites SET campos_solicitud = '[]' WHERE campos_solicitud IS NULL"))


def downgrade():
    with op.batch_alter_table("turnos") as tabla:
        tabla.drop_column("respuestas_solicitud")
    with op.batch_alter_table("tramites") as tabla:
        tabla.drop_column("campos_solicitud")
