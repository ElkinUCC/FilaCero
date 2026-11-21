from app import db
from app.tiempo import ahora_bd


class Organizacion(db.Model):
    __tablename__ = "organizaciones"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(160), nullable=False)
    slug = db.Column(db.String(80), nullable=False, unique=True)
    industria = db.Column(db.String(60), nullable=False, default="general")
    pais = db.Column(db.String(2), nullable=False, default="CO")
    zona_horaria = db.Column(db.String(64), nullable=False, default="America/Bogota")
    idioma = db.Column(db.String(10), nullable=False, default="es")
    moneda = db.Column(db.String(3), nullable=False, default="COP")
    plan = db.Column(db.String(30), nullable=False, default="essential")
    estado = db.Column(db.String(20), nullable=False, default="activa", index=True)
    configuracion = db.Column(db.JSON, nullable=False, default=dict)
    creada_en = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: ahora_bd(),
    )

    usuarios = db.relationship("Usuario", back_populates="organizacion")

    @property
    def activa(self):
        return self.estado == "activa"


# Entorno de pruebas/desarrollo que usa db.create_all(): crea una organización
# inicial reproducible. Con MySQL la crea la migración Alembic.
from sqlalchemy import event, insert  # noqa: E402  (solo para create_all en pruebas)


@event.listens_for(Organizacion.__table__, "after_create")
def _crear_organizacion_inicial(_tabla, conexion, **_kwargs):
    conexion.execute(
        insert(Organizacion.__table__).values(
            id=1,
            nombre="FilaCero (organización inicial)",
            slug="filacero-demo",
            industria="general",
            pais="CO",
            zona_horaria="America/Bogota",
            idioma="es",
            moneda="COP",
            plan="essential",
            estado="activa",
            configuracion={},
            creada_en=ahora_bd(),
        )
    )
