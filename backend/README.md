# FilaCero API

> API REST de FilaCero: reservas con cupo garantizado por sede, consola de atención con despacho EDF, panel de supervisión y seguridad por roles.

[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-green.svg)](https://flask.palletsprojects.com/)
[![Tests](https://img.shields.io/badge/Tests-222%20passing-brightgreen.svg)](tests)
[![Code style](https://img.shields.io/badge/code%20style-black%20%2B%20ruff-000000.svg)](pyproject.toml)

---

## Arquitectura

La API está organizada **por dominios**. Cada dominio tiene sus propias capas, igual que en el proyecto de referencia:

```
backend/
├── run.py                      # Punto de entrada: python run.py
├── simulacion.py               # Verificación, carga de datos demo y prueba de carga
├── requirements.txt            # Dependencias con versión fija
├── requirements-dev.txt        # + pytest, pip-audit, black, ruff
├── pytest.ini · pyproject.toml
├── .env.example                # Plantilla (el .env real NO se sube)
├── app/
│   ├── __init__.py             # Factory crear_app(): extensiones, blueprints, manejadores
│   ├── config.py               # Config desde .env (localhost)
│   ├── errores.py              # Excepciones de dominio + manejador global
│   ├── seguridad.py            # requiere_rol, limitar, contraseñas, celular
│   ├── horario.py              # Horario demo 24/7, franjas automáticas, CUPO POR SEDE
│   └── dominios/
│       ├── organizaciones/     # contexto multiempresa, configuración y aislamiento
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
├── migrations/versions/        # 9 migraciones Alembic
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

### Verificación OTP en localhost

FilaCero no envía SMS reales. Con `FILACERO_OTP_TEST_MODE=true` (valor por defecto) la API genera el código
de 6 dígitos y lo devuelve en la respuesta **solo** si la petición viene del mismo equipo (127.0.0.1); el
portal lo muestra en pantalla para completar la demostración.

---

## Instalación rápida

```powershell
python -m venv venv ; .\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env ; python scripts\generate_secret.py
python scripts\create_db.py
flask db upgrade
python simulacion.py --cargar          # escribe BORRAR; en BD remota exige confirmación extra
python run.py                          # http://127.0.0.1:5000
```

En una SQLite local nueva, la simulación crea el esquema inicial. Para bases
existentes (incluida SQLite) y MySQL, ejecuta `flask db upgrade` antes de usar
`--cargar` o `--en-vivo`; ambos modos operan sobre la organización configurada en
`DEFAULT_ORGANIZATION_SLUG`.

## Núcleo multiempresa (primera entrega)

- Cada registro operativo pertenece a una organización mediante `organizacion_id`.
- El contexto se obtiene del claim firmado `org_id` del JWT para usuarios autenticados.
- Las rutas públicas reciben `X-Organization-Slug`; si no se envía, usan `DEFAULT_ORGANIZATION_SLUG`.
- El ORM aplica filtros de organización automáticamente a consultas y operaciones masivas, y valida las escrituras.
- El slug del frontend se configura en `ORGANIZATION_SLUG` de `frontend/src/js/config.js`.
- La migración `f6b8c0d2e4a6` crea `organizaciones`, registra `filacero-demo` y asigna los datos existentes a esa organización.
- Las sesiones anteriores a esta versión deben renovarse porque los JWT ahora incluyen `org_id`.

### Migrar y crear una organización

```powershell
flask db upgrade
python scripts\crear_organizacion.py --nombre "Cooperativa Norte" --slug cooperativa-norte --industria cooperativa --pais CO --zona-horaria America/Bogota --idioma es --moneda COP
python scripts\crear_cuenta.py admin@cooperativa.com ADMIN "Admin Cooperativa" --organizacion-id 2
```

El segundo comando crea la cuenta administradora en el tenant indicado; reemplaza `2` por el ID que informó el primer comando. Configura el frontend de esa organización con:

```env
ORGANIZATION_SLUG: "cooperativa-norte"   // frontend/src/js/config.js
```

`CUENTAS_PROTEGIDAS` evita que la simulación cambie o elimine esas cuentas, pero
no asigna una contraseña inicial ni recupera una contraseña desconocida. Para
establecer una contraseña nueva, vuelve a ejecutar `scripts\crear_cuenta.py`
con el mismo correo, rol y `--organizacion-id`; el script solicita la contraseña
de forma interactiva y actualiza la cuenta existente.

`X-Organization-Slug` selecciona el tenant en rutas públicas; en sesiones autenticadas el servidor siempre prioriza el `org_id` firmado en el JWT y rechaza un slug distinto. No se deben enviar secretos en `configuracion` de la organización: las credenciales de integraciones requieren un almacén de secretos.

**Límite conocido de esta entrega:** cada cuenta de usuario pertenece a una sola organización. La membresía de un mismo usuario en varias organizaciones, los roles por organización, la provisión self-service, los dominios personalizados y el aislamiento reforzado mediante claves foráneas compuestas quedan para la siguiente fase. No se debe anunciar esta versión como certificada ni como lista para datos regulados sin una auditoría de seguridad y pruebas de integración MySQL.

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `python run.py` | Levanta la API en desarrollo |
| `python -m pytest tests/ -v` | Ejecuta la suite automatizada (222 aprobadas y 1 omitida en la última ejecución) |
| `python -m pytest tests/test_contrato_y_errores.py -v` | Pruebas de un solo tema |
| `ruff check .` · `black .` | Estilo y formato (100 columnas) |
| `pip-audit -r requirements.txt` | Vulnerabilidades en dependencias |
| `python simulacion.py` | 50 verificaciones de punta a punta en memoria |
| `python simulacion.py --cargar [--si] [--desde AAAA-MM-DD --hasta AAAA-MM-DD]` | Reemplaza datos operativos del tenant y carga datos demo |
| `python simulacion.py --borrar` | Solo borra los datos operativos del tenant |
| `python simulacion.py --en-vivo --cada 10 --por-ciclo 3` | Crea y atiende automáticamente hasta 3 reservas demo cada 10 segundos; no toma turnos ajenos |
| `python simulacion.py --en-vivo --solo-reservas` | Crea reservas sin atención automática |
| `python simulacion.py --carga --url http://127.0.0.1:5000` | Prueba de carga y de sobrecupo |
| `python simulacion.py --cuentas [--probar-clave] [--desbloquear]` | Revisa las cuentas de `CUENTAS_PROTEGIDAS`: si existen, su rol, si están bloqueadas y (opcional) si la contraseña coincide |
| `python scripts/promover_admin.py correo@x.co [ADMIN\|SUPERVISOR\|AGENTE]` | Recupera el acceso de administrador |
| `flask db upgrade` · `flask db history` | Migraciones |

`--en-vivo` es una simulación interactiva para la demostración en localhost:
conecta directamente a la base configurada, crea turnos y puede cambiar el estado
de los asesores demo. Para supervisar la operación, usa `#/admin/resumen`: consulta
el estado de atención de cada sede y se actualiza cada 15 segundos.

---

## Endpoints (54 rutas bajo `/api/v1`)

**Público.** Límite por IP; el ciudadano no tiene cuenta.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` · `/health/listo` | Proceso vivo · base de datos lista |
| GET | `/api/v1/horario` | Horario demo 24/7, días y reglas de cupo |
| GET | `/api/v1/sedes/` · `/api/v1/tramites/` | Catálogo activo (`?todos=1` para el panel) |
| GET | `/api/v1/franjas/disponibles?sede_id&tramite_id&fecha` | Franjas con cupo de la sede |
| POST | `/api/v1/turnos/publico/solicitar-codigo` | Envía el OTP al celular |
| POST | `/api/v1/turnos/publico/verificar-codigo` | Valida el OTP; `proposito` (`reserva`, `consulta`, `cancelacion`) y `codigo_turno` vinculan el permiso a la operación |
| POST | `/api/v1/turnos/publico` | Reserva el turno y devuelve un permiso temporal de consulta para ese turno |
| POST | `/api/v1/turnos/publico/consultar` · `/cancelar` | Requiere código, celular y permiso OTP reciente del propósito/código correspondiente |
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
