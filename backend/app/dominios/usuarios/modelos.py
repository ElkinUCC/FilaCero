from datetime import datetime

from app import db


class Usuario(db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)

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

    fecha_creacion = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
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
