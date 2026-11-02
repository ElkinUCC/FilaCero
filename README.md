# FilaCero

> **Turnos con atenciÃ³n garantizada dentro de la franja reservada.**
> Si reservas de 4:00 a 4:30 p. m., te atienden en ese intervalo.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1.svg)](https://www.mysql.com/)
[![Pruebas](https://img.shields.io/badge/pruebas-98%20pasando-2E7D32.svg)](backend/tests)
[![SimulaciÃ³n](https://img.shields.io/badge/simulaci%C3%B3n-50%2F50-2E7D32.svg)](backend/simulacion.py)
[![Accesibilidad](https://img.shields.io/badge/WCAG%202.2-AA-0F2A2E.svg)](#accesibilidad)

Proyecto final de **Arquitectura de Software y Computacional** Â· Momento Evaluativo 3.

---

## Contenido

1. [El problema y la propuesta](#el-problema-y-la-propuesta)
2. [QuÃ© puede hacer cada rol](#quÃ©-puede-hacer-cada-rol)
3. [Reglas de negocio](#reglas-de-negocio)
4. [Arquitectura](#arquitectura)
5. [Estructura del repositorio](#estructura-del-repositorio)
6. [TecnologÃ­as](#tecnologÃ­as)
7. [InstalaciÃ³n en localhost](#instalaciÃ³n-en-localhost)
8. [Datos de demostraciÃ³n y simulaciÃ³n](#datos-de-demostraciÃ³n-y-simulaciÃ³n)
9. [Pruebas y verificaciÃ³n](#pruebas-y-verificaciÃ³n)
10. [Seguridad](#seguridad)
11. [Accesibilidad](#accesibilidad)
12. [DocumentaciÃ³n](#documentaciÃ³n)
13. [Estado y prÃ³ximos pasos](#estado-y-prÃ³ximos-pasos)

---

## El problema y la propuesta

Un sistema de turnos tradicional ordena la fila, pero no le dice a nadie **cuÃ¡ndo** lo van a atender. La gente llega temprano "por si acaso", la sala se llena y la espera sigue siendo incierta.

FilaCero parte de una idea simple: **no se vende un cupo que la sede no pueda cumplir.** Cada sede tiene una capacidad real por franja de 30 minutos. El sistema solo acepta reservas hasta ese lÃ­mite, y un asistente le indica al asesor a quiÃ©n atender primero para que nadie se salga de su franja.

**Caso de estudio:** *TecniVisiÃ³n*, un centro de reparaciÃ³n de televisores con **5 sedes**, **2 administradores** y **8 asesores**, que atiende **todos los dÃ­as de 8:00 a 18:00**.

---

## QuÃ© puede hacer cada rol

| Rol | QuÃ© hace | Pantalla |
|---|---|---|
| **Ciudadano** (sin cuenta) | Elige sede, servicio, dÃ­a y hora; verifica su celular con un cÃ³digo; recibe su turno; consulta su estado y lo cancela si no puede ir. | `/` |
| **Asesor** | Atiende la cola de su sede: llama, inicia, finaliza, marca ausencias y devuelve a la cola. Un asistente le recomienda quÃ© hacer. Puede cambiar de sede si rota durante la semana. | `/agente` |
| **Supervisor** | Ve todo el panel en modo solo lectura. | `/admin` |
| **Administrador** | Gestiona sedes, trÃ¡mites, asesores, usuarios y permisos; consulta mÃ©tricas, historial y la bitÃ¡cora de actividad. | `/admin/:seccion` |
| **TV de la sala** | Muestra en grande el turno llamado y con quÃ© asesor acercarse, sin datos personales. | `/sala?sede=1` |

---

## Reglas de negocio

| Regla | Valor | DÃ³nde se configura |
|---|---|---|
| Horario de atenciÃ³n | Todos los dÃ­as, 8:00 â€“ 18:00 | `HORA_APERTURA`, `HORA_CIERRE`, `DIAS_ATENCION` |
| DuraciÃ³n de cada franja | 30 minutos | `DURACION_FRANJA_MIN` |
| AtenciÃ³n mÃ¡xima por persona | 10 minutos | `DURACION_MAX_ATENCION_MIN` |
| **Cupo por asesor y franja** | 30 Ã· 10 = **3 personas** | `CUPOS_POR_ASESOR_FRANJA` (0 = calcular) |
| **Cupo de la sede** | 3 Ã— asesores activos de la sede (todos los trÃ¡mites juntos) | `app/horario.py` |
| Turnos activos por ciudadano | MÃ¡ximo 3 | `turnos/servicios.py` |
| Reservas simultÃ¡neas | Nunca hay sobrecupo: candado por sede + `SELECT â€¦ FOR UPDATE` | `turnos/servicios.py` |

**Ejemplo:** la Sede Centro tiene 2 asesores, asÃ­ que acepta 6 personas por franja. La sÃ©ptima reserva se rechaza aunque elija otro trÃ¡mite.

### Asistente de despacho

La consola del asesor ordena la cola por el **plazo de cada franja** (EDF, *Earliest Deadline First*). Estima cuÃ¡nto dura cada atenciÃ³n a partir del historial y recomienda:

| SituaciÃ³n | RecomendaciÃ³n |
|---|---|
| Hay personas en la franja actual | Llamar a la de plazo mÃ¡s cercano |
| La franja estÃ¡ por vencer | Llamar con prioridad urgente |
| El asesor va adelantado | Tomar una pausa activa corta |
| La franja actual quedÃ³ vacÃ­a | Adelantar a alguien de la siguiente |
| La persona llamada no llega en 3 min | Marcar "no asistiÃ³" |
| La atenciÃ³n pasa de 8 min / 10 min | Alerta amarilla / alerta roja para finalizar |

---

## Arquitectura

**Monolito modular por dominios:** un solo backend, dividido internamente en dominios con lÃ­mites claros. Cada dominio tiene las mismas capas, igual que el proyecto de referencia del curso. El frontend sigue la misma organizaciÃ³n por capas (`api/`, `auth/`, `router/`, `pages/`, `components/`, `utils/`).

```text
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Navegador (React + Vite) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  router/ (rutas y guardas por rol) â†’ pages/ â†’ components/ â†’ api/*.api.js â†’ http.js â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                            â”‚  HTTP + JSON  Â·  Authorization: Bearer <JWT>
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  API Flask  /api/v1                                                                â”‚
â”‚  Controladores (Blueprints) â†’ Servicios (reglas) â†’ Repositorios â†’ Modelos (ORM)    â”‚
â”‚  Transversal: seguridad.py Â· errores.py Â· horario.py Â· config.py Â· auditorÃ­a       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                            â”‚  SQLAlchemy + PyMySQL
                                    â”Œâ”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”
                                    â”‚   MySQL 8     â”‚
                                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Flujo de una reserva

```text
Ciudadano â”€â–º elige sede, servicio y hora   GET  /franjas/disponibles   (cupo de la sede)
          â”€â–º pide cÃ³digo al celular        POST /turnos/publico/solicitar-codigo
          â”€â–º verifica el cÃ³digo            POST /turnos/publico/verificar-codigo â†’ token
          â”€â–º confirma                      POST /turnos/publico
                â””â”€ candado por sede + FOR UPDATE â†’ vuelve a contar el cupo â†’ inserta â†’ 201
Asesor    â”€â–º ve el turno en su cola (se actualiza cada 5 s) y lo atiende
Sala      â”€â–º muestra el llamado en el TV de la sede (cada 4 s)
```

### Contrato de respuesta

| Caso | Respuesta |
|---|---|
| Ã‰xito | `{"success": true, ...datos}` |
| Error | `{"success": false, "error": "mensaje para la persona"}` con 400 Â· 401 Â· 403 Â· 404 Â· 409 Â· 429 |

Los servicios lanzan **errores de dominio** (`SedeDuplicadaError`, `CredencialesInvalidasError`â€¦), y un Ãºnico manejador global (`app/errores.py`) los traduce al cÃ³digo HTTP correcto.

---

## Estructura del repositorio

```text
FilaCero/
â”œâ”€â”€ README.md                     â† este archivo
â”œâ”€â”€ SECURITY.md                   â† amenazas y controles de seguridad
â”œâ”€â”€ backend/                      â† API REST (Flask)
â”‚   â”œâ”€â”€ run.py                    â† punto de entrada: python run.py
â”‚   â”œâ”€â”€ simulacion.py             â† verificaciÃ³n, datos demo, modo en vivo y prueba de carga
â”‚   â”œâ”€â”€ pytest.ini Â· pyproject.toml
â”‚   â”œâ”€â”€ requirements.txt Â· requirements-dev.txt Â· .env.example
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ __init__.py           â† factory crear_app(): blueprints, CORS, JWT, cabeceras
â”‚   â”‚   â”œâ”€â”€ config.py             â† configuraciÃ³n leÃ­da del .env
â”‚   â”‚   â”œâ”€â”€ errores.py            â† excepciones de dominio + manejador global
â”‚   â”‚   â”œâ”€â”€ seguridad.py          â† roles, contraseÃ±as, lÃ­mite de peticiones por IP
â”‚   â”‚   â”œâ”€â”€ horario.py            â† horario, franjas y CUPO POR SEDE
â”‚   â”‚   â””â”€â”€ dominios/
â”‚   â”‚       â”œâ”€â”€ usuarios/         â† acceso, cuenta propia, usuarios y permisos
â”‚   â”‚       â”œâ”€â”€ sedes/ Â· tramites/ â† catÃ¡logo
â”‚   â”‚       â”œâ”€â”€ franjas/          â† franjas y disponibilidad
â”‚   â”‚       â”œâ”€â”€ turnos/           â† reserva pÃºblica con OTP, consulta, sala
â”‚   â”‚       â”œâ”€â”€ agentes/          â† consola, mÃ©tricas, despacho.py (EDF)
â”‚   â”‚       â””â”€â”€ auditoria/        â† bitÃ¡cora
â”‚   â”‚           â””â”€â”€ controladores Â· servicios Â· repositorios Â· modelos Â· dtos
â”‚   â”œâ”€â”€ migrations/versions/      â† 8 migraciones Alembic
â”‚   â”œâ”€â”€ scripts/                  â† create_db Â· generate_secret Â· crear_cuenta Â· promover_admin
â”‚   â”œâ”€â”€ tests/                    â† conftest.py + pruebas por tema
â”‚   â””â”€â”€ docs/                     â† conceptos, validaciÃ³n manual, Postman, roadmap, sprints (HU-01â€¦HU-10)
â””â”€â”€ frontend-react/               â† SPA (React + Vite)
    â”œâ”€â”€ src/
    â”‚   â”œâ”€â”€ api/                  â† http.js + un mÃ³dulo por recurso
    â”‚   â”œâ”€â”€ auth/                 â† session.service.js Â· permissions.js
    â”‚   â”œâ”€â”€ router/               â† routes.jsx Â· guards.js Â· navegacion.js
    â”‚   â”œâ”€â”€ pages/                â† Portal, Admin, Agente, Sala, Cambio de clave, 403, 404
    â”‚   â”œâ”€â”€ components/           â† layout Â· ui Â· cliente Â· admin
    â”‚   â”œâ”€â”€ hooks/                â† usePolling Â· useToast Â· useAccesibilidad
    â”‚   â”œâ”€â”€ utils/                â† formatters Â· storage Â· errorMessages
    â”‚   â””â”€â”€ css/                  â† tokens y estilos por pantalla
    â””â”€â”€ docs/                     â† arquitectura SPA, contrato backend-frontend, validaciÃ³n manual
```

---

## TecnologÃ­as

| Capa | TecnologÃ­a |
|---|---|
| Backend | Python 3.12+, Flask 3.1, Blueprints, Marshmallow |
| Datos | MySQL 8 (SQLite en memoria para las pruebas), SQLAlchemy 2, Alembic / Flask-Migrate |
| Seguridad | Flask-JWT-Extended, hash de Werkzeug, OTP por celular, lÃ­mite de peticiones por IP |
| Frontend | React 19, Vite, CSS propio con *tokens* de diseÃ±o (sin framework de UI) |
| Calidad | pytest, black, ruff, oxlint, axe-core, Postman / newman |

---

## InstalaciÃ³n en localhost

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
| http://localhost:5173/admin | Panel de administraciÃ³n |
| http://localhost:5173/agente | Consola del asesor |
| http://localhost:5173/sala?sede=1 | Pantalla de la sala de espera |

> Si PowerShell bloquea `npm` o el venv, ejecuta una vez:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

---

## Datos de demostraciÃ³n y simulaciÃ³n

Todo se maneja con **un solo archivo**: `backend/simulacion.py`.

| Comando | QuÃ© hace |
|---|---|
| `python simulacion.py --cargar --dias 15` | Borra los datos y carga 15 dÃ­as de operaciÃ³n de TecniVisiÃ³n (unos 500 turnos) mÃ¡s la cola de hoy y maÃ±ana. Tarda unos segundos. |
| `python simulacion.py --en-vivo` | Crea reservas cada ~15 s mientras presentas (`--cada 8` va mÃ¡s rÃ¡pido; Ctrl+C lo detiene). |
| `python simulacion.py` | VerificaciÃ³n de punta a punta en memoria (50 comprobaciones; no toca tu base). |
| `python simulacion.py --borrar` | Solo borra los datos. |
| `python simulacion.py --carga --url http://127.0.0.1:5000` | Prueba de carga y de sobrecupo contra el servidor encendido. |

Las cuentas de demostraciÃ³n (2 administradores y 8 asesores) y sus contraseÃ±as **las imprime `--cargar`** al terminar.

### Cuentas propias protegidas

Para tener cuentas propias que no se borren al recargar la demo:

```powershell
python scripts\crear_cuenta.py correo@filacero.com ADMIN "Nombre Apellido"
python scripts\crear_cuenta.py correo2@filacero.com AGENTE "Nombre Apellido" "Sede Centro"
```

La contraseÃ±a se escribe al ejecutar el script. No queda en ningÃºn archivo; solo se guarda cifrada en la base. Luego agrega los correos al `.env`:

```
CUENTAS_PROTEGIDAS=correo@filacero.com,correo2@filacero.com
```

Esas cuentas no se pueden desactivar ni cambiar de rol desde el panel, y `--cargar` las conserva. El mismo script sirve para **restablecer** la contraseÃ±a de cualquier cuenta y desbloquearla.

---

## Pruebas y verificaciÃ³n

```powershell
cd backend
python -m pytest             # 98 pruebas (SQLite en memoria; no toca MySQL)
python simulacion.py         # 50/50 verificaciones
ruff check . ; black --check .

cd ..\frontend-react
npm run lint ; npm run build
```

| QuÃ© se prueba | Ejemplos |
|---|---|
| Regla de cupo | 1 asesor â†’ mÃ¡ximo 3 por franja; 2 asesores â†’ 6 |
| Concurrencia | 15 reservas simultÃ¡neas con 3 cupos â†’ exactamente 3 aceptadas |
| Asistente de despacho | pausa activa, urgencia, adelantar, no asistiÃ³ a los 3 min, alerta a los 10 min |
| Seguridad | token falso, rol falsificado, bloqueo tras 5 intentos, revocaciÃ³n al cerrar sesiÃ³n, CORS |
| Permisos | el asesor no entra a admin (403); el supervisor no modifica |
| Contrato | `success`, 404 si no existe, 409 si se repite un nombre |

La colecciÃ³n de Postman (`backend/docs/postman/`) recorre las 54 rutas de la API.

---

## Seguridad

- **ContraseÃ±as** guardadas con hash; polÃ­tica de 8+ caracteres con letras y nÃºmeros.
- **JWT de 60 minutos.** El rol se valida contra la base de datos en cada peticiÃ³n: un cambio de rol o una desactivaciÃ³n aplican de inmediato.
- **RevocaciÃ³n inmediata:** cerrar sesiÃ³n o cambiar la contraseÃ±a invalida los tokens anteriores al instante.
- **Bloqueo de cuenta** por 15 minutos tras 5 intentos fallidos, mÃ¡s un lÃ­mite de peticiones por IP.
- **Mensajes genÃ©ricos al iniciar sesiÃ³n**, para no revelar quÃ© correos existen.
- **El ciudadano verifica su celular** con un cÃ³digo de 6 dÃ­gitos (5 intentos, vence en 5 minutos). Nadie puede ver ni cancelar un turno ajeno, y los celulares se muestran enmascarados.
- **BitÃ¡cora de actividad** con usuario, acciÃ³n, fecha e IP.
- **Cabeceras de seguridad** y CORS restringido a los orÃ­genes permitidos.
- **Secretos solo en `.env`**, que no se sube al repositorio.

Detalle completo en [`SECURITY.md`](SECURITY.md).

---

## Accesibilidad

- MenÃº **Accesibilidad** en todas las pantallas: texto grande, alto contraste y **lectura de avisos en voz alta**. Es la Ãºnica opciÃ³n de voz de la app, y en el TV de la sala anuncia cada turno llamado.
- Enlace "Saltar al contenido", navegaciÃ³n completa con teclado, desplegables con patrÃ³n ARIA y ventanas emergentes que mantienen el foco dentro.
- Respeta la preferencia del sistema "reducir movimiento".
- AuditorÃ­a con axe-core: **0 violaciones WCAG 2.2 AA**.

---

## DocumentaciÃ³n

| Documento | Contenido |
|---|---|
| [`backend/README.md`](backend/README.md) | API: estructura, contrato y endpoints |
| [`backend/docs/sprints/`](backend/docs/sprints/README_SPRINTS.md) | **Las 10 historias de usuario** (HU-01â€¦HU-10), con criterios de aceptaciÃ³n, pruebas y capturas |
| [`backend/docs/CONCEPTOS-FUNDAMENTALES.md`](backend/docs/CONCEPTOS-FUNDAMENTALES.md) | Conceptos aplicados en el backend |
| [`backend/docs/VALIDACION-MANUAL.md`](backend/docs/VALIDACION-MANUAL.md) | Lista para comprobar la API a mano |
| [`backend/docs/postman/`](backend/docs/postman/README.md) | ColecciÃ³n y entorno de Postman |
| [`frontend-react/README.md`](frontend-react/README.md) | SPA: capas, rutas y guardas |
| [`frontend-react/docs/`](frontend-react/docs/) | Arquitectura SPA, contrato backend-frontend, validaciÃ³n manual |
| [`SECURITY.md`](SECURITY.md) | Seguridad |

---

## Estado y prÃ³ximos pasos

| Funcionalidad | Estado |
|---|---|
| Reserva sin cuenta con verificaciÃ³n por celular, consulta y cancelaciÃ³n | âœ… |
| Cupo por sede, cero sobrecupo y asistente de despacho | âœ… |
| Consola del asesor con etapas, alertas y rotaciÃ³n de sede | âœ… |
| Panel en vivo, historial, usuarios, permisos y bitÃ¡cora | âœ… |
| Pantalla de sala y accesibilidad | âœ… |
| SimulaciÃ³n de datos y modo en vivo | âœ… |
| Proveedor real de SMS | â³ Pendiente |
| Despliegue en un dominio con HTTPS | â³ Pendiente (por ahora en localhost) |

---

**FilaCero** Â· Proyecto acadÃ©mico Â· Arquitectura de Software y Computacional Â· 2026

