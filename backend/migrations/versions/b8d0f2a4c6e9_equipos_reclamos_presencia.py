"""Equipos de clientes, reclamos, presencia del asesor y tipo de atención del trámite.

- equipos: órdenes de servicio (recepción, reparación, entrega, garantía).
- reclamos: radicados en línea o para seguir en persona.
- usuarios.presencia / presencia_desde: disponible, pausa, almuerzo, fuera de turno.
- tramites.tipo_flujo: GENERAL, ENTREGA, GARANTIA o RECLAMO (se deduce del nombre
  en los trámites existentes).
- turnos.equipo_id / reclamo_id: a qué equipo o reclamo se refiere la cita.

Revision ID: b8d0f2a4c6e9
Revises: a7c9e1b3d5f7
"""

import sqlalchemy as sa
from alembic import op

revision = "b8d0f2a4c6e9"
down_revision = "a7c9e1b3d5f7"
branch_labels = None
depends_on = None


def _columna_organizacion():
    return sa.Column(
        "organizacion_id",
        sa.Integer(),
        sa.ForeignKey("organizaciones.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


def upgrade():
    op.create_table(
        "equipos",
        sa.Column("id", sa.Integer(), primary_key=True),
        _columna_organizacion(),
        sa.Column("codigo", sa.String(length=20), nullable=False, unique=True),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
        sa.Column("punto_id", sa.Integer(), sa.ForeignKey("puntos.id"), nullable=False, index=True),
        sa.Column("tipo", sa.String(length=40), nullable=False, server_default="Televisor"),
        sa.Column("marca", sa.String(length=40), nullable=False),
        sa.Column("modelo", sa.String(length=60), nullable=True),
        sa.Column("serial", sa.String(length=60), nullable=True),
        sa.Column("falla", sa.String(length=300), nullable=True),
        sa.Column("origen", sa.String(length=20), nullable=False, server_default="REPARACION"),
        sa.Column("fecha_compra", sa.Date(), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="RECIBIDO", index=True),
        sa.Column("nota", sa.String(length=300), nullable=True),
        sa.Column("registrado_por_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("fecha_registro", sa.DateTime(), nullable=False),
        sa.Column("fecha_actualizacion", sa.DateTime(), nullable=False),
        sa.Column("fecha_entrega", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "reclamos",
        sa.Column("id", sa.Integer(), primary_key=True),
        _columna_organizacion(),
        sa.Column("radicado", sa.String(length=20), nullable=False, unique=True),
        sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
        sa.Column("punto_id", sa.Integer(), sa.ForeignKey("puntos.id"), nullable=False, index=True),
        sa.Column("equipo_id", sa.Integer(), sa.ForeignKey("equipos.id"), nullable=True),
        sa.Column("categoria", sa.String(length=30), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("presencial", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="RADICADO", index=True),
        sa.Column("respuesta", sa.Text(), nullable=True),
        sa.Column("gestionado_por_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
        sa.Column("fecha_respuesta", sa.DateTime(), nullable=True),
    )

    with op.batch_alter_table("usuarios") as tabla:
        tabla.add_column(sa.Column("presencia", sa.String(length=20), nullable=True))
        tabla.add_column(sa.Column("presencia_desde", sa.DateTime(), nullable=True))

    with op.batch_alter_table("tramites") as tabla:
        tabla.add_column(
            sa.Column("tipo_flujo", sa.String(length=20), nullable=False, server_default="GENERAL")
        )

    with op.batch_alter_table("turnos") as tabla:
        tabla.add_column(sa.Column("equipo_id", sa.Integer(), nullable=True))
        tabla.add_column(sa.Column("reclamo_id", sa.Integer(), nullable=True))
        tabla.create_foreign_key("fk_turnos_equipo", "equipos", ["equipo_id"], ["id"])
        tabla.create_foreign_key("fk_turnos_reclamo", "reclamos", ["reclamo_id"], ["id"])

    # Trámites existentes: se deduce el tipo de atención por el nombre.
    op.execute(sa.text("UPDATE tramites SET tipo_flujo = 'ENTREGA' WHERE LOWER(nombre) LIKE '%entrega%'"))
    op.execute(sa.text("UPDATE tramites SET tipo_flujo = 'GARANTIA' WHERE LOWER(nombre) LIKE '%garant%'"))
    op.execute(
        sa.text(
            "UPDATE tramites SET tipo_flujo = 'RECLAMO' "
            "WHERE LOWER(nombre) LIKE '%reclamo%' AND LOWER(nombre) NOT LIKE '%garant%'"
        )
    )


def downgrade():
    with op.batch_alter_table("turnos") as tabla:
        tabla.drop_constraint("fk_turnos_reclamo", type_="foreignkey")
        tabla.drop_constraint("fk_turnos_equipo", type_="foreignkey")
        tabla.drop_column("reclamo_id")
        tabla.drop_column("equipo_id")
    with op.batch_alter_table("tramites") as tabla:
        tabla.drop_column("tipo_flujo")
    with op.batch_alter_table("usuarios") as tabla:
        tabla.drop_column("presencia_desde")
        tabla.drop_column("presencia")
    op.drop_table("reclamos")
    op.drop_table("equipos")
