from marshmallow import Schema, fields, validate


class RegistroUsuarioSchema(Schema):
    nombre = fields.Str(
        required=True,
        validate=validate.Length(min=2, max=100)
    )

    correo = fields.Email(required=True)

    password = fields.Str(
        required=True,
        load_only=True,
        validate=validate.Length(min=6)
    )


class LoginSchema(Schema):
    correo = fields.Email(required=True)

    password = fields.Str(
        required=True,
        load_only=True
    )


def usuario_response(usuario):
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "correo": usuario.correo,
        "rol": usuario.rol,
        "activo": usuario.activo,
        "fecha_creacion": usuario.fecha_creacion.isoformat()
    }