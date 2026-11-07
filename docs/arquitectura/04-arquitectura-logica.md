# 04 · Arquitectura lógica

## 1. Estilo: monolito modular por capas

FilaCero es **un solo proceso backend** dividido en **módulos de dominio** (corte vertical por negocio) y,
dentro de cada módulo, **capas** (corte horizontal por responsabilidad). La SPA es un contenedor aparte que
solo conoce la API pública `/api/v1`.

```mermaid
flowchart TB
    subgraph Presentacion["Capa de presentación"]
        SPA["SPA FilaCero<br/>pages · components · hooks"]
        CTRL["Controladores HTTP (Blueprints Flask)<br/>usuarios · sedes · tramites · franjas · turnos · agentes · organizaciones"]
    end
    subgraph Aplicacion["Capa de aplicación / negocio"]
        SERV["Servicios de dominio<br/>reservar · despachar · preparar · dar de baja · rotar sede"]
        REG["Reglas transversales<br/>horario y capacidad · errores de dominio"]
    end
    subgraph Datos["Capa de acceso a datos"]
        REPO["Repositorios<br/>consultas y bloqueos FOR UPDATE"]
        MOD["Modelos SQLAlchemy + TenantScoped"]
    end
    subgraph Transversal["Transversales"]
        SEG["Seguridad: JWT, roles, límites"]
        TEN["Multiempresa"]
        AUD["Auditoría"]
    end
    BD[("Base de datos FilaCero<br/>MySQL 8")]

    SPA -- "REST/JSON" --> CTRL
    CTRL --> SERV
    SERV --> REG
    SERV --> REPO
    REPO --> MOD
    MOD --> BD
    CTRL -.-> SEG
    CTRL -.-> AUD
    MOD -.-> TEN
```

### Reglas de dependencia

1. Las dependencias van **hacia abajo**: controlador → servicio → repositorio → modelo. Nunca al revés.
2. Un módulo usa a otro **a través de su servicio o DTO**, no de su controlador (p. ej. *Atención y despacho*
   usa `turnos.preparacion` y `usuarios.servicios.dar_de_baja`).
3. Las reglas de capacidad viven en **un solo lugar** (`app/horario.py`); reserva, disponibilidad, despacho y
   panel las consultan, no las duplican.
4. Las excepciones de dominio (`DatosInvalidosError`, `ConflictoError`, `NoEncontradoError`…) se lanzan en la
   capa de servicio y se traducen a HTTP en un único manejador (`app/errores.py`).
5. Los DTO definen el contrato: `turno_response` (personal) y `turno_publico_response` (ciudadano, sin IDs
   internos y con celular enmascarado) son representaciones distintas de la misma entidad.

> **Deuda técnica declarada**: algunos endpoints de métricas e historial del panel (`agentes/controladores.py`)
> construyen consultas en el controlador. Funcionan y están probados, pero violan la regla 1. Se registran
> como riesgo R-07 en [09](09-tradeoffs-riesgos.md) con su plan de corrección (mover a `agentes/repositorios.py`).

## 2. Módulos, responsabilidades y límites

| Módulo | Responsabilidad | Dueño de las tablas | No debe |
|---|---|---|---|
| `organizaciones` | Tenant: nombre, slug, zona horaria | `organizaciones` | Conocer turnos |
| `usuarios` | Identidad del personal y del ciudadano por celular; roles; **módulo de atención**; **baja lógica** | `usuarios` | Decidir cupos |
| `sedes` | Puntos de atención; capacidad visible para el panel | `puntos` | Gestionar asesores |
| `tramites` | Catálogo de servicios, preguntas de la solicitud, **si requiere preparación** | `tramites` | Reservar |
| `franjas` | Franjas de 30 min y disponibilidad | `franjas` | Modificar turnos |
| `turnos` | Reserva pública con OTP, consulta, cancelación, sala, **preparación previa**, predicción de espera | `turnos` | Autenticar personal |
| `agentes` (Atención y despacho) | Ciclo de atención, asistente de despacho, consola, métricas, historial | — (usa `turnos`, `usuarios`) | Crear turnos |
| `equipos` | Órdenes de servicio de los equipos de los clientes; reglas de garantía (≤ 1 año) y de entrega (solo LISTO y del mismo celular) | `equipos` | Conocer el despacho |
| `reclamos` | Radicar, gestionar y responder reclamos | `reclamos` | Reservar turnos (lo hace `turnos`) |
| `auditoria` | Bitácora de acciones sensibles | `auditoria` | Interrumpir la operación si falla (registro "best effort") |

## 3. Ciclo de vida del turno (con preparación previa)

