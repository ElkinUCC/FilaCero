"""Contrato JSON (DTO) de la organización (tenant)."""


def organizacion_response(organizacion):
    return {
        "id": organizacion.id,
        "nombre": organizacion.nombre,
        "slug": organizacion.slug,
        "industria": organizacion.industria,
        "pais": organizacion.pais,
        "zona_horaria": organizacion.zona_horaria,
        "idioma": organizacion.idioma,
        "moneda": organizacion.moneda,
        "plan": organizacion.plan,
        "estado": organizacion.estado,
        "configuracion": organizacion.configuracion or {},
    }
