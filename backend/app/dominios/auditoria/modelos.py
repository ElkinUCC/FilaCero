from datetime import datetime, timezone

from app import db


class Auditoria(db.Model):
    """Registro de acciones sensibles: quién hizo qué y cuándo."""

    __tablename__ = "auditoria"

    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(
        db.DateTime, nullable=False, index=True,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    usuario_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=True, index=True)
    accion = db.Column(db.String(40), nullable=False, index=True)
    detalle = db.Column(db.String(255), nullable=True)
    ip = db.Column(db.String(45), nullable=True)

    usuario = db.relationship("Usuario", foreign_keys=[usuario_id])
