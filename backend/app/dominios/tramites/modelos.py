from app import db


class Tramite(db.Model):
    __tablename__ = "tramites"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text)
    tiempo_estimado = db.Column(db.Integer, nullable=False, default=15)
    activo = db.Column(db.Boolean, default=True)

    turnos = db.relationship("Turno", back_populates="tramite")
    franjas = db.relationship("Franja", back_populates="tramite")
