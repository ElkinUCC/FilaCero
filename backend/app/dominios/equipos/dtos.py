from app.dominios.usuarios.servicios import documento_enmascarado
from app.horario import a_iso
from app.seguridad import enmascarar_celular

ESTADOS_EQUIPO = {
    "POR_RECIBIR": "Por recibir en sede",
    "RECIBIDO": "Recibido",
    "EN_REPARACION": "En reparación",
    "LISTO": "Listo para entregar",
    "ENTREGADO": "Entregado",
}
ORIGENES = {"REPARACION": "Reparación", "GARANTIA": "Garantía"}


def _base(equipo):
    return {
        "id": equipo.id,
        "codigo": equipo.codigo,
        "tipo": equipo.tipo,
        "marca": equipo.marca,
        "modelo": equipo.modelo,
        "falla": equipo.falla,
        "origen": equipo.origen,
        "origen_texto": ORIGENES.get(equipo.origen, equipo.origen),
        "estado": equipo.estado,
        "estado_texto": ESTADOS_EQUIPO.get(equipo.estado, equipo.estado),
        "nota": equipo.nota,
        "fecha_compra": equipo.fecha_compra.isoformat() if equipo.fecha_compra else None,
        "punto_id": equipo.punto_id,
        "sede": equipo.punto.nombre if equipo.punto else None,
        "fecha_actualizacion": a_iso(equipo.fecha_actualizacion),
    }


def equipo_response(equipo):
    """Vista del personal."""
    datos = _base(equipo)
    datos.update(
        {
            "serial": equipo.serial,
            "cliente_id": equipo.cliente_id,
            "cliente_nombre": equipo.cliente.nombre if equipo.cliente else None,
            "cliente_celular": equipo.cliente.celular if equipo.cliente else None,
            "cliente_documento": documento_enmascarado(
                equipo.cliente.documento if equipo.cliente else None
            ),
            "registrado_por": equipo.registrado_por.nombre if equipo.registrado_por else None,
            "fecha_registro": a_iso(equipo.fecha_registro),
            "fecha_entrega": a_iso(equipo.fecha_entrega),
        }
    )
    return datos


def equipo_publico_response(equipo):
    """Vista del ciudadano: sin IDs de personal; serial parcialmente oculto."""
    datos = _base(equipo)
    serial = equipo.serial or ""
    datos["serial"] = f"···{serial[-4:]}" if len(serial) > 4 else serial or None
    datos["celular"] = enmascarar_celular(equipo.cliente.celular) if equipo.cliente else None
    return datos
