from app import db
from app.tenancy import TenantScoped
from app.tiempo import ahora_bd, desde_bd


class Usuario(TenantScoped, db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)

    organizacion = db.relationship("Organizacion", back_populates="usuarios")

    celular = db.Column(db.String(20), nullable=True, index=True)

    # Cédula del cliente. Se registra al dejar un equipo en la sede y se exige
    # al recibirlo de vuelta: el celular identifica, la cédula autoriza la entrega.
    documento = db.Column(db.String(20), nullable=True, index=True)

    nombre = db.Column(db.String(100), nullable=False)

    correo = db.Column(db.String(120), unique=True, nullable=False)

    password_hash = db.Column(db.String(255), nullable=False)

    rol = db.Column(db.String(20), nullable=False, default="CLIENTE")

    activo = db.Column(db.Boolean, nullable=False, default=True)

    punto_asignado_id = db.Column(db.Integer, db.ForeignKey("puntos.id"), nullable=True, index=True)

    punto_asignado = db.relationship("Punto", foreign_keys=[punto_asignado_id])

    # Taquilla o módulo donde atiende el asesor ("Módulo 2", "Taquilla 1").
    # Se anuncia en la sala de espera y en el llamado por voz.
    modulo = db.Column(db.String(40), nullable=True)

    # Baja definitiva (lógica): la cuenta desaparece de los listados y no puede
    # volver a ingresar, pero sus turnos atendidos y su bitácora se conservan.
    eliminado_en = db.Column(db.DateTime, nullable=True)

    # Lo que el asesor está haciendo cuando no atiende: DISPONIBLE, PAUSA,
    # ALMUERZO o AUSENTE (fuera de turno). Lo elige en su consola; el panel lo
    # muestra como estado del asesor. None equivale a DISPONIBLE.
    presencia = db.Column(db.String(20), nullable=True)
    presencia_desde = db.Column(db.DateTime, nullable=True)

    # Tras un restablecimiento, la persona debe crear su propia contraseña.
    debe_cambiar_clave = db.Column(
        db.Boolean, nullable=False, default=False, server_default=db.false()
    )

    ultimo_acceso = db.Column(db.DateTime, nullable=True)

    # Bloqueo temporal tras varios intentos fallidos (anti fuerza bruta).
    intentos_fallidos = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    bloqueado_hasta = db.Column(db.DateTime, nullable=True)

    # Revocación de sesiones (cambio de clave, de rol, desactivación o "cerrar
    # sesión"). Cada token lleva la versión vigente al emitirse (claim "ver");
    # al revocar, la versión sube y todos los tokens anteriores dejan de servir
    # en la siguiente petición, aunque se hayan emitido en el mismo segundo.
    sesiones_desde = db.Column(db.DateTime, nullable=True)  # fecha de la última revocación
    version_sesion = db.Column(db.Integer, nullable=False, default=0, server_default="0")

    @property
    def eliminado(self):
        return self.eliminado_en is not None

    def revocar_sesiones(self):
        self.sesiones_desde = ahora_bd(microsegundos=False)
        self.version_sesion = (self.version_sesion or 0) + 1

    @property
    def protegida(self):
        """Cuenta listada en CUENTAS_PROTEGIDAS (.env)."""
        from flask import current_app

        return (self.correo or "").lower() in current_app.config.get("CUENTAS_PROTEGIDAS", [])

    def token_vigente(self, payload):
        """True si el token (claims JWT) sigue siendo válido para esta cuenta."""
        if "ver" in payload:
            return payload["ver"] == (self.version_sesion or 0)
        # Tokens sin versión (emitidos antes de esta mejora): regla por fecha.
        if self.sesiones_desde:
            limite = int(desde_bd(self.sesiones_desde).timestamp())
            return int(payload.get("iat", 0)) >= limite
        return True

    fecha_creacion = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: ahora_bd(),
    )

    def __repr__(self):
        return f"<Usuario {self.correo}>"

    turnos = db.relationship("Turno", back_populates="usuario", foreign_keys="Turno.usuario_id")

    turnos_atendidos = db.relationship(
        "Turno", back_populates="agente", foreign_keys="Turno.agente_id"
    )
