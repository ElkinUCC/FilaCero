"""Cédula del cliente y preparación previa según el tipo de atención

- usuarios.documento: cédula del cliente. Se registra al dejar un equipo y se
  exige al entregarlo (el celular identifica, la cédula autoriza).
- tramites.requiere_preparacion pasa a derivarse de tipo_flujo: solo ENTREGA y
  GARANTIA se alistan antes de que llegue el cliente (ADR-010 revisado).
- Los turnos activos de trámites sin preparación dejan de mostrarla.

Revision ID: c1e3a5b7d9f0
Revises: b8d0f2a4c6e9
"""

import sqlalchemy as sa
from alembic import op

revision = "c1e3a5b7d9f0"
down_revision = "b8d0f2a4c6e9"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("usuarios") as tabla:
        tabla.add_column(sa.Column("documento", sa.String(length=20), nullable=True))
        tabla.create_index("ix_usuarios_documento", ["documento"])

    op.execute(
        sa.text(
            "UPDATE tramites SET requiere_preparacion = "
            "CASE WHEN tipo_flujo IN ('ENTREGA', 'GARANTIA') THEN 1 ELSE 0 END"
        )
    )
    op.execute(
        sa.text(
            "UPDATE turnos SET estado_preparacion = NULL, nota_preparacion = NULL "
            "WHERE estado IN ('ESPERANDO', 'LLAMADO', 'EN_ATENCION') AND tramite_id IN "
            "(SELECT id FROM tramites WHERE requiere_preparacion = 0)"
        )
    )


def downgrade():
    with op.batch_alter_table("usuarios") as tabla:
        tabla.drop_index("ix_usuarios_documento")
        tabla.drop_column("documento")
