# FilaCero

**Plataforma web de gestión y orquestación de turnos presenciales**, con portal ciudadano, consola de asesores, sala de atención y panel administrativo. Esta entrega integra el frontend React con el backend Flask y el núcleo multiempresa validado por la suite automatizada del proyecto.

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
- Frontend: React 19 y Vite.
- Base de datos: MySQL 8 (SQLite está disponible para pruebas automatizadas).
- Pruebas: pytest.

## Estructura

```text
FilaCero/
├── docker-compose.yml
├── PRESENTACION.md        # resumen del proyecto y guion para la sustentación
├── backend/
│   ├── app/
│   ├── migrations/
│   ├── scripts/
│   ├── tests/
│   ├── .env.example
│   └── run.py
└── frontend/
    ├── src/
    ├── public/
    ├── .env.example
    └── package.json
```

## Requisitos

- Python 3.12 o superior (el proyecto también se ha probado localmente con Python 3.14.3).
- Node.js 22 LTS o compatible con Vite 8.
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

Abre otra terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

La interfaz queda disponible en `http://localhost:5173`.

En `frontend/.env`, configura:

```env
VITE_API_URL=http://127.0.0.1:5000/api/v1
VITE_ORGANIZATION_SLUG=filacero-demo
```

`VITE_ORGANIZATION_SLUG` debe coincidir con el slug de la organización que atenderá las solicitudes públicas de ese despliegue. El frontend envía ese encabezado únicamente cuando no hay una sesión autenticada. En sesiones autenticadas, el backend resuelve la organización desde el `org_id` firmado en el JWT.

## Ejecutar las pruebas

Desde `backend/`, con el entorno virtual activo:

```powershell
python -m pytest tests/ -v
```

Última ejecución de esta entrega: **168 passed** (incluye 11 pruebas nuevas del asistente IA en `tests/test_asistente_ia.py`). Vuelve a ejecutar la suite después de instalar dependencias y aplicar cambios locales.

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

## Despliegue con Docker

```bash
cp .env.docker.example .env              # DB_PASSWORD y DB_ROOT_PASSWORD
cp backend/.env.example backend/.env     # SECRET_KEY, JWT_SECRET_KEY, CORS_ALLOWED_ORIGINS
docker compose up -d --build             # MySQL + API (waitress) + web (nginx)
```

La API aplica las migraciones al arrancar y se niega a iniciar en producción con secretos débiles, OTP de prueba activo, depuración encendida o CORS abierto. Agrega HTTPS con tu proveedor (o un proxy como Caddy) y activa la cabecera HSTS en `frontend/nginx.conf`.

## Roles principales

| Rol | Capacidades |
|---|---|
| Ciudadano | Reservar, consultar y cancelar su turno sin crear cuenta. |
| Agente/asesor | Gestionar la cola y ejecutar el ciclo de atención. |
| Supervisor | Consultar operación e indicadores según permisos. |
| Administrador | Gestionar catálogo, personal, permisos e historial de su organización. |

## Seguridad y configuración

- No subir `backend/.env` ni `frontend/.env` al repositorio.
- `FILACERO_OTP_TEST_MODE=true` es únicamente para desarrollo local. Para una demo gratuita en producción, puede activarse `FILACERO_OTP_DEMO_ENABLED` con un único celular y código dedicados; no usar con números ni datos reales. La integración con SMS real requiere un proveedor.
- En producción, configura HTTPS, secretos únicos, CORS restrictivo, base de datos administrada, copias de seguridad y monitoreo.
- No conectar un agente de IA directamente a la base de datos. Las futuras integraciones deben pasar por servicios y herramientas autorizadas con permisos y auditoría.

## Estado y alcance

La aplicación está lista para desplegarse (Docker, validación de configuración de producción, migraciones, cabeceras de seguridad y 168 pruebas automatizadas). Las pruebas corren sobre SQLite; no sustituyen pruebas de integración contra MySQL, pruebas de carga, revisión de dependencias ni un pentest.

Antes de operar con datos reales se recomienda completar: pruebas de aislamiento multiempresa con MySQL, claves foráneas compuestas para integridad entre tenants, revisión de permisos por endpoint, integración real de SMS, despliegue HTTPS y auditoría de seguridad independiente.
