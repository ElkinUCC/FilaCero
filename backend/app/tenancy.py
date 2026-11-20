"""Aislamiento multiempresa a nivel de ORM y contexto HTTP.

La organización activa se resuelve desde un JWT firmado o desde el encabezado
X-Organization-Slug en rutas públicas. Nunca se confía en un organization_id
suministrado en el cuerpo de una petición.
"""

from contextlib import contextmanager

from flask import g, has_app_context, has_request_context
from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from app import db
from app.errores import PermisoDenegadoError

_AISLAMIENTO_INSTALADO = False


class TenantScoped:
    """Mixin para entidades cuyos datos pertenecen a una organización."""

    organizacion_id = db.Column(
        db.Integer,
        db.ForeignKey("organizaciones.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        default=lambda: organizacion_actual_id(),
    )


def organizacion_actual_id():
    if has_app_context():
        return getattr(g, "organizacion_id", None) or 1
    return 1


@contextmanager
def contexto_organizacion(organizacion_id):
    """Fija explícitamente el tenant para tareas CLI o trabajos en segundo plano."""
    if not has_app_context():
        raise RuntimeError("contexto_organizacion requiere un contexto Flask activo.")
    anterior = getattr(g, "organizacion_id", None)
    g.organizacion_id = int(organizacion_id)
    db.session.expire_all()
    try:
        yield
    finally:
        db.session.expire_all()
        if anterior is None:
            g.pop("organizacion_id", None)
        else:
            g.organizacion_id = anterior


def instalar_aislamiento_multiempresa():
    """Aplica filtros automáticos a SELECT/UPDATE/DELETE ORM y valida escrituras."""
    global _AISLAMIENTO_INSTALADO
    if _AISLAMIENTO_INSTALADO:
        return
    _AISLAMIENTO_INSTALADO = True

    @event.listens_for(Session, "do_orm_execute")
    def _filtrar_por_organizacion(estado):
        if not (estado.is_select or estado.is_update or estado.is_delete):
            return
        if not has_app_context():
            return
        if has_request_context():
            organizacion_id = getattr(g, "organizacion_id", None)
            if not organizacion_id:
                return  # aún se está validando el JWT/contexto inicial
        else:
            organizacion_id = organizacion_actual_id()
        estado.statement = estado.statement.options(
            with_loader_criteria(
                TenantScoped,
                lambda modelo: modelo.organizacion_id == organizacion_id,
                include_aliases=True,
            )
        )

    @event.listens_for(Session, "before_flush")
    def _validar_organizacion_en_escrituras(sesion, _contexto, _instancias):
        if not has_app_context():
            return
        # En peticiones HTTP siempre se exige coincidencia con el tenant
        # autenticado/resuelto. Fuera de una petición, el código interno (CLI,
        # migraciones, seeders y tareas administrativas) puede crear registros
        # para un tenant explícito; si no lo especifica, se asigna el tenant 1.
        organizacion_id = getattr(g, "organizacion_id", None) if has_app_context() else None
        if has_request_context() and not organizacion_id:
            return
        for objeto in sesion.new.union(sesion.dirty):
            if isinstance(objeto, TenantScoped):
                asignada = getattr(objeto, "organizacion_id", None)
                if asignada is None:
                    objeto.organizacion_id = organizacion_id or 1
                elif organizacion_id is not None and int(asignada) != int(organizacion_id):
                    raise PermisoDenegadoError(
                        "No puedes crear ni modificar información de otra organización."
                    )

        # Los DELETE ejecutados mediante Session.delete() no pasan por
        # do_orm_execute: SQLAlchemy los emite durante el flush. Por eso deben
        # validarse aquí explícitamente, incluso si el objeto quedó cargado
        # antes de cambiar el contexto de organización en una tarea interna.
        organizacion_borrado = (
            int(organizacion_id) if organizacion_id is not None else organizacion_actual_id()
        )
        for objeto in sesion.deleted:
            if isinstance(objeto, TenantScoped):
                asignada = getattr(objeto, "organizacion_id", None)
                if asignada is None or int(asignada) != int(organizacion_borrado):
                    raise PermisoDenegadoError(
                        "No puedes eliminar información de otra organización."
                    )


def resolver_organizacion_peticion(app):
    """Registra el contexto tenant antes de ejecutar cualquier endpoint API."""
    from flask import abort, g, request
    from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

    from app.dominios.organizaciones.modelos import Organizacion
    from app.dominios.usuarios.modelos import Usuario

    @app.before_request
    def _establecer_organizacion_activa():
        if not request.path.startswith("/api/"):
            return None

        # CORS preflight: el navegador envía OPTIONS antes de la petición real.
        # No lleva JWT y no debe resolver tenant ni consultar claims. Flask-CORS
        # responderá con los encabezados correspondientes; la ruta real seguirá
        # aplicando toda la autenticación y autorización.
        if request.method == "OPTIONS":
            return None

        # Un token presente siempre se valida; no se permite degradarlo a
        # petición pública si está vencido, manipulado o revocado.
        verify_jwt_in_request(optional=True)
        claims = get_jwt() or {}
        identity = get_jwt_identity()
        slug_solicitado = (request.headers.get("X-Organization-Slug") or "").strip().lower()

        if identity is not None:
            try:
                usuario_id = int(identity)
            except (TypeError, ValueError):
                abort(401, description="La sesión no tiene una identidad válida.")

            # Compatibilidad segura con JWT heredados que no incluyen org_id:
            # el tenant se obtiene del usuario en BD, nunca de un dato enviado
            # por el cliente. Los tokens nuevos sí incluyen org_id firmado.
            usuario = db.session.get(Usuario, usuario_id)
            if usuario is None:
                abort(401, description="La sesión no pertenece a una organización activa.")
            try:
                org_firmada = claims.get("org_id")
                token_org_id = int(
                    org_firmada if org_firmada is not None else usuario.organizacion_id
                )
            except (TypeError, ValueError):
                abort(401, description="La sesión no tiene una organización válida.")

            if token_org_id != int(usuario.organizacion_id):
                abort(401, description="La sesión no pertenece a la organización del usuario.")
            organizacion = db.session.get(Organizacion, token_org_id)
            # En instalaciones antiguas y en las pruebas automatizadas, la
            # organización demo (id=1) puede no existir todavía porque usan
            # create_all() sin ejecutar Alembic. Mantener el mismo bootstrap
            # que las rutas públicas evita invalidar JWT legítimos de usuarios
            # heredados cuyo organizacion_id por defecto es 1.
            if organizacion is None and token_org_id == 1:
                organizacion = Organizacion(
                    id=1,
                    nombre="FilaCero Demo",
                    slug="filacero-demo",
                    industria="general",
                    pais="CO",
                    zona_horaria="America/Bogota",
                    idioma="es",
                    moneda="COP",
                    plan="essential",
                    estado="activa",
                    configuracion={},
                )
                db.session.add(organizacion)
                db.session.commit()
            if organizacion is None or not organizacion.activa:
                abort(401, description="La sesión no pertenece a una organización activa.")
            if slug_solicitado and slug_solicitado != organizacion.slug:
                abort(403, description="La sesión no tiene acceso a esa organización.")
        else:
            slug = slug_solicitado or app.config.get("DEFAULT_ORGANIZATION_SLUG", "filacero-demo")
            organizacion = Organizacion.query.filter_by(slug=slug).first()
            # Compatibilidad para instalaciones antiguas recién migradas en
            # pruebas/desarrollo. Con MySQL la crea la migración Alembic.
            if organizacion is None and slug == "filacero-demo":
                organizacion = Organizacion(
                    id=1,
                    nombre="FilaCero Demo",
                    slug="filacero-demo",
                    industria="general",
                    pais="CO",
                    zona_horaria="America/Bogota",
                    idioma="es",
                    moneda="COP",
                    plan="essential",
                    estado="activa",
                    configuracion={},
                )
                db.session.add(organizacion)
                db.session.commit()
            if organizacion is None or not organizacion.activa:
                abort(404, description="Organización no encontrada o inactiva.")

        g.organizacion_id = organizacion.id
        g.organizacion = organizacion
        return None
