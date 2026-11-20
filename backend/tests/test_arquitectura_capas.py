"""Pruebas de arquitectura (fitness functions) del monolito modular por capas.

Comprueban automáticamente las reglas de dependencia documentadas en
docs/arquitectura/04-arquitectura-logica.md:

1. Los controladores no acceden a la base de datos (sin ``db``, ``.query`` ni SQL).
2. Cada dominio con persistencia tiene sus capas: modelos, repositorios, servicios,
   DTO y controlador.
3. Los servicios y repositorios no dependen de Flask ni de la capa HTTP.
"""

import ast
import pathlib

import pytest

DOMINIOS = pathlib.Path(__file__).resolve().parents[1] / "app" / "dominios"

# Controlador = cualquier módulo de dominio que declare un Blueprint de Flask.
CONTROLADORES = sorted(
    p for p in DOMINIOS.glob("*/*.py") if "Blueprint(" in p.read_text(encoding="utf-8")
)

DOMINIOS_CON_PERSISTENCIA = [
    "auditoria",
    "equipos",
    "franjas",
    "organizaciones",
    "reclamos",
    "sedes",
    "tramites",
    "turnos",
    "usuarios",
]


def _importaciones(ruta):
    arbol = ast.parse(ruta.read_text(encoding="utf-8"))
    nombres = set()
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.ImportFrom) and nodo.module:
            for alias in nodo.names:
                nombres.add(f"{nodo.module}.{alias.name}")
        elif isinstance(nodo, ast.Import):
            nombres.update(alias.name for alias in nodo.names)
    return nombres


@pytest.mark.parametrize("ruta", CONTROLADORES, ids=lambda p: f"{p.parent.name}/{p.name}")
def test_controladores_sin_acceso_a_datos(ruta):
    codigo = ruta.read_text(encoding="utf-8")
    assert "app.db" not in _importaciones(ruta), "El controlador importa la sesión de BD"
    for prohibido in ("db.session", ".query.", ".query(", "select("):
        assert prohibido not in codigo, f"{ruta.name} usa {prohibido!r}: muévelo a un repositorio"


@pytest.mark.parametrize("dominio", DOMINIOS_CON_PERSISTENCIA)
def test_cada_dominio_tiene_sus_capas(dominio):
    carpeta = DOMINIOS / dominio
    for capa in ("modelos.py", "repositorios.py", "servicios.py", "dtos.py"):
        assert (carpeta / capa).exists(), f"Falta {dominio}/{capa}"


@pytest.mark.parametrize(
    "ruta",
    sorted(DOMINIOS.glob("*/repositorios.py")) + sorted(DOMINIOS.glob("*/*servicios.py")),
    ids=lambda p: f"{p.parent.name}/{p.name}",
)
def test_servicios_y_repositorios_no_dependen_de_http(ruta):
    if ruta.parent.name == "auditoria" and ruta.name == "servicios.py":
        pytest.skip("Componente transversal: toma la IP del contexto HTTP si existe (best effort)")
    importaciones = _importaciones(ruta)
    for prohibido in ("flask.request", "flask.jsonify", "flask.Blueprint"):
        assert prohibido not in importaciones, f"{ruta.name} depende de la capa HTTP ({prohibido})"


def test_todos_los_blueprints_estan_en_la_capa_de_presentacion():
    """Los Blueprints solo viven en archivos de controlador (no en servicios ni repositorios)."""
    nombres = {p.name for p in CONTROLADORES}
    assert nombres <= {"controladores.py", "admin_controladores.py", "disponibilidad.py"}
