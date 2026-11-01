from datetime import datetime, timezone

from app import db


class Usuario(db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)

    celular = db.Column(db.String(20), nullable=True, index=True)

    nombre = db.Column(
        db.String(100),
        nullable=False
    )

    correo = db.Column(
        db.String(120),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    rol = db.Column(
        db.String(20),
        nullable=False,
        default="CLIENTE"
    )

    activo = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    punto_asignado_id = db.Column(
        db.Integer,
        db.ForeignKey("puntos.id"),
        nullable=True,
        index=True
    )

    punto_asignado = db.relationship(
        "Punto",
        foreign_keys=[punto_asignado_id]
    )

    # Tras un restablecimiento, la persona debe crear su propia contraseña.
    debe_cambiar_clave = db.Column(
        db.Boolean, nullable=False, default=False, server_default=db.false()
    )

    ultimo_acceso = db.Column(db.DateTime, nullable=True)

    # Bloqueo temporal tras varios intentos fallidos (anti fuerza bruta).
    intentos_fallidos = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    bloqueado_hasta = db.Column(db.DateTime, nullable=True)

    # Tokens emitidos antes de esta fecha quedan revocados (cambio de clave,
    # de rol, desactivación o "cerrar sesión").
    sesiones_desde = db.Column(db.DateTime, nullable=True)

    def revocar_sesiones(self):
        self.sesiones_desde = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)

    fecha_creacion = db.Column(
    db.DateTime,
    nullable=False,
    default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    def __repr__(self):
        return f"<Usuario {self.correo}>"

    turnos = db.relationship(
        "Turno",
        back_populates="usuario",
        foreign_keys="Turno.usuario_id"
    )

    turnos_atendidos = db.relationship(
        "Turno",
        back_populates="agente",
        foreign_keys="Turno.agente_id"
    )
