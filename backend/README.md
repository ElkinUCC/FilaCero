# FilaCero · Backend

API REST de FilaCero hecha con Flask. Es un **monolito modular por capas**: el código está dividido por
dominios (sedes, turnos, agentes, etc.) y cada dominio tiene sus propias capas.

## Estructura

```text
backend/
├── run.py              punto de entrada (python run.py)
├── simulacion.py       datos de ejemplo, simulación en vivo y prueba de carga
├── requirements.txt    dependencias
├── .env.example        plantilla de configuración
├── app/
│   ├── __init__.py     crea la app, registra blueprints y manejadores de error
│   ├── config.py       configuración leída del .env
│   ├── errores.py      excepciones de dominio y formato de error
│   ├── seguridad.py    roles, contraseñas y límite de peticiones
│   ├── tenancy.py      aislamiento por organización
│   ├── horario.py      horario de atención y cupo por sede
│   ├── tiempo.py       hora de Colombia para guardar fechas
│   └── dominios/
│       ├── organizaciones/  usuarios/  sedes/  tramites/  franjas/
│       ├── turnos/  agentes/  equipos/  reclamos/  auditoria/  asistente/
│       └── <dominio>/
│           ├── controladores.py   rutas HTTP (entrada y salida)
│           ├── dtos.py            validación y forma del JSON
│           ├── servicios.py       reglas de negocio
│           ├── repositorios.py    consultas a la base de datos
│           └── modelos.py         tablas (SQLAlchemy)
├── migrations/         migraciones de Alembic
├── scripts/
│   ├── crear_cuenta.py, create_db.py, …   tareas de consola (BD, claves, cuentas, organizaciones)
│   ├── turnos/      otp.py · prediccion.py · preparacion.py · sala.py
│   ├── agentes/     despacho.py · consultas.py · tablero.py
│   └── asistente/   motor.py · contexto.py · llm.py · minichat_reclamos.py
├── tests/              pruebas con pytest
└── docs/postman/       colección de Postman
```

Todas las carpetas de `app/dominios/` tienen **exactamente** la misma estructura (`controladores`, `dtos`,
`modelos`, `repositorios`, `servicios`). La lógica de apoyo que no es una capa —el código OTP, la predicción de
espera, la preparación previa, la pantalla de sala, el despacho de la cola, el tablero ejecutivo y el asistente
FilaCero IA— vive en `scripts/`, y los servicios de cada dominio la invocan. Los dominios que no tienen tablas
propias (`agentes`, `asistente`) declaran en su `modelos.py` las entidades que leen.

La regla que seguimos es que cada capa solo habla con la de abajo: el controlador llama al servicio, el
servicio al repositorio y el repositorio a la base de datos. Hay una prueba
(`tests/test_arquitectura_capas.py`) que revisa que ningún controlador use la base de datos directamente.

## Recorrido de una petición

Ejemplo: crear una sede.

```text
POST /api/v1/sedes/  {"nombre": "Sede Centro"}
  │
  ▼
sedes/controladores.py   @requiere_rol("ADMIN") → 401 / 403 si no aplica
  │
  ▼
sedes/servicios.py       crear_punto()
  ├── nombre vacío     → DatosInvalidosError → 400
  ├── nombre repetido  → SedeDuplicadaError  → 409
  └── todo bien        → repositorio → MySQL → 201 {"success": true, "punto": {...}}

app/errores.py convierte cualquier error de dominio en
{"success": false, "error": "Ya existe una sede con ese nombre."}
```

## Respuestas de la API

| Caso | Código |
|---|---|
| Éxito: `{"success": true, ...datos}` | 200 / 201 |
| Datos inválidos | 400 |
| Sin sesión o token revocado | 401 |
| Rol sin permiso | 403 |
| No existe | 404 |
| Conflicto (dato repetido, sin cupo) | 409 |
| Demasiados intentos o cuenta bloqueada | 429 |

Los errores siempre tienen la forma `{"success": false, "error": "mensaje"}`.

## Instalación

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
python scripts/generate_secret.py
python scripts/create_db.py
flask db upgrade
python simulacion.py --cargar
python run.py
```

La API queda en `http://127.0.0.1:5000`.

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `python run.py` | Inicia la API |
| `python -m pytest` | Corre las pruebas |
| `flask db upgrade` | Aplica las migraciones pendientes |
| `flask --app run routes` | Lista todos los endpoints |
| `python simulacion.py --cargar` | Carga datos de ejemplo |
| `python simulacion.py --en-vivo` | Crea reservas solas mientras se hace la demo |
| `python simulacion.py --carga --url http://127.0.0.1:5000` | Prueba de carga y de sobrecupo |
| `python scripts/crear_cuenta.py correo ROL "Nombre"` | Crea o actualiza una cuenta del personal |
| `ruff check .` y `black .` | Revisión de estilo y formato |

## Endpoints principales

Todos están bajo `/api/v1`.

