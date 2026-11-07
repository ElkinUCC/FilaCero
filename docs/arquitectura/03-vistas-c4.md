# 03 · Vistas C4

Las tres vistas responden preguntas distintas y **conservan los mismos nombres y límites**:

| Vista | Pregunta | Elementos |
|---|---|---|
| Contexto (C1) | ¿Quién usa FilaCero y con qué sistemas habla? | Actores + sistema FilaCero + sistemas externos |
| Contenedores (C2) | ¿Qué unidades ejecutables/desplegables lo componen? | SPA FilaCero · API FilaCero · Base de datos FilaCero |
| Componentes (C3) | ¿Qué módulos hay dentro de la API y de la SPA? | Módulos de dominio por capas + componentes transversales |

> Los diagramas están en Mermaid (se renderizan en GitHub, VS Code con la extensión *Markdown Preview Mermaid*
> y en mermaid.live). Debajo de cada uno hay una tabla con las mismas relaciones por si el visor no los dibuja.

## C1 · Diagrama de contexto

```mermaid
C4Context
    title FilaCero · Contexto del sistema

    Person(ciudadano, "Ciudadano", "Reserva una franja sin crear cuenta, consulta si su pedido está listo")
    Person(asesor, "Asesor", "Atiende la cola de su sede y prepara pedidos antes de la llegada")
    Person(admin, "Administrador / Supervisor", "Configura sedes, trámites, asesores y permisos; supervisa indicadores")
    Person_Ext(tv, "Público en sala de espera", "Ve y escucha la pantalla de sala (TV con navegador en cada sede)")

    System(filacero, "FilaCero", "Turnos presenciales con franja garantizada y preparación previa")

    System_Ext(sms, "Proveedor SMS", "Entrega el código OTP al celular (simulado en modo prueba)")

    Rel(ciudadano, filacero, "Reserva, consulta y cancela", "HTTPS")
    Rel(asesor, filacero, "Llama, atiende, prepara", "HTTPS")
    Rel(admin, filacero, "Administra y supervisa", "HTTPS")
    Rel(tv, filacero, "Ve el turno llamado (la TV consulta cada 4 s)", "HTTPS")
    Rel(filacero, sms, "Envía código OTP", "HTTPS/API")
```

| Origen | Destino | Interacción |
|---|---|---|
| Ciudadano | FilaCero | Reserva con OTP, consulta estado y preparación, cancela |
| Asesor | FilaCero | Consola: llamar (con voz), iniciar, finalizar, no asistió, preparar pedido |
| Administrador / Supervisor | FilaCero | Panel: resumen en vivo, sedes, trámites, asesores, usuarios, historial, actividad |
| Público en sala (TV) | FilaCero | Lectura pública del turno llamado, módulo y próximos turnos |
| FilaCero | Proveedor SMS | Envío del OTP (en localhost el código se muestra en pantalla: `FILACERO_OTP_TEST_MODE=true`) |

## C2 · Diagrama de contenedores

