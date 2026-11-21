from app import db
from app.tenancy import TenantScoped
from app.tiempo import ahora_bd


def _ahora():
    return ahora_bd()


class Equipo(TenantScoped, db.Model):
    """Equipo de un cliente registrado en una sede (orden de servicio).

    Ciclo: POR_RECIBIR (el cliente lo registró para garantía) -> RECIBIDO ->
    EN_REPARACION -> LISTO (listo para entregar) -> ENTREGADO.
    """

    __tablename__ = "equipos"

    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), unique=True, nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=False, index=True)
    punto_id = db.Column(db.Integer, db.ForeignKey("puntos.id"), nullable=False, index=True)
    tipo = db.Column(db.String(40), nullable=False, default="Televisor")
    marca = db.Column(db.String(40), nullable=False)
    modelo = db.Column(db.String(60), nullable=True)
    serial = db.Column(db.String(60), nullable=True)
    falla = db.Column(db.String(300), nullable=True)
    origen = db.Column(db.String(20), nullable=False, default="REPARACION")
    fecha_compra = db.Column(db.Date, nullable=True)
    estado = db.Column(db.String(20), nullable=False, default="RECIBIDO", index=True)
    nota = db.Column(db.String(300), nullable=True)
    registrado_por_id = db.Column(db.Integer, db.ForeignKey("usuarios.id"), nullable=True)
    fecha_registro = db.Column(db.DateTime, nullable=False, default=_ahora)
    fecha_actualizacion = db.Column(db.DateTime, nullable=False, default=_ahora)
    fecha_entrega = db.Column(db.DateTime, nullable=True)

    cliente = db.relationship("Usuario", foreign_keys=[cliente_id])
    registrado_por = db.relationship("Usuario", foreign_keys=[registrado_por_id])
    punto = db.relationship("Punto")
