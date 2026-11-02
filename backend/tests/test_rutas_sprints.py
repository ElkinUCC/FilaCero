from app import create_app


def test_rutas_clave_de_fila_cero_registradas():
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "JWT_SECRET_KEY": "clave-exclusiva-para-pruebas",
        }
    )

    rutas = {
        (rule.rule, method)
        for rule in app.url_map.iter_rules()
        for method in rule.methods
        if method not in {"HEAD", "OPTIONS"}
    }

    esperadas = {
        ("/health", "GET"),
        ("/api/v1/usuarios/login", "POST"),
        ("/api/v1/usuarios/registro", "POST"),
        ("/api/v1/turnos/", "POST"),
        ("/api/v1/turnos/mis-turnos", "GET"),
        ("/api/v1/agente/cola", "GET"),
        ("/api/v1/agente/actual", "GET"),
        ("/api/v1/agente/llamar-siguiente", "POST"),
        ("/api/v1/admin/agentes/", "GET"),
        ("/api/v1/admin/agentes/metricas", "GET"),
        ("/api/v1/admin/agentes/historial", "GET"),
        ("/api/v1/admin/agentes/metricas/sedes", "GET"),
        ("/api/v1/admin/agentes/metricas/tramites", "GET"),
    }

    faltantes = esperadas - rutas

    assert not faltantes, "Hay rutas esperadas que no están registradas: " f"{sorted(faltantes)}"
