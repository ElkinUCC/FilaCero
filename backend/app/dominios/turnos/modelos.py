from datetime import UTC, datetime

from app import db
from app.tenancy import TenantScoped


class Turno(TenantScoped, db.Model):
    __tablename__ = "turnos"

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(30), unique=True, nullable=False)

    hora_solicitud = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC).replace(tzinfo=None),
    )

    estado = db.Column(db.String(30), nullable=False, default="ESPERANDO")
    detalle_necesidad = db.Column(db.Text)
    respuestas_solicitud = db.Column(db.JSON)

    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=False, index=True)

    tramite_id = db.Column(db.Integer, db.ForeignKey("tramites.id"), nullable=False)

    punto_id = db.Column(db.Integer, db.ForeignKey("puntos.id"), nullable=False)

    franja_id = db.Column(db.Integer, db.ForeignKey("franjas.id"), nullable=False, index=True)

    agente_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=True, index=True)

    fecha_llamado = db.Column(db.DateTime, nullable=True)

    fecha_inicio = db.Column(db.DateTime, nullable=True)

    fecha_fin = db.Column(db.DateTime, nullable=True)

    # Preparación previa (back-office): el asesor alista lo que el ciudadano
    # pidió antes de que llegue. PENDIENTE -> EN_PREPARACION -> LISTO | NOVEDAD.
    # None = el trámite no requiere preparación.
    estado_preparacion = db.Column(db.String(20), nullable=True)
    nota_preparacion = db.Column(db.Text, nullable=True)
    fecha_preparacion = db.Column(db.DateTime, nullable=True)
    preparado_por_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=True)

    # Equipo o reclamo del cliente al que se refiere la cita (entrega, garantía, reclamo).
    equipo_id = db.Column(db.Integer, db.ForeignKey("equipos.id"), nullable=True)
    reclamo_id = db.Column(db.Integer, db.ForeignKey("reclamos.id"), nullable=True)

    usuario = db.relationship("Usuario", back_populates="turnos", foreign_keys=[usuario_id])
    tramite = db.relationship("Tramite", back_populates="turnos")
    punto = db.relationship("Punto", back_populates="turnos")
    franja = db.relationship("Franja", back_populates="turnos")

    agente = db.relationship("Usuario", back_populates="turnos_atendidos", foreign_keys=[agente_id])
    preparado_por = db.relationship("Usuario", foreign_keys=[preparado_por_id])
    equipo = db.relationship("Equipo")

    @property
    def codigo_corto(self):
        """Código visible, con el mismo formato que equipos (EQ-) y reclamos (RC-)."""
        return f"TU-{self.codigo[-6:]}" if self.codigo else None

    reclamo = db.relationship("Reclamo")