```mermaid
C4Container
    title FilaCero · Contenedores

    Person(ciudadano, "Ciudadano")
    Person(asesor, "Asesor")
    Person(admin, "Administrador / Supervisor")
    Person_Ext(tv, "Público en sala de espera")

    System_Boundary(fc, "FilaCero") {
        Container(spa, "SPA FilaCero", "React 19 + Vite", "Portal ciudadano, consola del asesor (con llamado por voz), panel administrativo y pantalla de sala")
        Container(api, "API FilaCero", "Python 3.12+, Flask 3, SQLAlchemy 2 · monolito modular por capas", "Reglas de negocio, seguridad, multiempresa, auditoría. REST/JSON en /api/v1")
        ContainerDb(bd, "Base de datos FilaCero", "MySQL 8 (InnoDB)", "Organizaciones, usuarios, sedes, trámites, franjas, turnos, auditoría")
    }

    System_Ext(sms, "Proveedor SMS", "OTP")

    Rel(ciudadano, spa, "Usa", "HTTPS")
    Rel(asesor, spa, "Usa", "HTTPS")
    Rel(admin, spa, "Usa", "HTTPS")
    Rel(tv, spa, "Ve /sala?sede=ID en la TV", "HTTPS")
    Rel(spa, api, "Llama", "JSON/HTTPS · JWT Bearer o X-Organization-Slug")
    Rel(api, bd, "Lee y escribe", "SQL/TCP 3306 · PyMySQL")
    Rel(api, sms, "Envía OTP", "HTTPS")
    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

| Contenedor | Tecnología | Responsabilidad | Se comunica con |
|---|---|---|---|
| **SPA FilaCero** | React 19, Vite, sin librerías de estado ni enrutador externos | Presentación, navegación por History API, guardas de rol, voz (Web Speech API), accesibilidad | API FilaCero (REST JSON) |
| **API FilaCero** | Flask 3, SQLAlchemy 2, Flask-JWT-Extended, Marshmallow, Alembic | Toda regla de negocio y de seguridad; nunca confía en la SPA | Base de datos FilaCero, Proveedor SMS |
| **Base de datos FilaCero** | MySQL 8 / InnoDB, `utf8mb4` | Persistencia transaccional; bloqueos de fila para cupos | — |

Notas de coherencia:
- La **pantalla de sala no es otro contenedor**: es una ruta pública (`/sala?sede=ID`) de la misma SPA, abierta en una TV.
- El **llamado por voz** no es un servicio: es una capacidad del navegador usada por la SPA (ADR-009).
- La API es **un solo proceso desplegable**; los módulos internos se ven en C3.

## C3 · Componentes de la API FilaCero

```mermaid
C4Component
    title API FilaCero · Componentes (monolito modular por capas)

    Container(spa, "SPA FilaCero", "React")
    ContainerDb(bd, "Base de datos FilaCero", "MySQL 8")

    Container_Boundary(api, "API FilaCero") {
        Component(seg, "Seguridad", "app/seguridad.py", "JWT con versión de sesión, requiere_rol, límite de peticiones por IP, hash de contraseñas")
        Component(ten, "Multiempresa", "app/tenancy.py", "Resuelve la organización por JWT o slug y filtra todas las consultas ORM")
        Component(err, "Errores de dominio", "app/errores.py", "Traduce excepciones de dominio a HTTP 400/401/403/404/409")
        Component(hor, "Reglas de horario y capacidad", "app/horario.py", "Horario, franjas de 30 min, cupo = asesores × 3")

        Component(usu, "Usuarios", "dominios/usuarios", "Login, cuentas del personal, roles, módulo de atención, baja lógica")
        Component(sed, "Sedes", "dominios/sedes", "Puntos de atención y su capacidad")
        Component(tra, "Trámites", "dominios/tramites", "Servicios, preguntas de la solicitud, si requieren preparación")
        Component(fra, "Franjas", "dominios/franjas", "Generación y disponibilidad de franjas")
        Component(tur, "Turnos", "dominios/turnos", "Reserva con OTP, consulta pública, sala, preparación previa, predicción de espera")
        Component(age, "Atención y despacho", "dominios/agentes", "Consola del asesor, ciclo LLAMADO → EN_ATENCION → ATENDIDO, asistente de despacho, métricas e historial")
        Component(equ, "Equipos", "dominios/equipos", "Órdenes de servicio de los equipos de los clientes; garantía ≤ 1 año")
        Component(rec, "Reclamos", "dominios/reclamos", "Reclamos en línea o en persona y su respuesta")
        Component(aud, "Auditoría", "dominios/auditoria", "Bitácora de acciones sensibles")
        Component(org, "Organizaciones", "dominios/organizaciones", "Datos de la organización (tenant)")
    }

    Rel(spa, seg, "Toda petición pasa por", "HTTP")
    Rel(seg, ten, "Contexto de organización")
    Rel(age, tur, "Usa preparación y DTO de turnos")
    Rel(age, usu, "Altas, ediciones y bajas de asesores")
    Rel(tur, fra, "Reserva sobre una franja")
    Rel(tur, hor, "Valida capacidad de la sede")
    Rel(fra, hor, "Calcula cupos")
    Rel(tur, usu, "Registra al ciudadano por celular")
    Rel(age, aud, "Registra eventos")
    Rel(tur, equ, "Valida equipo listo / registra garantía")
    Rel(tur, rec, "Vincula el reclamo presencial")
    Rel(equ, usu, "Cliente por celular")
    Rel(usu, aud, "Registra eventos")
    Rel(usu, bd, "SQL")
    Rel(tur, bd, "SQL · FOR UPDATE")
    Rel(age, bd, "SQL")
    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

