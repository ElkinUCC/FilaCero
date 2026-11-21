"""Contrato JSON (DTO) de los eventos de la bitácora."""

from app.horario import a_iso

# Catálogo de acciones auditables y su texto legible en el panel.
ACCIONES = {
    "login": "Inicio de sesión",
    "login_fallido": "Intento de ingreso fallido",
    "login_bloqueado": "Ingreso con cuenta bloqueada",
    "logout": "Cerró sesión",
    "clave_cambiada": "Cambió su contraseña",
    "clave_restablecida": "Contraseña restablecida",
    "usuario_creado": "Usuario creado",
    "usuario_editado": "Usuario editado",
    "rol_cambiado": "Cambio de rol",
    "usuario_desactivado": "Acceso desactivado",
    "usuario_activado": "Acceso activado",
    "sede_creada": "Sede creada",
    "sede_editada": "Sede editada",
    "sede_eliminada": "Sede eliminada",
    "tramite_creado": "Trámite creado",
    "tramite_editado": "Trámite editado",
    "tramite_eliminado": "Trámite eliminado",
    "sede_cambiada": "Asesor cambió de sede",
    "usuario_eliminado": "Cuenta eliminada",
    "turno_preparado": "Preparación de turno",
    "equipo_registrado": "Equipo registrado",
    "equipo_actualizado": "Estado de equipo",
    "reclamo_gestionado": "Reclamo gestionado",
    "presencia_cambiada": "Estado del asesor",
}


def evento_response(evento):
    return {
        "id": evento.id,
        "fecha": a_iso(evento.fecha),
        "accion": evento.accion,
        "accion_texto": ACCIONES.get(evento.accion, evento.accion),
        "detalle": evento.detalle,
        "usuario": evento.usuario.nombre if evento.usuario else None,
        "usuario_correo": evento.usuario.correo if evento.usuario else None,
        "ip": evento.ip,
    }