```mermaid
stateDiagram-v2
    [*] --> ESPERANDO: reserva con OTP
    ESPERANDO --> CANCELADO: el ciudadano cancela (OTP)
    ESPERANDO --> LLAMADO: el asesor llama (voz cada 20 s)
    LLAMADO --> ESPERANDO: devolver a la cola
    LLAMADO --> EN_ATENCION: iniciar
    LLAMADO --> NO_ASISTIO: 3 min sin llegar
    EN_ATENCION --> ATENDIDO: finalizar (≤ 10 min)
    ATENDIDO --> [*]
    CANCELADO --> [*]
    NO_ASISTIO --> [*]

    state ESPERANDO {
        [*] --> PENDIENTE: trámite con preparación
        PENDIENTE --> EN_PREPARACION
        EN_PREPARACION --> LISTO
        EN_PREPARACION --> NOVEDAD: falta algo (mensaje obligatorio)
        NOVEDAD --> LISTO
        LISTO --> PENDIENTE: deshacer
    }
```

La preparación es **ortogonal** al estado de atención: se puede preparar mientras el turno está en espera,
llamado o en atención, y queda registrada (quién, cuándo, mensaje) para el historial.

## 4. Integración

### 4.1 SPA ↔ API (síncrona, REST/JSON)

| Aspecto | Decisión |
|---|---|
| Versionado | Prefijo `/api/v1` en todos los recursos |
| Autenticación | `Authorization: Bearer <JWT>` para personal; `X-Organization-Slug` para peticiones públicas |
| Errores | JSON uniforme `{"error": "...", "success": false}` con código HTTP semántico (400/401/403/404/409/429) |
| Actualización en vivo | Polling: sala 4 s, consola 5 s, asesores 10 s, resumen 15 s, historial/usuarios/portal 20 s, catálogo 30 s |
| Cliente único | `frontend/src/api/http.js` (ningún componente usa `fetch` directamente) |

Endpoints agregados en la entrega final:

| Método y ruta | Rol | Propósito |
|---|---|---|
| `POST /api/v1/agente/turnos/{id}/preparacion` | AGENTE | Cambiar estado de preparación (`EN_PREPARACION`, `LISTO`, `NOVEDAD`, `PENDIENTE`) con mensaje |
| `DELETE /api/v1/admin/agentes/{id}` | ADMIN | Baja definitiva (lógica) de un asesor |
| `DELETE /api/v1/admin/usuarios/{id}` | ADMIN | Baja definitiva (lógica) de cualquier cuenta del personal |
| `POST /api/v1/equipos/publico/mios` | Ciudadano (OTP) | Sus equipos y su nombre registrado |
| `GET/POST /api/v1/equipos/`, `PUT /equipos/{id}/estado` | AGENTE (lectura también panel) | Taller de la sede: recibir y avanzar equipos. Registrar exige `cliente_documento`; pasar a `ENTREGADO` (o de `POR_RECIBIR` a `RECIBIDO`) exige `documento` y debe coincidir (iteración 3) |
| `GET /api/v1/admin/agentes/tablero?dias\|desde&hasta&punto_id` | ADMIN, SUPERVISOR (solo lectura) | Tablero ejecutivo: KPI del periodo y del anterior, serie diaria, demanda por hora, por sede y trámite, taller y reclamos (iteración 3) |
| `POST /api/v1/turnos/publico/consultar` y `/cancelar` | Ciudadano (OTP) | Aceptan el código completo, el visible `TU-XXXXXX` o los 6 caracteres; la verificación se valida **antes** de buscar (iteración 3) |
| `POST /api/v1/reclamos/publico`, `POST /reclamos/publico/mios` | Ciudadano (OTP) | Radicar y consultar reclamos |
| `GET /api/v1/reclamos/`, `PUT /reclamos/{id}` | AGENTE (lectura también panel) | Bandeja y respuesta |
| `PUT /api/v1/agente/presencia` | AGENTE | Disponible, pausa, almuerzo, fuera de turno |
| `POST /api/v1/turnos/publico` (ampliado) | Ciudadano (OTP) | Acepta `equipo_id` (entrega), `garantia{marca, fecha_compra, falla}` o `reclamo_id` según el tipo de trámite |

Campos agregados (cambios aditivos, compatibles): `modulo` en usuarios y sala; `requiere_preparacion` en
trámites; `preparacion` y `agente_modulo` en turnos; `asesores_activos` y `cupos_por_franja` en sedes (solo
para el panel); `resumen.por_preparar` en la consola.

### 4.2 API ↔ Proveedor SMS

Interfaz `turnos/otp.py`. En localhost (`FILACERO_OTP_TEST_MODE=true`) el código se devuelve en la respuesta
para la demostración; en producción la app **se niega a arrancar** si el modo prueba está activo
(`validar_configuracion`).

### 4.3 SPA ↔ Navegador (Web Speech API)

