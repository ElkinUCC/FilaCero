# FilaCero

**Plataforma web de gestión y orquestación de turnos presenciales**, con portal ciudadano, consola de asesores, sala de atención y panel administrativo. Esta entrega integra un frontend en **HTML, CSS y JavaScript puro (sin frameworks)** con el backend Flask y el núcleo multiempresa validado por la suite automatizada del proyecto.

## Qué incluye

- Portal público para reservar, consultar y cancelar turnos con verificación OTP (diseño pensado primero para celular: la consulta muestra una lista a la vez y el detalle del turno aparece arriba, sin desplazarse).
- Consola del asesor para llamar, iniciar y finalizar atenciones, con asistente de despacho, jornada del día y cola ordenada por urgencia.
- **Asistente FilaCero IA**: chat en el panel administrativo (analista de operación) y en la consola del asesor (copiloto). Responde en lenguaje natural con los datos reales, muestra indicadores, propone acciones con un clic (llamar, alistar, abrir sección) y acepta dictado por voz. Funciona sin internet con un motor local y, opcionalmente, redacta con Claude si se configura `ANTHROPIC_API_KEY`.
- Diseño responsive revisado para celular (360 px en adelante), tableta y computador: tablas que pasan a tarjetas, KPIs sin recortes y menús adaptables.
- Vista de sala para mostrar turnos llamados.
- Panel administrativo con resumen operativo, sedes, trámites, asesores, usuarios, historial y actividad.
- Backend organizado por dominios: organizaciones, usuarios, sedes, trámites, franjas, turnos, agentes y auditoría.
- Aislamiento multiempresa a nivel de contexto HTTP y consultas/escrituras ORM.
- Migraciones Alembic y scripts de provisión de organizaciones y cuentas.

## Tecnologías

- Backend: Python, Flask, SQLAlchemy, Flask-Migrate, Flask-JWT-Extended, Marshmallow.
- Frontend: HTML5 + CSS3 + JavaScript puro (módulos ES, `fetch`, SPA con rutas `#/`) con **Bootstrap 5.3** (CSS local). **Sin frameworks de interfaz; sin Node.js ni compilación.**
- Base de datos: MySQL 8 (SQLite está disponible para pruebas automatizadas).
- Pruebas: pytest.

## Estructura

```text
FilaCero/
├── backend/                       # API Flask · monolito modular por capas en dominios
│   ├── app/
│   │   ├── __init__.py            # crear_app: extensiones, blueprints, errores
│   │   ├── config.py · seguridad.py · tenancy.py · errores.py · horario.py
│   │   └── dominios/<dominio>/    # usuarios, sedes, tramites, franjas, turnos, agentes,
│   │       ├── controladores.py   #   equipos, reclamos, asistente, auditoria, organizaciones
│   │       ├── dtos.py
│   │       ├── servicios.py
│   │       ├── repositorios.py
│   │       └── modelos.py
│   ├── migrations/                # Alembic (esquema MySQL)
│   ├── scripts/ · tests/ · simulacion.py · run.py
│   └── .env.example
├── frontend/                      # HTML + CSS + JavaScript puro
│   ├── index.html                 # contenedor único (#app)
│   ├── public/                    # favicon
│   └── src/
│       ├── css/                   # estilos por pantalla
│       └── js/
│           ├── main.js            # punto de entrada: render() según la ruta
│           ├── config.js          # URL de la API y organización
│           ├── router/            # routes.js · guards.js · navegacion.js
│           ├── pages/             # XPage() + mountXPage() por ruta
│           ├── components/        # cliente · agente · admin · ui · layout
│           ├── api/               # http.js (fetch) + un *.api.js por recurso
│           ├── auth/              # session.service.js · permissions.js
│           └── utils/             # dom.js · formatters.js · polling.js · voz.js…
└── docs/
    ├── diagramas/                 # UML: casos de uso, clases, ER, paquetes, arquitectura…
    ├── arquitectura/              # documento de arquitectura y ADR
    └── entrega/                   # guion del video y lista de entrega
```

