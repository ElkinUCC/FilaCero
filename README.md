# FilaCero

FilaCero es una aplicación web para gestionar turnos presenciales. El ciudadano reserva su turno desde el
celular sin crear cuenta, el asesor atiende la cola desde su consola, la sala de espera muestra a quién se
está llamando y el administrador ve los indicadores de cada sede.

Lo hicimos como proyecto final de **Arquitectura de Software y Computacional**, usando como caso un centro de
reparación de televisores con varias sedes (TecniVisión).

## Integrantes

- Elkin Amador
- Andrés Reina

## Funcionalidades principales

- Reserva, consulta y cancelación de turnos con verificación del celular por código (OTP).
- Cupos por sede y franja de 30 minutos, sin sobrecupo aunque dos personas reserven al mismo tiempo.
- Consola del asesor: llamar, iniciar, finalizar o marcar "no asistió", con la cola ordenada por urgencia.
- Preparación previa de pedidos (entregas y garantías) y llamado por voz.
- Equipos de clientes, garantías y reclamos con minichat.
- Pantalla de sala de espera para TV.
- Panel administrativo: sedes, trámites, asesores, usuarios y permisos, historial, bitácora y tablero de indicadores.
- Asistente "FilaCero IA" que responde preguntas sobre la operación con los datos reales.

## Tecnologías

| Parte | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript puro (módulos ES) y Bootstrap 5.3. SPA propia, sin React, Angular ni Vue |
| Backend | Python 3.12+, Flask, SQLAlchemy, Flask-Migrate (Alembic), Flask-JWT-Extended y Marshmallow |
| Base de datos | MySQL 8 (las pruebas automáticas usan SQLite en memoria) |
| Pruebas | pytest |

## Estructura del repositorio

```text
FilaCero/
├── backend/        API REST en Flask (monolito modular por capas y dominios)
├── frontend/       SPA en HTML, CSS y JavaScript
└── docs/
    ├── arquitectura/   documento de arquitectura y ADR
    ├── diagramas/      diagramas UML y C4 (fuentes PlantUML + imágenes)
    └── entrega/        Informe_Proyecto_Final_FilaCero.html
```

## Cómo ejecutar el proyecto (Windows)

Se necesita Python 3.12 o superior, MySQL 8 y un navegador moderno (Chrome o Edge para el llamado por voz).

### 1. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

En `backend/.env` se configuran los datos de MySQL (`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`).
Las claves secretas se generan con `python scripts/generate_secret.py`. Después:

```powershell
python scripts/create_db.py
flask db upgrade
python simulacion.py --cargar
python run.py
```

`simulacion.py --cargar` llena la base con datos de ejemplo (sedes, asesores y turnos de los últimos días);
antes de borrar los datos anteriores pide escribir `BORRAR` para confirmar.
La API queda en `http://127.0.0.1:5000`.

### 2. Frontend

En otra terminal:

```powershell
cd frontend
python -m http.server 5173
```

La aplicación queda en `http://localhost:5173`. No hay que instalar nada más: Bootstrap y la fuente están
copiados en `frontend/public/vendor/`, así que funciona sin internet.

### 3. Pruebas

```powershell
cd backend
python -m pytest
```

## Documentación

| Documento | Ubicación |
|---|---|
| Informe del proyecto (fases 01 a 05) | [docs/entrega/Informe_Proyecto_Final_FilaCero.html](docs/entrega/Informe_Proyecto_Final_FilaCero.html) |
| Arquitectura (C4, vistas lógica y física, despliegue, seguridad, riesgos) | [docs/arquitectura/](docs/arquitectura/README.md) |
| Decisiones de arquitectura (ADR) | [docs/arquitectura/adr/](docs/arquitectura/adr/README.md) |
| Diagramas UML | [docs/diagramas/](docs/diagramas/README.md) |
| Backend: capas, endpoints y pruebas | [backend/README.md](backend/README.md) |
| Frontend: estructura de la SPA | [frontend/README.md](frontend/README.md) |
| Colección de Postman | [backend/docs/postman/](backend/docs/postman/README.md) |

## Notas

- El proyecto se ejecuta en localhost. No se publicó en internet.
- No se envían SMS reales: en modo prueba el código OTP aparece en pantalla, y solo para peticiones hechas
  desde el mismo equipo.
- El archivo `backend/.env` no se sube al repositorio; solo `backend/.env.example`.
- Las fechas se guardan en hora de Colombia (America/Bogota).