El anuncio por voz no pasa por el servidor: `hooks/useLlamadoPorVoz.js` construye la frase
("Turno 1 2 0 4 8 9. *Nombre completo*, por favor acercarse al Módulo 2") y usa `speechSynthesis`. Ver ADR-009.

## 5. Persistencia

```mermaid
erDiagram
    ORGANIZACIONES ||--o{ USUARIOS : tiene
    ORGANIZACIONES ||--o{ PUNTOS : tiene
    ORGANIZACIONES ||--o{ TRAMITES : tiene
    PUNTOS ||--o{ FRANJAS : ofrece
    TRAMITES ||--o{ FRANJAS : ofrece
    FRANJAS ||--o{ TURNOS : contiene
    USUARIOS ||--o{ TURNOS : "reserva (ciudadano)"
    USUARIOS ||--o{ TURNOS : "atiende (asesor)"
    USUARIOS ||--o{ TURNOS : "prepara (asesor)"
    PUNTOS ||--o{ USUARIOS : "sede asignada"
    USUARIOS ||--o{ AUDITORIA : genera
    USUARIOS ||--o{ EQUIPOS : "es dueño (cliente)"
    PUNTOS ||--o{ EQUIPOS : recibe
    EQUIPOS |o--o{ TURNOS : "se entrega en"
    USUARIOS ||--o{ RECLAMOS : radica
    RECLAMOS |o--o{ TURNOS : "se sigue en"

    USUARIOS {
        int id PK
        int organizacion_id FK
        string nombre
        string correo UK
        string celular
        string rol "ADMIN|SUPERVISOR|AGENTE|CLIENTE"
        bool activo
        int punto_asignado_id FK
        string modulo "nuevo"
        string presencia "iteración 2"
        string documento "iteración 3 · cédula"
        datetime eliminado_en "nuevo · baja lógica"
        int version_sesion
    }
    TRAMITES {
        int id PK
        string nombre
        json campos_solicitud
        int tiempo_estimado
        bool requiere_preparacion "nuevo"
    }
    TURNOS {
        int id PK
        string codigo UK
        string estado
        json respuestas_solicitud
        int franja_id FK
        int agente_id FK
        string estado_preparacion "nuevo"
        text nota_preparacion "nuevo"
        datetime fecha_preparacion "nuevo"
        int preparado_por_id FK "nuevo"
        int equipo_id FK "iteración 2"
        int reclamo_id FK "iteración 2"
    }
    EQUIPOS {
        int id PK
        string codigo UK
        int cliente_id FK
        int punto_id FK
        string marca
        string origen "REPARACION|GARANTIA"
        date fecha_compra
        string estado "POR_RECIBIR..ENTREGADO"
    }
    RECLAMOS {
        int id PK
        string radicado UK
        int cliente_id FK
        string categoria
        bool presencial
        string estado "RADICADO|EN_GESTION|RESUELTO"
        text respuesta
    }
```

| Aspecto | Decisión y justificación |
|---|---|
| Motor | MySQL 8 InnoDB: transacciones ACID y bloqueo de fila, necesarios para RAR-01 (ADR-003) |
| Aislamiento | `READ COMMITTED` en MySQL (ADR-004 revisado) |
| Esquema | Versionado con Alembic: 13 migraciones encadenadas; las nuevas `a7c9e1b3d5f7` y `b8d0f2a4c6e9` son **aditivas** (tablas nuevas y columnas nulas o con valor por defecto) y reversibles |
| Multiempresa | Columna `organizacion_id` en cada tabla de negocio + filtro automático del ORM (ADR-006) |
| Integridad histórica | Nada que tenga turnos se borra físicamente: sedes y trámites se desactivan; cuentas se dan de baja lógica (ADR-011) |
| Pruebas | SQLite en memoria para la suite automatizada; la suite de concurrencia real se ejecuta contra MySQL con `simulacion.py --carga` |

## 6. Aspectos transversales

| Aspecto | Dónde | Cómo |
|---|---|---|
| Autenticación | `seguridad.py`, `usuarios/servicios.py` | JWT de 60 min con claim `ver` (versión de sesión) y `org_id` |
| Autorización | `@requiere_rol(...)` | Verifica el rol **vigente en base de datos**, no solo el del token |
| Límite de peticiones | `@limitar(...)` | Ventana por IP en memoria (login, OTP, público) |
| Auditoría | `auditoria/servicios.registrar` | Login, cambios de cuentas, catálogo, rotación de sede, preparación, bajas, equipos, reclamos y presencia |
| Accesibilidad | `useAccesibilidad`, CSS | Texto grande, alto contraste, lector de pantalla (`aria-live`), voz |
| Configuración | `config.py` + `.env` | Validación estricta si `FLASK_ENV=production` |
