# 02 · Atributos de calidad prioritarios

La prioridad se fijó con una pregunta: **¿qué atributo, si falla, rompe la promesa de FilaCero?**
Cada atributo se expresa como escenario medible (fuente → estímulo → entorno → respuesta → medida) y se
enlaza con la decisión que lo atiende.

## 1. Priorización

| Prioridad | Atributo | Por qué ocupa ese lugar |
|---|---|---|
| 1 | **Consistencia / integridad** de cupos y turnos | Si se sobrevende una franja, la promesa "te atienden en tu franja" es falsa |
| 2 | **Seguridad** (autenticación, autorización, privacidad) | Datos personales y acciones administrativas; exigencia legal (Ley 1581) |
| 3 | **Usabilidad y accesibilidad** | Ciudadanos de toda edad; la sala y la voz son parte del servicio |
| 4 | **Rendimiento** (latencia percibida) | La consola del asesor y la sala deben sentirse en vivo |
| 5 | **Mantenibilidad / modificabilidad** | Proyecto académico que fue creciendo con cada revisión del docente |
| 6 | **Disponibilidad** | Importante en operación real; en la demo se acepta un nodo |
| 7 | **Costo** | Restricción dura: sin presupuesto de infraestructura |
| 8 | **Escalabilidad** | Hoy 4 sedes; se analiza el crecimiento como escenario de evolución |

## 2. Escenarios de calidad

### QA-1 · Consistencia de cupos (prioridad 1)

| Elemento | Valor |
|---|---|
| Fuente | 18 ciudadanos distintos |
| Estímulo | Reservan **al mismo tiempo** la misma franja que tiene 6 cupos |
| Entorno | Operación normal, servidor con hilos concurrentes, MySQL/InnoDB |
| Artefacto | `turnos.servicios.crear_turno` |
| Respuesta | Se aceptan exactamente los cupos libres; el resto recibe "La franja ya no tiene cupos" |
| Medida | **0 sobreventas**. Medido: 6 aceptadas / 12 rechazadas (ver [05 §5](05-arquitectura-fisica.md#5-evidencia-de-capacidad-medida)) |
| Decisión | ADR-004 (revisado en esta entrega tras detectar sobreventa con `REPEATABLE READ`) |

### QA-2 · Revocación inmediata de acceso (seguridad)

| Elemento | Valor |
|---|---|
| Fuente | Administrador |
| Estímulo | Elimina, desactiva o cambia el rol de un asesor que tiene la consola abierta |
| Respuesta | La siguiente petición del asesor recibe **401** y la SPA lo devuelve al portal |
| Medida | ≤ 1 petición (≤ 5 s con el polling de la consola). Probado en `test_eliminar_asesor_conserva_historial` |
| Decisión | ADR-005 (versión de sesión), ADR-011 (baja lógica) |

### QA-3 · Privacidad del ciudadano (seguridad)

| Elemento | Valor |
|---|---|
| Estímulo | Un tercero intenta consultar un turno ajeno o mira la pantalla de sala |
| Respuesta | Sin OTP del celular dueño no hay consulta; la sala nunca muestra el celular |
| Medida | 100 % de respuestas públicas con celular enmascarado o ausente (pruebas `test_pantalla_de_sala_*`, `test_seguridad_y_publico.py`) |
| Decisión | ADR-005, ADR-008 |

### QA-4 · El ciudadano sabe que su pedido está listo (usabilidad, promesa del producto)

| Elemento | Valor |
|---|---|
| Fuente | Asesor |
| Estímulo | Marca un pedido como **Listo** con un mensaje |
| Respuesta | El ciudadano lo ve al consultar su turno; la cola del asesor muestra "Listo" |
| Medida | Visible en la siguiente consulta (≤ 20 s con la actualización automática del portal) |
| Decisión | ADR-010 |

### QA-5 · Llamado audible y repetido (accesibilidad)

| Elemento | Valor |
|---|---|
| Estímulo | El asesor llama al siguiente turno |
| Respuesta | El navegador anuncia "Turno 1 2 0 4 8 9. *Nombre completo*, por favor acercarse al Módulo 2" y lo repite cada 20 s |
| Medida | Primer anuncio < 0,5 s tras la respuesta del servidor; repetición cada 20 s ± 0,5 s; se detiene al iniciar la atención. Medido con prueba automatizada de navegador (2 anuncios en 21 s, 0 tras iniciar) |
| Decisión | ADR-009 |

### QA-6 · Latencia de las vistas en vivo (rendimiento)

| Elemento | Valor |
|---|---|
| Fuente | 40 usuarios simultáneos (más que todo el personal y TVs de 4 sedes) |
| Estímulo | Consultan horario, disponibilidad y pantalla de sala |
| Medida | p95 < 500 ms. Medido: 185–331 ms con waitress (ver [05](05-arquitectura-fisica.md)) |
| Decisión | ADR-001 (un proceso sin saltos de red), ADR-007 |

### QA-7 · Modificabilidad

| Elemento | Valor |
|---|---|
| Estímulo | El docente pide preparación previa, módulo de atención, voz, baja de asesores y una tabla uniforme en el panel |
| Respuesta | Cambios localizados en los módulos afectados, una migración aditiva, sin romper contratos existentes |
| Medida | Solo cambios aditivos en los contratos (campos y endpoints nuevos; ninguno eliminado ni renombrado); 123 de 124 pruebas previas pasan sin tocarse y 1 se actualizó por decisión explícita (ADR-008) |
| Decisión | ADR-001, ADR-010 |

### QA-8 · Recuperación ante caída del proceso (disponibilidad)

| Elemento | Valor |
|---|---|
| Estímulo | El proceso de la API se cae durante la operación |
| Respuesta | Las vistas muestran "Sin conexión, reintentando" y se recuperan solas al volver el servidor; no se pierde ningún turno confirmado (está en MySQL) |
| Medida | Tiempo de recuperación = tiempo de reinicio del proceso (≈ 2 s en localhost) |
| Decisión | ADR-007 (polling con reintento), ADR-012 |

## 3. Matriz atributo ↔ decisión

| Decisión \ Atributo | Consistencia | Seguridad | Usabilidad | Rendimiento | Mantenibilidad | Disponibilidad | Costo | Escalabilidad |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| ADR-001 Monolito modular | + | | | + | + | − | + | − |
| ADR-002 SPA + REST | | | + | + | + | | | + |
| ADR-003 MySQL + Alembic | + | | | | + | | + | |
| ADR-004 Concurrencia de cupos | **++** | | | − | | | | − |
| ADR-005 JWT versionado + OTP | | **++** | + | − | | | | |
| ADR-006 Multiempresa | | + | | | − | | + | + |
| ADR-007 Polling | | | + | − | + | + | + | − |
| ADR-008 Nombre completo en sala | | − | **++** | | | | | |
| ADR-009 Voz en navegador | | | **++** | | + | + | + | + |
| ADR-010 Preparación previa | + | | **++** | | + | | | |
| ADR-011 Baja lógica | + | + | | | | | | |
| ADR-012 Un nodo local | | | | + | | − | **++** | − |

`+` favorece · `++` es la razón principal de la decisión · `−` se sacrifica (ver [09](09-tradeoffs-riesgos.md)).
