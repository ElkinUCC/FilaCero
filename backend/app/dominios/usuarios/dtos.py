from marshmallow import Schema, fields, pre_load, validate

from app.horario import a_iso_utc


class _Base(Schema):
    @pre_load
    def limpiar(self, datos, **_kwargs):
        if isinstance(datos, dict):
            datos = dict(datos)
            if isinstance(datos.get("correo"), str):
                datos["correo"] = datos["correo"].strip().lower()
            if isinstance(datos.get("nombre"), str):
                datos["nombre"] = datos["nombre"].strip()
        return datos


class RegistroUsuarioSchema(_Base):
    nombre = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    correo = fields.Email(required=True, validate=validate.Length(max=120))
    password = fields.Str(required=True, load_only=True, validate=validate.Length(min=8, max=128))


class LoginSchema(_Base):
    correo = fields.Email(required=True)
    password = fields.Str(required=True, load_only=True, validate=validate.Length(max=128))


def usuario_response(usuario):
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "rol": usuario.rol,
        "activo": usuario.activo,
        "punto_asignado_id": usuario.punto_asignado_id,
        "sede": usuario.punto_asignado.nombre if usuario.punto_asignado else None,
        "modulo": usuario.modulo,
        "documento": f"···{usuario.documento[-4:]}" if usuario.documento else None,
        "presencia": usuario.presencia or "DISPONIBLE",
        "presencia_desde": a_iso_utc(usuario.presencia_desde),
        "debe_cambiar_clave": bool(usuario.debe_cambiar_clave),
        "protegida": usuario.protegida,
        "ultimo_acceso": a_iso_utc(usuario.ultimo_acceso),
        "fecha_creacion": a_iso_utc(usuario.fecha_creacion),
    }
