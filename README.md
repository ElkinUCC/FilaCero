# FilaCero

> Sistema de turnos con **atención garantizada dentro de la franja reservada**: si reservas de 4:00 a 4:30 p. m., te atienden en ese intervalo.
> Proyecto final de Arquitectura de Software y Computacional (Momento Evaluativo 3).

[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-green.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-87%20passing-brightgreen.svg)](backend/tests)
[![Simulación](https://img.shields.io/badge/Simulaci%C3%B3n-50%2F50-brightgreen.svg)](backend/simulacion.py)
[![WCAG](https://img.shields.io/badge/WCAG%202.2-AA-0f2a2e.svg)](docs/arquitectura/02-atributos-de-calidad.md)

---

## Descripción

**Caso:** *TecniVisión*, centro de reparación de televisores con **5 sedes**, **2 administradores** y **8 asesores**, que atiende **todos los días de 8:00 a 18:00**.

Un sistema de turnos normal ordena la fila, pero no promete *cuándo* te atienden. FilaCero sí lo promete, con tres reglas:

1. **Franjas de 30 minutos y atención de máximo 10 minutos**, es decir, **3 personas por asesor en cada franja**.
2. **El cupo es por sede**: 3 × asesores activos. Nunca se vende más de lo que la sede puede atender, ni siquiera con reservas simultáneas.
3. **Un asistente de despacho** ordena la cola por el plazo de cada franja (EDF) y recomienda llamar, iniciar, finalizar, marcar ausencia o tomar una pausa activa.

| Rol | Qué hace | Pantalla |
|---|---|---|
| Ciudadano (sin cuenta) | Reserva con su celular verificado por código y consulta o cancela su turno | `/` |
| Asesor (`AGENTE`) | Atiende la cola de su sede con el asistente de despacho | `/agente` |
| Supervisor | Ve todo el panel, en modo solo lectura | `/admin` |
| Administrador | Gestiona sedes, trámites, asesores, usuarios, permisos y bitácora | `/admin/:seccion` |
| TV de la sala | Muestra a quién se llama, sin datos personales, y lo anuncia en voz alta | `/sala?sede=1` |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| API | Python 3.12 · Flask 3.1 · Blueprints por dominio · Marshmallow |
| Datos | MySQL 8 (SQLite en memoria para pruebas) · SQLAlchemy 2 · Alembic / Flask-Migrate |
| Seguridad | Flask-JWT-Extended · hash de Werkzeug · rate limit por IP · OTP por celular |
| Frontend | React 19 · Vite · CSS propio con *tokens* (sin framework de UI) |
| Calidad | pytest · black · ruff · oxlint · axe-core (accesibilidad) · Postman/newman |
| Ejecución | waitress (WSGI) · nginx · Docker Compose (despliegue futuro) |

---

## Arquitectura

La arquitectura es un **monolito modular por dominios** (ADR-0001), con la misma organización por capas del proyecto de referencia del curso (ADR-0009). El detalle está en [`docs/arquitectura/`](docs/arquitectura/README.md): C4, 9 ADR, despliegue, riesgos y evolución.

```text
FilaCero/
├── backend/                         # API REST /api/v1
│   ├── app.py                       # Punto de entrada (crear_app)
│   ├── wsgi.py                      # Producción con waitress
│   ├── simulacion.py                # Verificación, datos demo y prueba de carga
│   ├── pytest.ini · pyproject.toml  # pytest · black + ruff
│   ├── requirements.txt · requirements-dev.txt · .env.example
│   ├── app/
│   │   ├── __init__.py              # Factory: blueprints, CORS, JWT, cabeceras
│   │   ├── config.py                # Configuración leída del .env
│   │   ├── errores.py               # Excepciones de dominio + manejador global
│   │   ├── seguridad.py             # Roles, contraseñas, límite por IP
│   │   ├── horario.py               # Horario 8–18, franjas y CUPO POR SEDE
│   │   └── dominios/
│   │       ├── usuarios/  sedes/  tramites/  franjas/
│   │       ├── turnos/              # reserva pública, OTP, consulta, sala
│   │       ├── agentes/             # atención, métricas, despacho.py (EDF)
│   │       └── auditoria/           # bitácora
│   │           └── controladores · servicios · repositorios · modelos · dtos
│   ├── migrations/                  # 8 migraciones Alembic
│   ├── scripts/                     # create_db · generate_secret · promover_admin
│   ├── tests/                       # conftest.py + 9 archivos de prueba
│   └── docs/                        # conceptos, validación manual, postman, roadmap
├── frontend-react/                  # SPA
│   ├── src/
│   │   ├── api/                     # http.js + un módulo por recurso
│   │   ├── auth/                    # session.service.js · permissions.js
│   │   ├── router/                  # routes.jsx · guards.js · navegacion.js
│   │   ├── pages/                   # Portal, Admin, Agente, Sala, 403, 404
│   │   ├── components/ hooks/ utils/ css/
│   └── docs/                        # arquitectura SPA, contrato, validación manual
├── docs/arquitectura/               # Entregable del Momento Evaluativo 3
├── docker-compose.yml · deploy/     # Despliegue en un servidor (para más adelante)
└── SECURITY.md
```

### Flujo de una petición

```text
Navegador ──► router/guards (¿sesión? ¿rol?) ──► página ──► *.api.js ──► http.js
                                                                           │ HTTP + JSON + Bearer
                                                                           ▼
Blueprint (controlador) ──► requiere_rol / limitar ──► DTO (Marshmallow)
        │
        ▼
Servicio (reglas: cupo por sede, OTP, despacho) ──► Repositorio ──► MySQL
        │
        ├── éxito  → {"success": true, ...datos}
        └── ErrorDeDominio → manejador global → {"success": false, "error": "..."} + 400/401/403/404/409/429
```

### Base de datos

```text
puntos (sedes) 1───* franjas *───1 tramites
     │                 │
     │                 1
     │                 *
     └──────────────* turnos *──────── usuarios (cliente y asesor)
usuarios: rol, activo, punto_asignado_id, intentos_fallidos, bloqueado_hasta, version_sesion
auditoria: acción, detalle, usuario, IP, fecha
```

---

## Requisitos previos

- Python 3.12 o superior
- Node.js 20 o superior
- MySQL 8 (en local se usa el puerto `3307`)
- Git

---

## Instalación paso a paso (Windows · PowerShell)

### 1. Backend

```powershell
cd FilaCero\backend
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```

### 2. Variables de entorno

```powershell
copy .env.example .env
python scripts\generate_secret.py      # pega SECRET_KEY y JWT_SECRET_KEY en el .env
```

Completa `DB_USER` y `DB_PASSWORD` en el `.env`. **El `.env` nunca se sube a Git.**

### 3. Base de datos y migraciones

```powershell
python scripts\create_db.py            # crea filacero_db si no existe
flask db upgrade                       # aplica las 8 migraciones
```

### 4. Datos de demostración (una semana simulada)

```powershell
python simulacion.py --cargar --desde 2026-10-25 --hasta 2026-10-30
# Escribe BORRAR y Enter. Al final imprime las cuentas de demostración.
```

Las contraseñas de demostración **no** están en este README. Las imprime ese comando; guárdalas en tu gestor de contraseñas.

### 5. Ejecutar

```powershell
# Terminal 1 (backend)
python app.py                          # http://127.0.0.1:5000

# Terminal 2 (frontend)
cd ..\frontend-react
npm install
npm run dev                            # http://localhost:5173
```

| URL | Pantalla |
|---|---|
| http://localhost:5173/ | Portal del ciudadano |
| http://localhost:5173/?ingresar=1 | Acceso del personal |
| http://localhost:5173/admin | Panel (administrador o supervisor) |
| http://localhost:5173/agente | Consola del asesor |
| http://localhost:5173/sala?sede=1 | Pantalla de la sala de espera |

---

## Verificación

```powershell
cd backend
python -m pytest                       # 87 pruebas (94 con test_mejoras_entrega.py)
python simulacion.py                   # 50 verificaciones de punta a punta (en memoria)
ruff check . ; black --check .         # estilo, con las mismas reglas que la referencia
python simulacion.py --carga --url http://127.0.0.1:5000   # carga y sobrecupo

cd ..\frontend-react
npm run lint ; npm run build
```

- **Postman:** `backend/docs/postman/` tiene 64 peticiones sobre las 54 rutas, con aserciones.
- **Validación manual guiada:** [`backend/docs/VALIDACION-MANUAL.md`](backend/docs/VALIDACION-MANUAL.md) y [`frontend-react/docs/VALIDACION-MANUAL-FRONTEND.md`](frontend-react/docs/VALIDACION-MANUAL-FRONTEND.md).

---

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/arquitectura/`](docs/arquitectura/README.md) | Entregable de arquitectura: requisitos, C4, ADR, despliegue, riesgos, evolución y checklist de la guía 16 |
| [`backend/README.md`](backend/README.md) | API: estructura, contrato, endpoints y comandos |
| [`backend/docs/CONCEPTOS-FUNDAMENTALES.md`](backend/docs/CONCEPTOS-FUNDAMENTALES.md) | Conceptos aplicados en el backend |
| [`frontend-react/README.md`](frontend-react/README.md) | SPA: capas, rutas, guardas y accesibilidad |
| [`frontend-react/docs/CONTRATO-BACKEND-FRONTEND.md`](frontend-react/docs/CONTRATO-BACKEND-FRONTEND.md) | Qué envía y qué recibe cada pantalla |
| [`SECURITY.md`](SECURITY.md) | Amenazas, controles y checklist antes de producción |

---

## Estado del proyecto

| Área | Estado |
|---|---|
| Reserva sin cuenta con OTP, consulta y cancelación | ✅ |
| Cupo por sede y despacho EDF con alertas a los 8 y 10 min | ✅ |
| Consola del asesor, panel en vivo, sala con voz | ✅ |
| Usuarios, permisos, bloqueo de cuenta, revocación inmediata y bitácora | ✅ |
| Accesibilidad WCAG 2.2 AA (axe-core: 0 violaciones) | ✅ |
| Arquitectura alineada con el proyecto de referencia | ✅ (ADR-0009) |
| Proveedor real de SMS y despliegue en dominio | ⏳ Planeado ([roadmap](backend/docs/roadmap/roadmap.md)) |

---

**Proyecto académico** · Arquitectura de Software y Computacional · FilaCero, 2026.