## Requisitos

- Python 3.12 o superior (el proyecto también se ha probado localmente con Python 3.14.3).
- Un navegador moderno (Chrome, Edge o Firefox). El frontend **no necesita Node.js**.
- Para servir el frontend: la extensión *Live Server* de VS Code, o Python (`python -m http.server`).
- MySQL 8 para persistencia local. Para pruebas automatizadas se usa SQLite en memoria.

## Instalación en Windows (PowerShell)

### 1. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

Edita `backend/.env` y configura `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` y `DB_NAME`. Genera secretos nuevos para tu entorno; no reutilices claves de ejemplo ni compartas el `.env`.

```powershell
python scripts/generate_secret.py
flask --app run db upgrade
python run.py
```

La API queda disponible en `http://127.0.0.1:5000`.

> Si ya tienes una base de datos de FilaCero con las migraciones aplicadas, conserva tu `.env` y ejecuta `flask --app run db upgrade` para aplicar únicamente migraciones pendientes. No borres la base de datos.

### 2. Organización y cuenta administrativa

La migración inicial crea la organización demo `filacero-demo`. Para crear otra organización:

```powershell
python scripts/crear_organizacion.py --nombre "Mi Empresa" --slug mi-empresa --industria general --pais CO --zona-horaria America/Bogota --idioma es --moneda COP
```

El comando informa el ID asignado. Usa ese ID para crear el administrador:

```powershell
python scripts/crear_cuenta.py admin@miempresa.com ADMIN "Administrador" --organizacion-id 2
```

Cambia `2` por el ID real que devolvió el primer comando. La contraseña se solicita de forma interactiva y no se guarda en texto plano.

Si ya creaste tu organización y cuenta en tu base de datos local, **no repitas estos comandos**.

### 3. Frontend (HTML + CSS + JavaScript puro)

No hay que instalar nada. Abre otra terminal y sirve la carpeta `frontend` con un servidor estático (los módulos de JavaScript no funcionan abriendo el archivo con doble clic):

```powershell
cd frontend
python -m http.server 5173
```

La interfaz queda disponible en `http://localhost:5173`. También puedes abrir `frontend/index.html` con **Live Server** de VS Code (`http://127.0.0.1:5500`).

La configuración está en `frontend/src/js/config.js`:

```js
API_URL: "http://127.0.0.1:5000/api/v1",   // backend Flask
ORGANIZATION_SLUG: "filacero-demo",        // organización de las reservas públicas
```

`ORGANIZATION_SLUG` debe coincidir con el slug de la organización que atenderá las solicitudes públicas. El frontend envía ese encabezado únicamente cuando no hay una sesión autenticada; con sesión, el backend resuelve la organización desde el `org_id` firmado en el JWT.

> El origen desde el que abres el frontend debe estar en `CORS_ALLOWED_ORIGINS` de `backend/.env`, por ejemplo:
> `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5500,http://127.0.0.1:5500`

### Rutas del frontend

| URL | Pantalla | Quién |
|---|---|---|
| `#/` | Portal: reservar y consultar turno | Ciudadano (sin cuenta) |
| `#/?ingresar=1` | Acceso del personal | Asesor, supervisor, administrador |
| `#/agente` | Consola del asesor | Asesor |
| `#/admin/resumen` … `#/admin/actividad` | Panel administrativo | Administrador y supervisor |
| `#/sala?sede=1` | Pantalla de la sala de espera (TV) | Público |

### Diagramas y documentación de la entrega

- Diagramas UML (PNG, SVG y fuente PlantUML): [`docs/diagramas/`](../../docs/diagramas/README.md)
- Documento de arquitectura y ADR: [`docs/arquitectura/`](../../docs/arquitectura/README.md)
- Informe del proyecto y guion del video: [`docs/entrega/`](../../docs/entrega/)

