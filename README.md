# FilaCero

**Plataforma web de gestión y orquestación de turnos presenciales**, con portal ciudadano, consola de asesores, sala de atención y panel administrativo. Esta entrega integra un frontend SPA en HTML + CSS + JavaScript puro (sin frameworks) con el backend Flask, organizado como monolito modular por capas y dominios, y el núcleo multiempresa validado por la suite automatizada del proyecto.

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
- Frontend: HTML5 + CSS3 + JavaScript puro (módulos ES, `fetch`, rutas `#/`). Sin frameworks ni librerías, sin Node.js ni compilación.
- Base de datos: MySQL 8 (SQLite está disponible para pruebas automatizadas).
- Pruebas: pytest.

## Estructura

```text
FilaCero/
├── backend/                # API Flask: monolito modular por capas y dominios
│   ├── app/
│   │   ├── dominios/       # organizaciones, usuarios, sedes, tramites, franjas, turnos,
│   │   │                   # agentes, equipos, reclamos, auditoria, asistente
│   │   └── seguridad.py · tenancy.py · errores.py · horario.py · config.py
│   ├── migrations/
│   ├── scripts/
│   ├── tests/
│   ├── .env.example
│   └── run.py
├── frontend/               # SPA sin frameworks (HTML + CSS + JS)
│   ├── index.html          # contenedor único #app
│   ├── src/css/
│   ├── src/js/             # main · router · pages · components · api · auth · utils
│   └── public/
└── docs/
    ├── arquitectura/       # documento de arquitectura (01–11) y ADR
    ├── diagramas/          # UML: casos de uso, clases, ER, paquetes, componentes, despliegue, secuencias
    ├── entrega/            # informe de decisiones arquitectónicas (PDF) y guion del video
    └── MANUAL_FilaCero.html
```

## Requisitos

- Python 3.12 o superior (el proyecto también se ha probado localmente con Python 3.14.3).
- Un navegador moderno (Chrome o Edge para el llamado por voz). El frontend no necesita Node.js.
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

### 3. Frontend

Abre otra terminal. El frontend es HTML + CSS + JavaScript puro: no se instala nada ni se compila, solo se sirve la carpeta con un servidor estático (los módulos ES no funcionan abriendo el archivo con doble clic):

```powershell
cd frontend
python -m http.server 5173
```

La interfaz queda disponible en `http://localhost:5173` (también sirve la extensión **Live Server** de VS Code en `http://127.0.0.1:5500`; agrega ese origen a `CORS_ALLOWED_ORIGINS`).

La URL de la API y la organización pública se configuran en `frontend/src/js/config.js`:

```js
export const CONFIG = {
  API_URL: conProxy ? "/api/v1" : "http://127.0.0.1:5000/api/v1",
  ORGANIZATION_SLUG: "filacero-demo",
};
```

`ORGANIZATION_SLUG` debe coincidir con el slug de la organización que atenderá las solicitudes públicas de ese despliegue. El frontend envía ese encabezado (`X-Organization-Slug`) únicamente cuando no hay una sesión autenticada. En sesiones autenticadas, el backend resuelve la organización desde el `org_id` firmado en el JWT.

## Ejecutar las pruebas

Desde `backend/`, con el entorno virtual activo:

```powershell
python -m pytest tests/ -v
```

Última ejecución de esta entrega: **164 passed** (incluye 11 pruebas del asistente IA en `tests/test_asistente_ia.py`). Vuelve a ejecutar la suite después de instalar dependencias y aplicar cambios locales.

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

## Ejecución en localhost (resumen)

FilaCero se ejecuta **solo en localhost**, en un equipo con tres procesos:

| # | Proceso | Comando | Dirección |
|---|---|---|---|
| 1 | MySQL 8 | servicio de MySQL | `localhost:3307` (o el puerto de tu `.env`) |
| 2 | API Flask | `cd backend` · `python run.py` | `http://127.0.0.1:5000` |
| 3 | Frontend | `cd frontend` · `python -m http.server 5173` | `http://localhost:5173` |

Para abrir la pantalla de sala en otro equipo de la misma red (por ejemplo una TV), arranca la API con
`$env:FLASK_HOST="0.0.0.0"; python run.py`, sirve el frontend con `python -m http.server 5173 --bind 0.0.0.0`
y agrega `http://<IP-del-portátil>:5173` a `CORS_ALLOWED_ORIGINS`. El frontend detecta solo la dirección de la API.

## Documentación de arquitectura y evidencias

| Qué | Dónde |
|---|---|
| Documento de arquitectura (problema, atributos, C4, lógica, computacional, despliegue, análisis, trade-offs, riesgos, evolución, seguridad) | [`docs/arquitectura/README.md`](docs/arquitectura/README.md) |
| 16 decisiones de arquitectura (ADR) | [`docs/arquitectura/adr/`](docs/arquitectura/adr/README.md) |
| Diagramas UML (casos de uso, clases, entidad-relación, paquetes, componentes, despliegue y secuencias) | [`docs/diagramas/`](docs/diagramas/README.md) |
| Informe de decisiones arquitectónicas (PDF) y guion del video | [`docs/entrega/`](docs/entrega/) |
| Arquitectura del frontend SPA sin frameworks | [`frontend/docs/ARQUITECTURA-SPA-VANILLA.md`](frontend/docs/ARQUITECTURA-SPA-VANILLA.md) |
| Contrato backend ↔ frontend y colección Postman | [`frontend/docs/CONTRATO-BACKEND-FRONTEND.md`](frontend/docs/CONTRATO-BACKEND-FRONTEND.md), [`backend/docs/postman/`](backend/docs/postman/README.md) |
| Manual metodológico (se abre con doble clic, sin internet) | [`docs/MANUAL_FilaCero.html`](docs/MANUAL_FilaCero.html) |

## Roles principales

| Rol | Capacidades |
|---|---|
| Ciudadano | Reservar, consultar y cancelar su turno sin crear cuenta. |
| Agente/asesor | Gestionar la cola y ejecutar el ciclo de atención. |
| Supervisor | Consultar operación e indicadores según permisos. |
| Administrador | Gestionar catálogo, personal, permisos e historial de su organización. |

## Seguridad y configuración

- No subir `backend/.env` al repositorio; solo se versiona `backend/.env.example`.
- `FILACERO_OTP_TEST_MODE=true`: el código OTP se muestra en pantalla y solo para peticiones hechas desde el mismo equipo (127.0.0.1). No se envían SMS reales (fuera del alcance).
- El depurador de Flask solo se activa si la API escucha en 127.0.0.1.
- Genera secretos propios con `python scripts/generate_secret.py`; CORS solo admite los orígenes de `CORS_ALLOWED_ORIGINS`.
- No conectar un agente de IA directamente a la base de datos. Las futuras integraciones deben pasar por servicios y herramientas autorizadas con permisos y auditoría.

## Estado y alcance

El alcance de la entrega es una **demostración en localhost** (un equipo, sin despliegue en internet), con migraciones, cabeceras de seguridad y 164 pruebas automatizadas. Las pruebas corren sobre SQLite; la concurrencia real se verifica contra MySQL con `python simulacion.py --carga`.

Quedan fuera del alcance (documentados como evolución en `docs/arquitectura/10-evolucion.md`): publicar el sistema en internet, envío real de SMS, HTTPS y alta disponibilidad.
