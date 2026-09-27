from app import db


class Punto(db.Model):
    __tablename__ = "puntos"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    direccion = db.Column(db.String(200))
    activo = db.Column(db.Boolean, default=True)

    turnos = db.relationship("Turno", back_populates="punto")