# FilaCero

> Plataforma de turnos presenciales que garantiza la atención dentro de la franja reservada.

[![Python](https://img.shields.io/badge/Python-3.12+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.x-green.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8-orange.svg)](https://www.mysql.com/)

---

## ¿Qué es FilaCero?

**FilaCero** es una aplicación web para gestionar turnos de atención presencial. El ciudadano reserva su turno desde el celular, sin crear una cuenta, y el personal lo atiende desde una consola en la sede.

Los sistemas de turnos comunes ordenan la fila, pero no dicen **cuándo** te van a atender. FilaCero sí lo promete: **si reservas de 4:00 a 4:30 p. m., te atienden en ese intervalo.** Para cumplirlo, cada sede solo acepta las reservas que realmente puede atender.

El proyecto se desarrolla sobre el caso de **TecniVisión**, un centro de reparación de televisores con 5 sedes, 2 administradores y 8 asesores, que atiende todos los días de 8:00 a 18:00.

---

## ¿Cómo funciona?

- La atención se organiza en **franjas de 30 minutos**.
- Cada persona se atiende en **máximo 10 minutos**, así que un asesor puede atender **3 personas por franja**.
- El cupo de una sede es **3 × asesores activos**. Cuando se llena, la franja deja de aparecer disponible.
- Un **asistente de despacho** le indica al asesor a quién llamar primero para que nadie se salga de su franja.

---

## Roles

| Rol | Qué hace |
|---|---|
| **Ciudadano** | Elige sede, servicio y hora; verifica su celular con un código; consulta o cancela su turno. No necesita cuenta. |
| **Asesor** | Llama, atiende y finaliza los turnos de su sede desde la consola de atención. |
| **Supervisor** | Consulta el panel y las métricas, sin poder modificar. |
| **Administrador** | Gestiona sedes, servicios, asesores, usuarios y permisos; ve la operación en vivo y el historial. |

---

## Stack tecnológico

- **Python 3.12+** — Lenguaje del backend
- **Flask 3.x** — API REST
- **Flask-SQLAlchemy** — ORM
- **Flask-Migrate (Alembic)** — Migraciones de la base de datos
- **Flask-JWT-Extended** — Autenticación con tokens JWT
- **Marshmallow** — Validación de datos (DTOs)
- **MySQL 8** — Base de datos
- **React 19 + Vite** — Frontend (SPA)
- **pytest** — Pruebas automatizadas

---

## Arquitectura

FilaCero es un **monolito modular**: un solo backend organizado por **dominios**, donde cada dominio tiene sus propias capas. El frontend es una aplicación aparte que consume la API.

```
┌─────────────────────────┐        HTTP + JSON        ┌─────────────────────────┐        ┌─────────┐
│  Frontend (React)       │  ───────────────────────► │  Backend (Flask API)    │ ─────► │  MySQL  │
│  Ciudadano · Asesor ·   │  ◄─────────────────────── │  /api/v1                │        │         │
│  Administrador · Sala   │       Token JWT           │  Dominios por capas     │        │         │
└─────────────────────────┘                           └─────────────────────────┘        └─────────┘
```

### Backend

```
backend/
├── run.py                          # Punto de entrada
├── requirements.txt                # Dependencias
├── pytest.ini
├── .env.example                    # Plantilla de variables de entorno
├── app/
│   ├── __init__.py                 # Factory: crear_app()
│   ├── config.py                   # Configuración desde .env
│   ├── seguridad.py                # Roles, contraseñas y protección de rutas
│   ├── errores.py                  # Errores de dominio y respuestas de error
│   ├── horario.py                  # Horario, franjas y cupo por sede
│   └── dominios/
│       ├── usuarios/               # Acceso, usuarios y permisos
│       ├── sedes/                  # Puntos de atención
│       ├── tramites/               # Servicios que se pueden reservar
│       ├── franjas/                # Franjas de 30 min y disponibilidad
│       ├── turnos/                 # Reserva, consulta y cancelación
│       ├── agentes/                # Consola del asesor y métricas
│       └── auditoria/              # Registro de actividad
│           ├── controladores.py    # Endpoints (Blueprints)
│           ├── servicios.py        # Lógica de negocio
│           ├── repositorios.py     # Acceso a datos
│           ├── modelos.py          # Modelos SQLAlchemy
│           └── dtos.py             # Validación y serialización
├── migrations/                     # Migraciones de Alembic
├── scripts/                        # Scripts de utilidad
└── tests/                          # Pruebas automatizadas
```

### Frontend

```
frontend-react/src/
├── main.jsx · App.jsx              # Arranque de la aplicación
├── api/                            # Comunicación con la API (un archivo por recurso)
├── auth/                           # Sesión y permisos por rol
├── router/                         # Rutas y guardas de acceso
├── pages/                          # Portal, Administración, Asesor, Sala
├── components/                     # Componentes reutilizables
├── hooks/                          # Lógica compartida (actualización automática, avisos)
├── utils/                          # Formatos y utilidades
└── css/                            # Estilos
```

### Flujo de una petición

```
Frontend (React)
    │
    ▼  api/http.js agrega el token JWT
Blueprint (controlador)
    │
    ▼  valida la entrada con DTO (Marshmallow) y el rol del usuario
Servicio (lógica de negocio)
    │
    ▼  aplica las reglas: cupo por sede, estados del turno
Repositorio (acceso a datos)
    │
    ▼
Base de datos (MySQL)
    │
    ▼
Respuesta JSON  →  {"success": true, ...}  o  {"success": false, "error": "..."}
```

### Base de datos

```
sedes ── 1:N ── franjas ── N:1 ── tramites
  │                │
  │               1:N
  │                │
  └──── 1:N ──── turnos ── N:1 ── usuarios (ciudadano)
                   │
                   └── N:1 ── usuarios (asesor que atiende)

usuarios ── 1:N ── auditoria
```

---

## Ejecutar en local

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # completar los datos de MySQL
flask --app run db upgrade
python run.py                   # http://127.0.0.1:5000

# Frontend
cd frontend-react
npm install
npm run dev                     # http://localhost:5173
```

---

## Documentación

- [`backend/README.md`](backend/README.md) — Detalle de la API
- [`backend/docs/`](backend/docs/) — Sprints, historias de usuario y colección de Postman
- [`frontend-react/README.md`](frontend-react/README.md) — Detalle del frontend

---

**FilaCero** · Proyecto final · Arquitectura de Software y Computacional · 2026
