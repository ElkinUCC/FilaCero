from app import db
from app.tenancy import TenantScoped


class Tramite(TenantScoped, db.Model):
    __tablename__ = "tramites"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text)
    instrucciones_preparacion = db.Column(db.Text)
    campos_solicitud = db.Column(db.JSON, nullable=True, default=list)
    tiempo_estimado = db.Column(db.Integer, nullable=False, default=15)
    # El trámite se alista antes de que llegue el ciudadano (ej. recoger un
    # equipo reparado): cada turno nace con estado de preparación PENDIENTE.
    # Cómo se reserva: GENERAL, ENTREGA (elige su equipo listo), GARANTIA
    # (registra marca y fecha de compra) o RECLAMO (radica en línea o en persona).
    tipo_flujo = db.Column(
        db.String(20), nullable=False, default="GENERAL", server_default="GENERAL"
    )
    requiere_preparacion = db.Column(
        db.Boolean, nullable=False, default=False, server_default=db.false()
    )
    activo = db.Column(db.Boolean, default=True)

    turnos = db.relationship("Turno", back_populates="tramite")
    franjas = db.relationship("Franja", back_populates="tramite")