## Ejecutar las pruebas

Desde `backend/`, con el entorno virtual activo:

```powershell
python -m pytest tests/ -v
```

Última ejecución de esta entrega: **222 passed, 1 skipped** (incluye 11 pruebas del asistente IA y 58 de arquitectura de capas). Vuelve a ejecutar la suite después de instalar dependencias y aplicar cambios locales.

## Simulación de operación

Desde `backend/`:

```powershell
python simulacion.py
```

Consulta las opciones disponibles antes de cargar datos:

```powershell
python simulacion.py --help
```

Los comandos de carga/borrado pueden modificar datos de la base. Úsalos solo en una base de pruebas y revisa las opciones de confirmación antes de ejecutarlos.

## Asistente FilaCero IA

| Dónde | Quién | Qué responde |
|---|---|---|
| Panel `/admin` (botón «FilaCero IA») | Administrador y supervisor | Resumen del periodo, puntualidad, asistencia, cancelaciones, hora pico, sedes (por nombre), trámites, taller, reclamos, asesores en vivo, proyección de mañana y recomendaciones priorizadas. |
| Consola `/agente` (botón «Copiloto IA») | Asesor | Quién sigue, qué hacer ahora, quién está en riesgo, qué alistar, cómo va su jornada, cuánto queda de la franja y el detalle de una persona por su nombre. |

- API: `GET /api/v1/asistente/sugerencias` y `POST /api/v1/asistente/preguntar` (requieren sesión; el rol sale del token).
- **Motor local** (por defecto): entiende español natural sin tildes ni signos, detecta varias intenciones por pregunta y entidades (sede, trámite, persona), y responde con cifras reales, fichas de indicadores, botones de acción y preguntas de seguimiento.
- **Modo Claude** (opcional): con `ANTHROPIC_API_KEY` en `backend/.env`, Claude redacta la respuesta a partir de los mismos datos. Se envían solo indicadores y primeros nombres (sin celulares, cédulas ni apellidos). Si el proveedor falla o tarda, responde el motor local.
- El asistente no tiene acceso directo a la base de datos: reutiliza los servicios del tablero, la vista en vivo y la consola, con el mismo aislamiento multiempresa y permisos.

## Ejecución en localhost

FilaCero se ejecuta **solo en localhost**: MySQL 8, la API (`python run.py`, puerto 5000) y el frontend servido como archivos estáticos (`python -m http.server 5173`). No hay despliegue en internet.

## Roles principales

| Rol | Capacidades |
|---|---|
| Ciudadano | Reservar, consultar y cancelar su turno sin crear cuenta. |
| Agente/asesor | Gestionar la cola y ejecutar el ciclo de atención. |
| Supervisor | Consultar operación e indicadores según permisos. |
| Administrador | Gestionar catálogo, personal, permisos e historial de su organización. |

## Seguridad y configuración

- No subir `backend/.env` al repositorio (el frontend no guarda secretos).
- `FILACERO_OTP_TEST_MODE=true`: el código OTP se muestra en pantalla, solo para peticiones desde el mismo equipo; no se envían SMS reales.
- Genera secretos propios con `python scripts/generate_secret.py`; CORS solo admite los orígenes de `CORS_ALLOWED_ORIGINS`.
- No conectar un agente de IA directamente a la base de datos. Las futuras integraciones deben pasar por servicios y herramientas autorizadas con permisos y auditoría.

## Estado y alcance

El alcance de la entrega es una **demostración en localhost** (un equipo), con migraciones, cabeceras de seguridad y 222 pruebas automatizadas. Las pruebas corren sobre SQLite; la concurrencia real se verifica contra MySQL con `python simulacion.py --carga`.

Quedan fuera del alcance (documentados como evolución): publicar el sistema en internet, envío real de SMS, HTTPS y alta disponibilidad.
