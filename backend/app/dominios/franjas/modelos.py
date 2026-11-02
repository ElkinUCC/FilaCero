from app import db


class Franja(db.Model):
    __tablename__ = "franjas"

    __table_args__ = (
        db.UniqueConstraint(
            "punto_id",
            "tramite_id",
            "fecha",
            "hora_inicio",
            name="uq_franja_punto_tramite_fecha_hora",
        ),
        db.CheckConstraint("capacidad > 0", name="ck_franja_capacidad_positiva"),
        db.CheckConstraint("hora_fin > hora_inicio", name="ck_franja_horario_valido"),
    )

    id = db.Column(db.Integer, primary_key=True)

    punto_id = db.Column(db.Integer, db.ForeignKey("puntos.id"), nullable=False, index=True)

    tramite_id = db.Column(db.Integer, db.ForeignKey("tramites.id"), nullable=False, index=True)

    fecha = db.Column(db.Date, nullable=False, index=True)
    hora_inicio = db.Column(db.Time, nullable=False)
    hora_fin = db.Column(db.Time, nullable=False)
    capacidad = db.Column(db.Integer, nullable=False)
    activa = db.Column(db.Boolean, nullable=False, default=True)

    punto = db.relationship("Punto", back_populates="franjas")
    tramite = db.relationship("Tramite", back_populates="franjas")
    turnos = db.relationship("Turno", back_populates="franja")
