from datetime import UTC, datetime

from app import db
from app.tenancy import TenantScoped


def _ahora():
    return datetime.now(UTC).replace(tzinfo=None)


class Reclamo(TenantScoped, db.Model):
    """Reclamo radicado por un ciudadano: RADICADO -> EN_GESTION -> RESUELTO."""

    __tablename__ = "reclamos"

    id = db.Column(db.Integer, primary_key=True)
    radicado = db.Column(db.String(20), unique=True, nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=False, index=True)
    punto_id = db.Column(db.Integer, db.ForeignKey("puntos.id"), nullable=False, index=True)
    equipo_id = db.Column(db.Integer, db.ForeignKey("equipos.id"), nullable=True)
    categoria = db.Column(db.String(30), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    presencial = db.Column(db.Boolean, nullable=False, default=False)
    estado = db.Column(db.String(20), nullable=False, default="RADICADO", index=True)
    respuesta = db.Column(db.Text, nullable=True)
    gestionado_por_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = db.Column(db.DateTime, nullable=False, default=_ahora)
    fecha_respuesta = db.Column(db.DateTime, nullable=True)

    cliente = db.relationship("Usuario", foreign_keys=[cliente_id])
    gestionado_por = db.relationship("Usuario", foreign_keys=[gestionado_por_id])
    punto = db.relationship("Punto")
    equipo = db.relationship("Equipo")


class MensajeReclamo(TenantScoped, db.Model):
    """Minichat del reclamo o consulta: ciudadano, asesor y asistente automático."""

    __tablename__ = "mensajes_reclamo"

    id = db.Column(db.Integer, primary_key=True)
    reclamo_id = db.Column(db.Integer, db.ForeignKey("reclamos.id"), nullable=False, index=True)
    autor = db.Column(db.String(12), nullable=False)  # CLIENTE | ASESOR | ASISTENTE
    autor_nombre = db.Column(db.String(100), nullable=True)
    texto = db.Column(db.Text, nullable=False)
    fecha = db.Column(db.DateTime, nullable=False, default=_ahora)
    leido_cliente = db.Column(db.Boolean, nullable=False, default=False)
    leido_asesor = db.Column(db.Boolean, nullable=False, default=False)

    reclamo = db.relationship(
        "Reclamo", backref=db.backref("mensajes", order_by="MensajeReclamo.id", lazy="selectin")
    )
