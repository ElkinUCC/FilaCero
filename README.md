# FilaCero

**Plataforma web de gestión y orquestación de turnos presenciales**, con portal ciudadano, consola de asesores, sala de atención y panel administrativo. Esta entrega integra el frontend React con el backend Flask y el núcleo multiempresa validado por la suite automatizada del proyecto.

## Qué incluye

- Portal público para reservar, consultar y cancelar turnos con verificación OTP.
- Consola del asesor para llamar, iniciar y finalizar atenciones.
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

La última ejecución reportada por el equipo para esta entrega fue **117 passed**. Vuelve a ejecutar la suite después de instalar dependencias y aplicar cambios locales.

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

## Roles principales

| Rol | Capacidades |
|---|---|
| Ciudadano | Reservar, consultar y cancelar su turno sin crear cuenta. |
| Agente/asesor | Gestionar la cola y ejecutar el ciclo de atención. |
| Supervisor | Consultar operación e indicadores según permisos. |
| Administrador | Gestionar catálogo, personal, permisos e historial de su organización. |

## Seguridad y configuración

- No subir `backend/.env` ni `frontend/.env` al repositorio.
- `FILACERO_OTP_TEST_MODE=true` es únicamente para desarrollo/pruebas; producción debe usar un proveedor SMS real y desactivar el modo de prueba.
- En producción, configura HTTPS, secretos únicos, CORS restrictivo, base de datos administrada, copias de seguridad y monitoreo.
- No conectar un agente de IA directamente a la base de datos. Las futuras integraciones deben pasar por servicios y herramientas autorizadas con permisos y auditoría.

## Estado y alcance

Esta entrega es una **versión funcional de desarrollo/demo**, no una certificación de seguridad ni una declaración de preparación para producción. La suite de 117 pruebas fue ejecutada en el entorno local del proyecto según el reporte recibido; no se debe interpretar como sustituto de pruebas de integración contra MySQL, pruebas de carga, revisión de dependencias o pentest.

Antes de operar con datos reales se recomienda completar: pruebas de aislamiento multiempresa con MySQL, claves foráneas compuestas para integridad entre tenants, revisión de permisos por endpoint, integración real de SMS, despliegue HTTPS y auditoría de seguridad independiente.
