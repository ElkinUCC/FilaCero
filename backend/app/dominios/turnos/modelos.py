from datetime import datetime
from app import db


class Turno(db.Model):
    __tablename__ = "turnos"

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), unique=True, nullable=False)

    fecha = db.Column(db.Date, nullable=False)
    hora_solicitud = db.Column(db.DateTime, default=datetime.utcnow)

    estado = db.Column(
        db.String(30),
        nullable=False,
        default="ESPERANDO"
    )

    usuario_id = db.Column(
        db.Integer,
        db.ForeignKey("usuarios.id"),
        nullable=False
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

    usuario = db.relationship("Usuario", back_populates="turnos")
    tramite = db.relationship("Tramite", back_populates="turnos")
    punto = db.relationship("Punto", back_populates="turnos")