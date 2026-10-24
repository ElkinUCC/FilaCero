from datetime import datetime
from app import db


class Turno(db.Model):
    __tablename__ = "turnos"

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(30), unique=True, nullable=False)

    hora_solicitud = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    estado = db.Column(
        db.String(30),
        nullable=False,
        default="ESPERANDO"
    )

    usuario_id = db.Column(
        db.Integer,
        db.ForeignKey("usuarios.id"),
        nullable=False,
        index=True
    )

    tramite_id = db.Column(
        db.Integer,
        db.ForeignKey("tramites.id"),
        nullable=False
    )

    punto_id = db.Column(
        db.Integer,
        db.ForeignKey("puntos.id"),
        nullable=False
    )

    franja_id = db.Column(
        db.Integer,
        db.ForeignKey("franjas.id"),
        nullable=False,
        index=True
    )

    usuario = db.relationship("Usuario", back_populates="turnos")
    tramite = db.relationship("Tramite", back_populates="turnos")
    punto = db.relationship("Punto", back_populates="turnos")
    franja = db.relationship("Franja", back_populates="turnos")