**Públicos (ciudadano, sin cuenta)**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/sedes/` · `/tramites/` | Catálogo |
| GET | `/franjas/disponibles` | Franjas con cupo de una sede |
| POST | `/turnos/publico/solicitar-codigo` | Pide el código OTP |
| POST | `/turnos/publico/verificar-codigo` | Verifica el código |
| POST | `/turnos/publico` | Reserva el turno |
| POST | `/turnos/publico/consultar` · `/turnos/publico/cancelar` | Consulta o cancela |
| GET | `/turnos/publico/sala` | Pantalla de sala |

**Sesión del personal**

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/usuarios/login` | Inicia sesión (devuelve JWT) |
| GET | `/usuarios/me` | Datos de la cuenta |
| POST | `/usuarios/me/clave` | Cambia la contraseña |
| POST | `/usuarios/logout` | Cierra todas las sesiones |

**Asesor**

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/agente/panel` | Turno actual, cola y recomendación |
| POST | `/agente/llamar-siguiente` | Llama al siguiente turno |
| POST | `/agente/turnos/<id>/{llamar,iniciar,finalizar,no-asistio}` | Ciclo de atención |
| POST | `/agente/turnos/<id>/preparacion` | Avanza la preparación del pedido |
| PUT | `/agente/presencia` | Disponible, pausa, almuerzo o fuera de turno |

**Equipos, reclamos y asistente**

| Método | Ruta | Descripción |
|---|---|---|
| GET · POST | `/equipos/` | Taller de la sede · recibir un equipo |
| PUT | `/equipos/<id>/estado` | Cambia el estado (la entrega pide la cédula) |
| GET · PUT | `/reclamos/` · `/reclamos/<id>` | Bandeja y gestión de reclamos |
| POST | `/asistente/preguntar` | Pregunta al asistente FilaCero IA |

**Administración** (ADMIN; SUPERVISOR solo lectura)

| Método | Ruta | Descripción |
|---|---|---|
| POST · PUT · DELETE | `/sedes/` · `/tramites/` | CRUD del catálogo |
| GET | `/admin/agentes/tablero` · `/historial` · `/en-vivo` | Indicadores, historial y sedes en este momento |
| GET · POST · PUT | `/admin/agentes/` | Asesores y su sede |
| GET · POST · PUT | `/admin/usuarios/` | Personal, roles y estado |
| GET | `/admin/usuarios/auditoria` | Bitácora |

## ¿Dónde se llenan las colas?

La cola **no es una tabla aparte**: es la consulta de los turnos en estado `ESPERANDO` de una sede, ordenados
por la fecha y hora de su franja. Se llena cada vez que se reserva un turno.

| Paso | Frontend | Backend |
|---|---|---|
| 1. El ciudadano reserva (OTP + franja) | `components/cliente/reservarTurno.js` → `publicoApi.reservarTurno()` | `POST /api/v1/turnos/publico` → `turnos/controladores.solicitar_turno_publico` |
| 2. Se crea el turno en la cola | — | `turnos/servicios.crear_turno` guarda el `Turno` con `estado="ESPERANDO"` (con candado por sede para no pasar el cupo) |
| 3. Se arma la cola de la sede | — | `turnos/repositorios.consulta_cola(punto_id)` (la usa `agentes/repositorios`) |
| 4. Se ordena y proyecta la hora | — | `scripts/agentes/despacho.proyectar_cola` y `scripts/agentes/consultas.construir_panel` |
| 5. El asesor la ve | `pages/AgentePage.js` consulta cada 5 s `agenteApi.obtenerPanel()` y la pinta en `colaHTML()` | `GET /api/v1/agente/panel` |
| 6. Sale de la cola | botón **Llamar siguiente** | `POST /api/v1/agente/llamar-siguiente` cambia el turno a `LLAMADO` |

Con datos de ejemplo la cola se llena con `python simulacion.py --cargar` (semana demo) o
`python simulacion.py --en-vivo` (crea reservas solas durante la demo, por la misma API pública).

## Pruebas

Las pruebas usan SQLite en memoria, así que no tocan la base de datos real. Algunas de las más importantes:

| Archivo | Qué prueba |
|---|---|
| `test_contrato_y_errores.py` | Formato de respuesta y códigos 401/403/404/409/429 |
| `test_arquitectura_capas.py` | Que se respeten las capas |
| `test_concurrencia.py` · `test_reservas_concurrentes.py` | Que no haya sobrecupo con reservas simultáneas |
| `test_multiempresa.py` | Que una organización no vea datos de otra |
| `test_seguridad_y_publico.py` | OTP, consulta y cancelación pública |
| `test_usuarios_permisos.py` | Roles, bloqueo de cuenta y cambio de clave |
| `test_despacho.py` | Orden de la cola y recomendación al asesor |
| `test_equipos_reclamos.py` | Equipos, garantía, reclamos y minichat |
