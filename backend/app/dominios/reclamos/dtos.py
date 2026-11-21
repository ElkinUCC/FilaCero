from app.horario import a_iso

ESTADOS_RECLAMO = {
    "RADICADO": "Radicado",
    "EN_GESTION": "En gestión",
    "RESUELTO": "Resuelto",
}
CATEGORIAS = {
    "ATENCION": "Atención recibida",
    "REPARACION": "Calidad de la reparación",
    "DEMORA": "Demora en la entrega",
    "COBRO": "Cobro o factura",
    "CONSULTA": "Consulta o diagnóstico previo",
    "OTRO": "Otro",
}


def _equipo(reclamo):
    equipo = reclamo.equipo
    if not equipo:
        return None
    return " ".join(p for p in (equipo.marca, equipo.modelo, "·", equipo.codigo) if p)


def mensaje_response(m):
    return {
        "id": m.id,
        "autor": m.autor,
        "autor_nombre": m.autor_nombre,
        "texto": m.texto,
        "fecha": a_iso(m.fecha),
    }


def _hilo(reclamo):
    """Mensajes del chat."""
    hilo = [mensaje_response(m) for m in reclamo.mensajes]
    if reclamo.respuesta and not any(m["autor"] == "ASESOR" for m in hilo):
        hilo.insert(
            0,
            {
                "id": f"r{reclamo.id}",
                "autor": "ASESOR",
                "autor_nombre": (
                    reclamo.gestionado_por.nombre if reclamo.gestionado_por else "Asesor"
                ),
                "texto": reclamo.respuesta,
                "fecha": a_iso(reclamo.fecha_respuesta),
            },
        )
    return hilo


def reclamo_response(reclamo, *, publica=False):
    datos = {
        "id": reclamo.id,
        "radicado": reclamo.radicado,
        "categoria": reclamo.categoria,
        "categoria_texto": CATEGORIAS.get(reclamo.categoria, reclamo.categoria),
        "descripcion": reclamo.descripcion,
        "presencial": bool(reclamo.presencial),
        "estado": reclamo.estado,
        "estado_texto": ESTADOS_RECLAMO.get(reclamo.estado, reclamo.estado),
        "respuesta": reclamo.respuesta,
        "sede": reclamo.punto.nombre if reclamo.punto else None,
        "equipo": _equipo(reclamo),
        "fecha": a_iso(reclamo.fecha_creacion),
        "fecha_respuesta": a_iso(reclamo.fecha_respuesta),
        "mensajes": _hilo(reclamo),
        "sin_leer": sum(
            1
            for m in reclamo.mensajes
            if (publica and m.autor != "CLIENTE" and not m.leido_cliente)
            or (not publica and m.autor == "CLIENTE" and not m.leido_asesor)
        ),
    }
    if not publica:
        datos.update(
            {
                "cliente_nombre": reclamo.cliente.nombre if reclamo.cliente else None,
                "cliente_celular": reclamo.cliente.celular if reclamo.cliente else None,
                "gestionado_por": reclamo.gestionado_por.nombre if reclamo.gestionado_por else None,
            }
        )
    else:
        datos.pop("id")
    return datos
