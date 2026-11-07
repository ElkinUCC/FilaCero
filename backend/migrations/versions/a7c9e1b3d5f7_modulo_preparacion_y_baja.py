"""Módulo de atención, preparación previa del turno y baja lógica de cuentas.

- usuarios.modulo: taquilla o módulo donde atiende el asesor ("Módulo 2").
- usuarios.eliminado_en: baja definitiva (lógica) que conserva el historial.
- tramites.requiere_preparacion: el trámite se alista antes de que llegue el
  ciudadano (recoger un equipo, garantía, factura...).
- turnos.estado_preparacion / nota_preparacion / fecha_preparacion /
  preparado_por_id: seguimiento de esa preparación previa.

Revision ID: a7c9e1b3d5f7
Revises: d3e5f7a9b1c2
"""

import sqlalchemy as sa
from alembic import op

revision = "a7c9e1b3d5f7"
down_revision = "d3e5f7a9b1c2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("usuarios") as tabla:
        tabla.add_column(sa.Column("modulo", sa.String(length=40), nullable=True))
        tabla.add_column(sa.Column("eliminado_en", sa.DateTime(), nullable=True))

    with op.batch_alter_table("tramites") as tabla:
        tabla.add_column(
            sa.Column(
                "requiere_preparacion",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    with op.batch_alter_table("turnos") as tabla:
        tabla.add_column(sa.Column("estado_preparacion", sa.String(length=20), nullable=True))
        tabla.add_column(sa.Column("nota_preparacion", sa.Text(), nullable=True))
        tabla.add_column(sa.Column("fecha_preparacion", sa.DateTime(), nullable=True))
        tabla.add_column(sa.Column("preparado_por_id", sa.Integer(), nullable=True))
        tabla.create_foreign_key(
            "fk_turnos_preparado_por", "usuarios", ["preparado_por_id"], ["id"]
        )


def downgrade():
    with op.batch_alter_table("turnos") as tabla:
        tabla.drop_constraint("fk_turnos_preparado_por", type_="foreignkey")
        tabla.drop_column("preparado_por_id")
        tabla.drop_column("fecha_preparacion")
        tabla.drop_column("nota_preparacion")
        tabla.drop_column("estado_preparacion")

    with op.batch_alter_table("tramites") as tabla:
        tabla.drop_column("requiere_preparacion")

    with op.batch_alter_table("usuarios") as tabla:
        tabla.drop_column("eliminado_en")
        tabla.drop_column("modulo")
