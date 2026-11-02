# FilaCero API

> API REST de FilaCero: reservas con cupo garantizado por sede, consola de atención con despacho EDF, panel de supervisión y seguridad por roles.

[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-green.svg)](https://flask.palletsprojects.com/)
[![Tests](https://img.shields.io/badge/Tests-87%20passing-brightgreen.svg)](tests)
[![Code style](https://img.shields.io/badge/code%20style-black%20%2B%20ruff-000000.svg)](pyproject.toml)

---

## Arquitectura

La API está organizada **por dominios**. Cada dominio tiene sus propias capas, igual que en el proyecto de referencia:

```
backend/
├── app.py                      # Punto de entrada en desarrollo: python app.py
├── wsgi.py                     # Producción: waitress-serve wsgi:app
├── simulacion.py               # Verificación, carga de datos demo y prueba de carga
├── requirements.txt            # Dependencias con versión fija
├── requirements-dev.txt        # + pytest, pip-audit, black, ruff
├── pytest.ini · pyproject.toml
├── .env.example                # Plantilla (el .env real NO se sube)
├── app/
│   ├── __init__.py             # Factory crear_app(): extensiones, blueprints, manejadores
│   ├── config.py               # Config desde .env + validación para producción
│   ├── errores.py              # Excepciones de dominio + manejador global
│   ├── seguridad.py            # requiere_rol, limitar, contraseñas, celular
│   ├── horario.py              # Horario 8–18, franjas automáticas, CUPO POR SEDE
│   └── dominios/
│       ├── usuarios/           # login, cuenta propia, admin de usuarios y permisos
│       ├── sedes/ · tramites/  # catálogo
│       ├── franjas/            # franjas y disponibilidad
│       ├── turnos/             # reserva pública + OTP, consulta, sala, predicción
│       ├── agentes/            # ciclo de atención, métricas, despacho.py (EDF)
│       └── auditoria/          # bitácora de acciones sensibles
│           ├── controladores.py   # Blueprints: HTTP de entrada y salida
│           ├── dtos.py            # Validación (Marshmallow) y forma pública de los datos
│           ├── servicios.py       # Reglas de negocio + excepciones del dominio
│           ├── repositorios.py    # Consultas a la base de datos
│           └── modelos.py         # Tablas (SQLAlchemy)
├── migrations/versions/        # 8 migraciones Alembic
├── scripts/                    # create_db.py · generate_secret.py · promover_admin.py
├── tests/                      # conftest.py (fixtures) + pruebas por tema
└── docs/                       # conceptos, validación manual, postman, roadmap, sprints
```

### Flujo de una petición

```
POST /api/v1/sedes/  {"nombre": "Sede Centro"}
   │
   ▼
sedes/controladores.py  ── @requiere_rol("ADMIN")  (rol leído de la BD; 401/403)
   │
   ▼
sedes/servicios.py::crear_punto
   ├── nombre vacío   → raise DatosInvalidosError      → 400
   ├── nombre repetido→ raise SedeDuplicadaError        → 409
   └── ok             → repositorio → MySQL → 201 {"success": true, "punto": {...}}
                          ▲
app/errores.py: un solo manejador traduce cualquier ErrorDeDominio a
{"success": false, "error": "Ya existe una sede con ese nombre."}
```

---

## Contrato de respuesta

| Caso | Cuerpo | Código |
|---|---|---|
| Éxito | `{"success": true, "mensaje"?: "...", ...datos}` | 200 / 201 |
| Datos inválidos | `{"success": false, "error": "...", "detalles"?: {...}}` | 400 |
| Sin sesión o token revocado | `{"success": false, "error": "Debes iniciar sesión."}` | 401 |
| Rol insuficiente | `{"success": false, "error": "No tienes permisos..."}` | 403 |
| No existe | `{"success": false, "error": "La sede no existe."}` | 404 |
| Ya existe o conflicto | `{"success": false, "error": "Ya existe una sede con ese nombre."}` | 409 |
| Demasiados intentos o cuenta bloqueada | `{"success": false, "error": "..."}` | 429 |

Excepciones de dominio (`app/errores.py`): `DatosInvalidosError` (400), `CredencialesInvalidasError` (401), `PermisoDenegadoError` (403), `NoEncontradoError` (404), `ConflictoError` (409), `CuentaBloqueadaError` (429). Cada dominio las especializa, por ejemplo `CorreoYaRegistradoError`, `SedeNoEncontradaError` o `TramiteConTurnosError`.

> Los datos de éxito van en la raíz y no dentro de `"data"`. Es una diferencia deliberada con la referencia, para no romper las pruebas del equipo (ver ADR-0009).

---

## Instalación rápida

```powershell
python -m venv venv ; .\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env ; python scripts\generate_secret.py
python scripts\create_db.py
flask db upgrade
python simulacion.py --cargar          # escribe BORRAR
python app.py                          # http://127.0.0.1:5000/health
```

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `python app.py` | Levanta la API en desarrollo |
| `python -m pytest` | 87 pruebas en SQLite en memoria (no toca tu MySQL) |
| `python -m pytest tests/test_contrato_y_errores.py -v` | Pruebas de un solo tema |
| `ruff check .` · `black .` | Estilo y formato (100 columnas) |
| `pip-audit -r requirements.txt` | Vulnerabilidades en dependencias |
| `python simulacion.py` | 50 verificaciones de punta a punta en memoria |
| `python simulacion.py --cargar [--si] [--desde AAAA-MM-DD --hasta AAAA-MM-DD]` | Borra y carga una semana de TecniVisión |
| `python simulacion.py --borrar` | Solo borra los datos |
| `python simulacion.py --carga --url http://127.0.0.1:5000` | Prueba de carga y de sobrecupo |
| `python scripts/promover_admin.py correo@x.co [ADMIN\|SUPERVISOR\|AGENTE]` | Recupera el acceso de administrador |
| `flask db upgrade` · `flask db history` | Migraciones |

---

## Endpoints (54 rutas bajo `/api/v1`)

**Público.** Límite por IP; el ciudadano no tiene cuenta.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` · `/health/listo` | Proceso vivo · base de datos lista |
| GET | `/api/v1/horario` | Horario, días y reglas de cupo |
| GET | `/api/v1/sedes/` · `/api/v1/tramites/` | Catálogo activo (`?todos=1` para el panel) |
| GET | `/api/v1/franjas/disponibles?sede_id&tramite_id&fecha` | Franjas con cupo de la sede |
| POST | `/api/v1/turnos/publico/solicitar-codigo` | Envía el OTP al celular |
| POST | `/api/v1/turnos/publico/verificar-codigo` | Valida el OTP y devuelve `token_verificacion` |
| POST | `/api/v1/turnos/publico` | Reserva el turno (candado por sede, sin sobrecupo) |
| POST | `/api/v1/turnos/publico/consultar` · `/cancelar` | Consulta o cancela con código + celular |
| GET | `/api/v1/turnos/publico/sala?sede_id` | Pantalla de sala, sin datos personales |

**Cuenta propia** (`Authorization: Bearer <token>`)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/usuarios/login` | Inicia sesión: 401 si las credenciales fallan, 429 si la cuenta está bloqueada |
| GET | `/api/v1/usuarios/me` | Datos de la cuenta |
| POST | `/api/v1/usuarios/me/clave` | Cambia la contraseña (revoca las demás sesiones y entrega un token nuevo) |
| POST | `/api/v1/usuarios/logout` | Revoca todos los tokens de la cuenta al instante |

**Asesor** (`AGENTE`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/agente/panel` | Turno actual, cola de hoy, franja en curso y recomendación |
| GET | `/api/v1/agente/cola` · `/actual` | Cola ordenada por franja · turno en curso |
| POST | `/api/v1/agente/llamar-siguiente` | Llama al siguiente (EDF) |
| POST | `/api/v1/agente/turnos/<id>/{llamar,iniciar,finalizar,no-asistio,devolver}` | Ciclo de atención |

**Administración** (`ADMIN`; `SUPERVISOR` en solo lectura)

| Método | Ruta | Descripción |
|---|---|---|
| POST · PUT · DELETE | `/api/v1/sedes/` · `/api/v1/sedes/<id>` | CRUD de sedes (409 si el nombre se repite; 409 si la sede tiene turnos) |
| POST · PUT · DELETE | `/api/v1/tramites/` · `/api/v1/tramites/<id>` | CRUD de trámites |
| GET · POST · PATCH | `/api/v1/franjas/` · `/api/v1/admin/franjas/` · `/<id>` | Franjas manuales |
| GET | `/api/v1/admin/agentes/metricas[/sedes\|/tramites]` | Indicadores de puntualidad |
| GET | `/api/v1/admin/agentes/en-vivo` · `/historial` | Sedes ahora · historial paginado |
| GET · POST · PUT | `/api/v1/admin/agentes/` · `/<id>` · `/<id>/sede` | Asesores y su sede |
| GET · POST · PUT | `/api/v1/admin/usuarios/` · `/<id>` | Personal, roles y estado (solo ADMIN) |
| POST | `/api/v1/admin/usuarios/<id>/restablecer-clave` | Clave temporal que se muestra una sola vez |
| GET | `/api/v1/admin/usuarios/auditoria` | Bitácora |

**Compatibilidad** (rutas de los primeros sprints, para el rol `CLIENTE` con cuenta): `POST /api/v1/usuarios/registro`, `POST /api/v1/turnos/`, `GET /api/v1/turnos/mis-turnos`, `POST /api/v1/turnos/<id>/cancelar`, `GET /api/v1/turnos/<id>/tiempo-espera`.

La colección completa, con ejemplos y aserciones, está en [`docs/postman/`](docs/postman/README.md).

---

## Pruebas

| Archivo | Qué cubre |
|---|---|
| `conftest.py` | Fixtures compartidos: `app`, `client`, `crear_personal`, `auth`, `admin_auth`, `agente_auth` |
| `test_contrato_y_errores.py` | Formato `success`/`error`, 401/403/404/409/429, revocación inmediata |
| `test_seguridad_y_publico.py` | OTP, consulta y cancelación pública, cabeceras, CORS, catálogo |
| `test_usuarios_permisos.py` | Roles, supervisor de solo lectura, bloqueo, cambio y restablecimiento de clave |
| `test_franjas_turnos.py` · `test_despacho.py` | Disponibilidad, cupo por sede y asistente EDF |
| `test_concurrencia.py` · `test_reservas_concurrentes.py` | Cero sobrecupo con reservas simultáneas |
| `test_rutas_sprints.py` | Que todas las rutas clave estén registradas |
