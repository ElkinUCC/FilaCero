"""Fechas guardadas en hora Colombia (America/Bogota, UTC-5) en vez de UTC.

Hasta esta versión todas las columnas DATETIME se guardaban en UTC sin zona.
Desde ahora la app guarda la hora de Colombia (ver app/tiempo.py), así que los
registros existentes se corren 5 horas hacia atrás. Colombia no tiene horario
de verano, por lo que el desfase es fijo.

Revision ID: e7a9c1d3f5b8
Revises: d2f4b6c8e0a1
"""

from alembic import op

revision = "e7a9c1d3f5b8"
down_revision = "d2f4b6c8e0a1"
branch_labels = None
depends_on = None

DESFASE_HORAS = 5  # UTC -> America/Bogota

COLUMNAS = {
    "auditoria": ["fecha"],
    "equipos": ["fecha_registro", "fecha_actualizacion", "fecha_entrega"],
    "organizaciones": ["creada_en"],
    "reclamos": ["fecha_creacion", "fecha_respuesta"],
    "mensajes_reclamo": ["fecha"],
    "turnos": ["hora_solicitud", "fecha_llamado", "fecha_inicio", "fecha_fin", "fecha_preparacion"],
    "usuarios": [
        "eliminado_en",
        "presencia_desde",
        "ultimo_acceso",
        "bloqueado_hasta",
        "sesiones_desde",
        "fecha_creacion",
    ],
}


def _desplazar(horas):
    bind = op.get_bind()
    dialecto = bind.dialect.name
    for tabla, columnas in COLUMNAS.items():
        for columna in columnas:
            if dialecto == "sqlite":
                expresion = f"datetime({columna}, '{horas:+d} hours')"
            elif dialecto == "postgresql":
                expresion = f"{columna} + interval '{horas} hours'"
            else:  # mysql / mariadb
                expresion = f"DATE_ADD({columna}, INTERVAL {horas} HOUR)"
            op.execute(
                f"UPDATE {tabla} SET {columna} = {expresion} WHERE {columna} IS NOT NULL"
            )


def upgrade():
    _desplazar(-DESFASE_HORAS)


def downgrade():
    _desplazar(DESFASE_HORAS)
