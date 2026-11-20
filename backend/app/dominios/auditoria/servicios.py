"""Servicios de auditoría: registrar acciones sensibles y consultar la bitácora."""

import logging

from flask import has_request_context, request

from . import repositorios
from .dtos import ACCIONES, evento_response  # noqa: F401  (contrato público del módulo)
from .modelos import Auditoria

log = logging.getLogger("filacero.auditoria")


def _actor_actual():
    try:
        from flask_jwt_extended import current_user, verify_jwt_in_request

        verify_jwt_in_request(optional=True)
        return current_user.id if current_user else None
    except Exception:
        return None


def registrar(accion, detalle=None, usuario_id=None):
    """Guarda un evento. Nunca interrumpe la operación principal si falla."""
    try:
        evento = Auditoria(
            accion=accion,
            detalle=(detalle or "")[:255] or None,
            usuario_id=usuario_id if usuario_id is not None else _actor_actual(),
            ip=(request.remote_addr if has_request_context() else None),
        )
        repositorios.agregar(evento)
    except Exception:  # pragma: no cover
        repositorios.deshacer()
        log.exception("No se pudo registrar la auditoría %s", accion)


def consultar_bitacora(args):
    """Página de la bitácora con filtros validados (acción y usuario)."""
    from app.errores import DatosInvalidosError

    try:
        pagina = max(1, int(args.get("pagina", 1)))
        por_pagina = min(100, max(1, int(args.get("por_pagina", 25))))
    except ValueError:
        raise DatosInvalidosError("Paginación inválida.") from None
    accion = args.get("accion") or None
    if accion and accion not in ACCIONES:
        raise DatosInvalidosError("Acción no válida.")
    usuario_id = None
    if args.get("usuario_id"):
        try:
            usuario_id = int(args["usuario_id"])
        except ValueError:
            raise DatosInvalidosError("usuario_id inválido.") from None
    total, eventos = repositorios.paginar(pagina, por_pagina, accion, usuario_id)
    return {
        "pagina": pagina,
        "total": total,
        "total_paginas": (total + por_pagina - 1) // por_pagina,
        "acciones": ACCIONES,
        "eventos": [evento_response(e) for e in eventos],
    }
