# FilaCero

> **Turnos con atención garantizada dentro de la franja reservada.**
> Si reservas de 4:00 a 4:30 p. m., te atienden en ese intervalo.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1.svg)](https://www.mysql.com/)
[![Pruebas](https://img.shields.io/badge/pruebas-98%20pasando-2E7D32.svg)](backend/tests)
[![Simulación](https://img.shields.io/badge/simulaci%C3%B3n-50%2F50-2E7D32.svg)](backend/simulacion.py)
[![Accesibilidad](https://img.shields.io/badge/WCAG%202.2-AA-0F2A2E.svg)](#accesibilidad)

Proyecto final de **Arquitectura de Software y Computacional** · Momento Evaluativo 3.

---

## Contenido

1. [El problema y la propuesta](#el-problema-y-la-propuesta)
2. [Qué puede hacer cada rol](#qué-puede-hacer-cada-rol)
3. [Reglas de negocio](#reglas-de-negocio)
4. [Arquitectura](#arquitectura)
5. [Estructura del repositorio](#estructura-del-repositorio)
6. [Tecnologías](#tecnologías)
7. [Instalación en localhost](#instalación-en-localhost)
8. [Datos de demostración y simulación](#datos-de-demostración-y-simulación)
9. [Pruebas y verificación](#pruebas-y-verificación)
10. [Seguridad](#seguridad)
11. [Accesibilidad](#accesibilidad)
12. [Documentación](#documentación)
13. [Estado y próximos pasos](#estado-y-próximos-pasos)

---

## El problema y la propuesta

Un sistema de turnos tradicional ordena la fila, pero no le dice a nadie **cuándo** lo van a atender. La gente llega temprano "por si acaso", la sala se llena y la espera sigue siendo incierta.

FilaCero parte de una idea simple: **no se vende un cupo que la sede no pueda cumplir.** Cada sede tiene una capacidad real por franja de 30 minutos. El sistema solo acepta reservas hasta ese límite, y un asistente le indica al asesor a quién atender primero para que nadie se salga de su franja.

**Caso de estudio:** *TecniVisión*, un centro de reparación de televisores con **5 sedes**, **2 administradores** y **8 asesores**, que atiende **todos los días de 8:00 a 18:00**.

---

## Qué puede hacer cada rol

| Rol | Qué hace | Pantalla |
|---|---|---|
| **Ciudadano** (sin cuenta) | Elige sede, servicio, día y hora; verifica su celular con un código; recibe su turno; consulta su estado y lo cancela si no puede ir. | `/` |
| **Asesor** | Atiende la cola de su sede: llama, inicia, finaliza, marca ausencias y devuelve a la cola. Un asistente le recomienda qué hacer. Puede cambiar de sede si rota durante la semana. | `/agente` |
| **Supervisor** | Ve todo el panel en modo solo lectura. | `/admin` |
| **Administrador** | Gestiona sedes, trámites, asesores, usuarios y permisos; consulta métricas, historial y la bitácora de actividad. | `/admin/:seccion` |
| **TV de la sala** | Muestra en grande el turno llamado y con qué asesor acercarse, sin datos personales. | `/sala?sede=1` |

---

## Reglas de negocio

| Regla | Valor | Dónde se configura |
|---|---|---|
| Horario de atención | Todos los días, 8:00 – 18:00 | `HORA_APERTURA`, `HORA_CIERRE`, `DIAS_ATENCION` |
| Duración de cada franja | 30 minutos | `DURACION_FRANJA_MIN` |
| Atención máxima por persona | 10 minutos | `DURACION_MAX_ATENCION_MIN` |
| **Cupo por asesor y franja** | 30 ÷ 10 = **3 personas** | `CUPOS_POR_ASESOR_FRANJA` (0 = calcular) |
| **Cupo de la sede** | 3 × asesores activos de la sede (todos los trámites juntos) | `app/horario.py` |
| Turnos activos por ciudadano | Máximo 3 | `turnos/servicios.py` |
| Reservas simultáneas | Nunca hay sobrecupo: candado por sede + `SELECT … FOR UPDATE` | `turnos/servicios.py` |

**Ejemplo:** la Sede Centro tiene 2 asesores, así que acepta 6 personas por franja. La séptima reserva se rechaza aunque elija otro trámite.

### Asistente de despacho

La consola del asesor ordena la cola por el **plazo de cada franja** (EDF, *Earliest Deadline First*). Estima cuánto dura cada atención a partir del historial y recomienda:

| Situación | Recomendación |
|---|---|
| Hay personas en la franja actual | Llamar a la de plazo más cercano |
| La franja está por vencer | Llamar con prioridad urgente |
| El asesor va adelantado | Tomar una pausa activa corta |
| La franja actual quedó vacía | Adelantar a alguien de la siguiente |
| La persona llamada no llega en 3 min | Marcar "no asistió" |
| La atención pasa de 8 min / 10 min | Alerta amarilla / alerta roja para finalizar |

---

## Arquitectura

**Monolito modular por dominios:** un solo backend, dividido internamente en dominios con límites claros. Cada dominio tiene las mismas capas, igual que el proyecto de referencia del curso. El frontend sigue la misma organización por capas (`api/`, `auth/`, `router/`, `pages/`, `components/`, `utils/`).

```text
┌──────────────────────────── Navegador (React + Vite) ────────────────────────────┐
│  router/ (rutas y guardas por rol) → pages/ → components/ → api/*.api.js → http.js │
└───────────────────────────────────────────┬───────────────────────────────────────┘
                                            │  HTTP + JSON  ·  Authorization: Bearer <JWT>
┌───────────────────────────────────────────▼───────────────────────────────────────┐
│  API Flask  /api/v1                                                                │
│  Controladores (Blueprints) → Servicios (reglas) → Repositorios → Modelos (ORM)    │
│  Transversal: seguridad.py · errores.py · horario.py · config.py · auditoría       │
└───────────────────────────────────────────┬───────────────────────────────────────┘
                                            │  SQLAlchemy + PyMySQL
                                    ┌───────▼───────┐
                                    │   MySQL 8     │
                                    └───────────────┘
```

### Flujo de una reserva

```text
Ciudadano ─► elige sede, servicio y hora   GET  /franjas/disponibles   (cupo de la sede)
          ─► pide código al celular        POST /turnos/publico/solicitar-codigo
          ─► verifica el código            POST /turnos/publico/verificar-codigo → token
          ─► confirma                      POST /turnos/publico
                └─ candado por sede + FOR UPDATE → vuelve a contar el cupo → inserta → 201
Asesor    ─► ve el turno en su cola (se actualiza cada 5 s) y lo atiende
Sala      ─► muestra el llamado en el TV de la sede (cada 4 s)
```

### Contrato de respuesta

| Caso | Respuesta |
|---|---|
| Éxito | `{"success": true, ...datos}` |
| Error | `{"success": false, "error": "mensaje para la persona"}` con 400 · 401 · 403 · 404 · 409 · 429 |

Los servicios lanzan **errores de dominio** (`SedeDuplicadaError`, `CredencialesInvalidasError`…), y un único manejador global (`app/errores.py`) los traduce al código HTTP correcto.

---

## Estructura del repositorio

```text
FilaCero/
├── README.md                     ← este archivo
├── SECURITY.md                   ← amenazas y controles de seguridad
├── backend/                      ← API REST (Flask)
│   ├── run.py                    ← punto de entrada: python run.py
│   ├── simulacion.py             ← verificación, datos demo, modo en vivo y prueba de carga
│   ├── pytest.ini · pyproject.toml
│   ├── requirements.txt · requirements-dev.txt · .env.example
│   ├── app/
│   │   ├── __init__.py           ← factory crear_app(): blueprints, CORS, JWT, cabeceras
│   │   ├── config.py             ← configuración leída del .env
│   │   ├── errores.py            ← excepciones de dominio + manejador global
│   │   ├── seguridad.py          ← roles, contraseñas, límite de peticiones por IP
│   │   ├── horario.py            ← horario, franjas y CUPO POR SEDE
│   │   └── dominios/
│   │       ├── usuarios/         ← acceso, cuenta propia, usuarios y permisos
│   │       ├── sedes/ · tramites/ ← catálogo
│   │       ├── franjas/          ← franjas y disponibilidad
│   │       ├── turnos/           ← reserva pública con OTP, consulta, sala
│   │       ├── agentes/          ← consola, métricas, despacho.py (EDF)
│   │       └── auditoria/        ← bitácora
│   │           └── controladores · servicios · repositorios · modelos · dtos
│   ├── migrations/versions/      ← 8 migraciones Alembic
│   ├── scripts/                  ← create_db · generate_secret · crear_cuenta · promover_admin
│   ├── tests/                    ← conftest.py + pruebas por tema
│   └── docs/                     ← conceptos, validación manual, Postman, roadmap, sprints (HU-01…HU-10)
└── frontend-react/               ← SPA (React + Vite)
    ├── src/
    │   ├── api/                  ← http.js + un módulo por recurso
    │   ├── auth/                 ← session.service.js · permissions.js
    │   ├── router/               ← routes.jsx · guards.js · navegacion.js
    │   ├── pages/                ← Portal, Admin, Agente, Sala, Cambio de clave, 403, 404
    │   ├── components/           ← layout · ui · cliente · admin
    │   ├── hooks/                ← usePolling · useToast · useAccesibilidad
    │   ├── utils/                ← formatters · storage · errorMessages
    │   └── css/                  ← tokens y estilos por pantalla
    └── docs/                     ← arquitectura SPA, contrato backend-frontend, validación manual
```

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Backend | Python 3.12+, Flask 3.1, Blueprints, Marshmallow |
| Datos | MySQL 8 (SQLite en memoria para las pruebas), SQLAlchemy 2, Alembic / Flask-Migrate |
| Seguridad | Flask-JWT-Extended, hash de Werkzeug, OTP por celular, límite de peticiones por IP |
| Frontend | React 19, Vite, CSS propio con *tokens* de diseño (sin framework de UI) |
| Calidad | pytest, black, ruff, oxlint, axe-core, Postman / newman |

---

## Instalación en localhost

**Requisitos:** Python 3.12+, Node.js 20+, MySQL 8 (en el puerto `3307`) y Git.

### 1. Backend (PowerShell)

```powershell
cd backend
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

copy .env.example .env
python scripts\generate_secret.py      # pega SECRET_KEY y JWT_SECRET_KEY en el .env
# En el .env completa DB_USER y DB_PASSWORD

python scripts\create_db.py            # crea filacero_db si no existe
flask --app run db upgrade             # aplica las migraciones
python run.py                          # API en http://127.0.0.1:5000
```

### 2. Frontend (otra terminal)

```powershell
cd frontend-react
npm install
npm run dev                            # http://localhost:5173
```

| URL | Pantalla |
|---|---|
| http://localhost:5173/ | Portal del ciudadano |
| http://localhost:5173/?ingresar=1 | Acceso del personal |
| http://localhost:5173/admin | Panel de administración |
| http://localhost:5173/agente | Consola del asesor |
| http://localhost:5173/sala?sede=1 | Pantalla de la sala de espera |

> Si PowerShell bloquea `npm` o el venv, ejecuta una vez:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

---

## Datos de demostración y simulación

Todo se maneja con **un solo archivo**: `backend/simulacion.py`.

| Comando | Qué hace |
|---|---|
| `python simulacion.py --cargar --dias 15` | Borra los datos y carga 15 días de operación de TecniVisión (unos 500 turnos) más la cola de hoy y mañana. Tarda unos segundos. |
| `python simulacion.py --en-vivo` | Crea reservas cada ~15 s mientras presentas (`--cada 8` va más rápido; Ctrl+C lo detiene). |
| `python simulacion.py` | Verificación de punta a punta en memoria (50 comprobaciones; no toca tu base). |
| `python simulacion.py --borrar` | Solo borra los datos. |
| `python simulacion.py --carga --url http://127.0.0.1:5000` | Prueba de carga y de sobrecupo contra el servidor encendido. |

Las cuentas de demostración (2 administradores y 8 asesores) y sus contraseñas **las imprime `--cargar`** al terminar.

### Cuentas propias protegidas

Para tener cuentas propias que no se borren al recargar la demo:

```powershell
python scripts\crear_cuenta.py correo@filacero.com ADMIN "Nombre Apellido"
python scripts\crear_cuenta.py correo2@filacero.com AGENTE "Nombre Apellido" "Sede Centro"
```

La contraseña se escribe al ejecutar el script. No queda en ningún archivo; solo se guarda cifrada en la base. Luego agrega los correos al `.env`:

```
CUENTAS_PROTEGIDAS=correo@filacero.com,correo2@filacero.com
```

Esas cuentas no se pueden desactivar ni cambiar de rol desde el panel, y `--cargar` las conserva. El mismo script sirve para **restablecer** la contraseña de cualquier cuenta y desbloquearla.

---

## Pruebas y verificación

```powershell
cd backend
python -m pytest             # 98 pruebas (SQLite en memoria; no toca MySQL)
python simulacion.py         # 50/50 verificaciones
ruff check . ; black --check .

cd ..\frontend-react
npm run lint ; npm run build
```

| Qué se prueba | Ejemplos |
|---|---|
| Regla de cupo | 1 asesor → máximo 3 por franja; 2 asesores → 6 |
| Concurrencia | 15 reservas simultáneas con 3 cupos → exactamente 3 aceptadas |
| Asistente de despacho | pausa activa, urgencia, adelantar, no asistió a los 3 min, alerta a los 10 min |
| Seguridad | token falso, rol falsificado, bloqueo tras 5 intentos, revocación al cerrar sesión, CORS |
| Permisos | el asesor no entra a admin (403); el supervisor no modifica |
| Contrato | `success`, 404 si no existe, 409 si se repite un nombre |

La colección de Postman (`backend/docs/postman/`) recorre las 54 rutas de la API.

---

## Seguridad

- **Contraseñas** guardadas con hash; política de 8+ caracteres con letras y números.
- **JWT de 60 minutos.** El rol se valida contra la base de datos en cada petición: un cambio de rol o una desactivación aplican de inmediato.
- **Revocación inmediata:** cerrar sesión o cambiar la contraseña invalida los tokens anteriores al instante.
- **Bloqueo de cuenta** por 15 minutos tras 5 intentos fallidos, más un límite de peticiones por IP.
- **Mensajes genéricos al iniciar sesión**, para no revelar qué correos existen.
- **El ciudadano verifica su celular** con un código de 6 dígitos (5 intentos, vence en 5 minutos). Nadie puede ver ni cancelar un turno ajeno, y los celulares se muestran enmascarados.
- **Bitácora de actividad** con usuario, acción, fecha e IP.
- **Cabeceras de seguridad** y CORS restringido a los orígenes permitidos.
- **Secretos solo en `.env`**, que no se sube al repositorio.

Detalle completo en [`SECURITY.md`](SECURITY.md).

---

## Accesibilidad

- Menú **Accesibilidad** en todas las pantallas: texto grande, alto contraste y **lectura de avisos en voz alta**. Es la única opción de voz de la app, y en el TV de la sala anuncia cada turno llamado.
- Enlace "Saltar al contenido", navegación completa con teclado, desplegables con patrón ARIA y ventanas emergentes que mantienen el foco dentro.
- Respeta la preferencia del sistema "reducir movimiento".
- Auditoría con axe-core: **0 violaciones WCAG 2.2 AA**.

---

## Documentación

| Documento | Contenido |
|---|---|
| [`backend/README.md`](backend/README.md) | API: estructura, contrato y endpoints |
| [`backend/docs/sprints/`](backend/docs/sprints/README.md) | **Las 10 historias de usuario** (HU-01…HU-10), con criterios de aceptación, pruebas y capturas |
| [`backend/docs/CONCEPTOS-FUNDAMENTALES.md`](backend/docs/CONCEPTOS-FUNDAMENTALES.md) | Conceptos aplicados en el backend |
| [`backend/docs/VALIDACION-MANUAL.md`](backend/docs/VALIDACION-MANUAL.md) | Lista para comprobar la API a mano |
| [`backend/docs/postman/`](backend/docs/postman/README.md) | Colección y entorno de Postman |
| [`frontend-react/README.md`](frontend-react/README.md) | SPA: capas, rutas y guardas |
| [`frontend-react/docs/`](frontend-react/docs/) | Arquitectura SPA, contrato backend-frontend, validación manual |
| [`SECURITY.md`](SECURITY.md) | Seguridad |

---

## Estado y próximos pasos

| Funcionalidad | Estado |
|---|---|
| Reserva sin cuenta con verificación por celular, consulta y cancelación | ✅ |
| Cupo por sede, cero sobrecupo y asistente de despacho | ✅ |
| Consola del asesor con etapas, alertas y rotación de sede | ✅ |
| Panel en vivo, historial, usuarios, permisos y bitácora | ✅ |
| Pantalla de sala y accesibilidad | ✅ |
| Simulación de datos y modo en vivo | ✅ |
| Proveedor real de SMS | ⏳ Pendiente |
| Despliegue en un dominio con HTTPS | ⏳ Pendiente (por ahora en localhost) |

---

**FilaCero** · Proyecto académico · Arquitectura de Software y Computacional · 2026