Cada módulo de dominio repite la misma **estructura por capas**:

| Capa | Archivo | Responsabilidad | Puede depender de |
|---|---|---|---|
| Controlador (presentación HTTP) | `controladores.py`, `admin_controladores.py` | Recibir la petición, validar rol, devolver JSON | Servicios, DTO, Seguridad, Auditoría |
| Servicio (aplicación / negocio) | `servicios.py`, `despacho.py`, `preparacion.py` | Reglas de negocio y transacciones | Repositorios, Modelos, Horario, Errores |
| Repositorio (acceso a datos) | `repositorios.py` | Consultas reutilizables, bloqueos | Modelos |
| Modelo (persistencia) | `modelos.py` | Entidades SQLAlchemy | `TenantScoped` |
| DTO (contrato) | `dtos.py` | Forma pública de los datos (incluye versiones públicas que enmascaran) | Modelos |

## C3 · Componentes de la SPA FilaCero

```mermaid
flowchart LR
    subgraph SPA["SPA FilaCero (React)"]
        direction LR
        R[router/<br/>routes + guards] --> P[pages/<br/>Portal · Agente · Admin · Sala]
        P --> C[components/<br/>cliente · agente · admin · ui]
        P --> H[hooks/<br/>usePolling · useLlamadoPorVoz · useAccesibilidad]
        C --> A[api/*.api.js<br/>un archivo por área]
        H --> A
        A --> X[api/http.js<br/>cliente HTTP único]
        AU[auth/<br/>sesión y permisos] --> R
        AU --> X
    end
    X -->|JSON · JWT| API[(API FilaCero)]
    H -.->|Web Speech API| N[[Navegador]]
```

| Componente SPA | Responsabilidad |
|---|---|
| `router/` | Tabla de rutas y guardas por rol (`/`, `/sala`, `/agente`, `/admin/:seccion`) |
| `pages/` | Una página por vista principal; compone componentes |
| `components/admin/TablaSeccion` + `ui/PanelDetalle` | Patrón uniforme del panel: tabla de 6 columnas (un dato por columna) y detalle al hacer clic |
| `components/agente/PrepararTurno` | Preparación previa del pedido |
| `components/cliente/ReservarTurno` | Asistente de reserva: pasos según el tipo de trámite (entrega, garantía, reclamo, general) |
| `components/agente/Equipos`, `Reclamos`, `Presencia` | Tablero del taller, bandeja de reclamos y estado del asesor en la consola |
| `hooks/useLlamadoPorVoz` | Anuncio y repetición cada 20 s del turno llamado |
| `api/http.js` | Único punto que usa `fetch`: token, slug de organización, errores, aviso de servidor lento |

## Trazabilidad C2 ↔ código ↔ despliegue

| Contenedor | Código | Unidad ejecutable | Nodo (ver [06](06-despliegue.md)) |
|---|---|---|---|
| SPA FilaCero | `frontend/src` | Servidor Vite (`npm run dev`) en demo · `dist/` + nginx en producción | Equipo de demostración |
| API FilaCero | `backend/app` | Proceso Python (`python run.py` o `waitress-serve run:app`) | Equipo de demostración |
| Base de datos FilaCero | `backend/migrations` | Servicio `mysqld` | Equipo de demostración |
