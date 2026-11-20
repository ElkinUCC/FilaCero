# 10 · Evolución de la arquitectura

Una arquitectura final no tiene que soportar cualquier cambio sin modificaciones: tiene que **identificar qué se
afecta, ajustar proporcionalmente y explicar los nuevos trade-offs**. Aquí hay un escenario **ejecutado** (con los
artefactos realmente actualizados) y dos escenarios **analizados**.

## E-1 · Retroalimentación de la revisión final (ejecutado)

**Estímulo** (revisión con el docente y objetivo del producto):
1. Paleta del portal: usar como principal la combinación de "Alto contraste" (la anterior se veía muy blanca).
2. Consola del asesor: voz inmediata al llamar y repetición cada 20 s con el turno/nombre y la taquilla o módulo.
3. Pantalla de sala: nombre completo de la persona llamada, sin abreviar ni recortar.
4. Panel administrativo: misma estructura en todas las secciones, un dato por columna, mismo número de columnas,
   detalle en una vista corta al hacer clic (asesores e historial estaban sobrecargados).
5. Poder **eliminar** un asesor.
6. Objetivo del estudiante: que lo que pidió el ciudadano esté **listo** cuando llegue (preparación previa).

**Impacto por elemento de la arquitectura**:

| Elemento | ¿Afectado? | Cambio proporcional |
|---|---|---|
| Estilo (monolito modular) | No | — |
| Contenedores C2 | No | Mismos tres contenedores |
| Componente *Turnos* (C3) | Sí | Nuevo `turnos/preparacion.py` (servicio), campos en `turnos`, DTO con `preparacion` |
| Componente *Atención y despacho* | Sí | Endpoint de preparación, `modulo` en panel, asistente sugiere preparar, `DELETE` de asesor |
| Componente *Usuarios* | Sí | `modulo`, `eliminado_en`, servicios `asignar_modulo` y `dar_de_baja` |
| Componente *Trámites* | Sí | `requiere_preparacion` |
| Componente *Sedes* | Sí (menor) | Capacidad operativa en el listado del panel |
| SPA | Sí | Llamado por voz (`utils/voz.js`), preparación del pedido (`agente/prepararTurno.js`), tabla uniforme del panel (`admin/tablaSeccion.js`) con detalle al clic (`ui/modal.js`), paleta del portal |
| Persistencia | Sí | Migración aditiva y reversible `a7c9e1b3d5f7` |
| Despliegue | No | Mismos nodos y procesos; un paso más: `flask db upgrade` |
| Seguridad | Sí | Reglas de baja (no propia, no protegida, no último admin, no con turno en curso); auditoría `usuario_eliminado`, `turno_preparado` |

**Artefactos actualizados** (y solo esos):

| Artefacto | Actualización |
|---|---|
| [01](01-sintesis-problema.md) | RAR-06, RAR-07, RAR-08; actor "Público en sala" |
| [02](02-atributos-calidad.md) | QA-4 (preparación) y QA-5 (voz) nuevos |
| [03](03-vistas-c4.md) | Responsabilidades de *Turnos*, *Usuarios* y SPA; componentes nuevos de la SPA |
| [04](04-arquitectura-logica.md) | Ciclo de vida con preparación, endpoints nuevos, modelo de datos |
| [06](06-despliegue.md) | Paso de migración; sin cambios de nodos |
| ADR | **Nuevos** 009, 010, 011 · **Revisado** 008 (privacidad vs. usabilidad) |
| Pruebas | `tests/test_entrega_final.py` (13 casos) y prueba de sala actualizada |

**Hallazgo durante la evolución**: al medir la capacidad para este documento se ejecutó la prueba de
concurrencia sobre MySQL y apareció **sobreventa** (18 reservas en 6 cupos). Se **revisó ADR-004** (aislamiento
`READ COMMITTED`) y se actualizó R-01. Es el ejemplo de que la concreción del despliegue puede modificar una
decisión previa y que los ADR deben revisarse, no reescribirse.

**Nuevos trade-offs**: T-06, T-07, T-08, T-09, T-11 en [09](09-tradeoffs-riesgos.md).

## E-1b · Segunda iteración: equipos, garantía, reclamos y presencia (ejecutado)

**Estímulo**: al revisar la simulación se pidió que la reserva fuera "más dinámica" y que, después de verificar el
celular, la persona pudiera **elegir el equipo que va a recoger** (con su estado), **ingresar un televisor a
garantía** (marca y compra de máximo 1 año) y **radicar un reclamo** sin ir a la sede o seguirlo en persona; en la
consola, un apartado para **registrar los equipos** que se reciben; en el panel, quitar opciones sin uso
(preguntas adicionales del trámite, menú de Accesibilidad), alinear Sedes y mostrar **qué hace cada asesor**.

| Elemento | Cambio proporcional |
|---|---|
| Componentes C3 | **Nuevos** módulos `equipos` y `reclamos` con sus cinco capas (ADR-013) |
| *Turnos* | La reserva valida y vincula equipo/garantía/reclamo según `tramites.tipo_flujo`; `otp.celular_del_token` compartido |
| *Usuarios* / *Atención* | Presencia del asesor (ADR-014) |
| SPA | Asistente de reserva paso a paso; tablero del taller y bandeja de reclamos en la consola; consulta por celular con equipos y reclamos |
| Persistencia | Migración aditiva `b8d0f2a4c6e9` (2 tablas, 5 columnas) con deducción del tipo de trámite por nombre |
| Contenedores, despliegue, ADR-004 | **Sin cambios** |
| Retirado | Menú de Accesibilidad y preguntas adicionales del trámite en la interfaz (la API conserva `campos_solicitud` por compatibilidad) |

Artefactos actualizados: 01 (RAR-11, RAR-12, alcance), 03 (componentes), 04 (módulos, endpoints, modelo de datos),
07, ADR-009 (voz solo en consola), ADR-013 y ADR-014 nuevos, `tests/test_equipos_reclamos.py` (9 casos).

## E-1c · Tercera iteración: horario en desplegable, preparación por tipo, cédula y tablero ejecutivo (ejecutado)

**Estímulo**: en la simulación final se observó que (1) la cuadrícula de horas obligaba a desplazarse; (2) el
mensaje "Lo dejamos listo antes de que llegues" salía en servicios donde no hay nada que alistar; (3) la consola
mostraba identificadores largos en vez de nombres; (4) entregar un equipo con solo el celular no es seguro;
(5) los códigos de turno, equipo y reclamo tenían formatos distintos; (6) el resumen del panel debía ser un
tablero ejecutivo, igual para el supervisor pero sin edición.

| Elemento | Cambio proporcional |
|---|---|
| *Trámites* / *Turnos* | `requiere_preparacion` se deriva de `tipo_flujo` (solo ENTREGA y GARANTIA) — ADR-010 revisado |
| *Usuarios* / *Equipos* | `usuarios.documento`; recibir y entregar exigen la cédula (comparada en el servidor) — ADR-015 |
| *Turnos* | Código visible `TU-XXXXXX` en DTO, sala y consola; la consulta pública acepta el código corto con el celular verificado |
| *Atención* | Nuevo servicio `agentes/tablero.py` y `GET /admin/agentes/tablero` (periodo vs. periodo anterior, por día, por hora, por sede, taller y reclamos) |
| SPA | Hora como desplegable agrupado por jornada ("10:00 – 10:30"); mensajes de preparación por tipo de atención; consola por nombre con avatar; modal de cédula; tablero ejecutivo con gráficas SVG propias, contadores animados, comparación y exportación CSV |
| Persistencia | Migración `c1e3a5b7d9f0` (1 columna + recálculo de la regla de preparación) |
| Seguridad | Revisión STRIDE y auditoría de dependencias — [11](11-seguridad.md) |
| Contenedores, despliegue, ADR-004 | **Sin cambios** |

Artefactos actualizados: ADR-010 (revisado), ADR-015 (nuevo), 11 (nuevo), pruebas (+5 casos: 152 en total). Iteración 4: ADR-016, migración `d2f4b6c8e0a1`, minichat, alertas y vista móvil (155 pruebas en ese momento; 164 en la entrega final).

## E-1d · Frontend sin frameworks (ejecutado, entrega final)

**Estímulo** (requisito del curso): el frontend debe construirse **sin frameworks** —solo HTML, CSS y
JavaScript— como una SPA con la estructura del proyecto de referencia (*frontend-alojamientos*). La versión
anterior de la interfaz usaba un framework de componentes con un paso de compilación.

**Impacto por elemento de la arquitectura**:

| Elemento | ¿Afectado? | Cambio proporcional |
|---|---|---|
| Estilo (monolito modular) | No | — |
| Contenedores C2 | Solo la tecnología de *SPA FilaCero* | Mismos tres contenedores y mismas responsabilidades |
| API FilaCero (C3), contrato `/api/v1` | **No** | Cero cambios en endpoints, DTO o reglas: la separación SPA ↔ API absorbió el cambio |
| Persistencia | No | Sin migraciones |
| SPA (C3) | Sí | `index.html` + `#app`; `src/js/` con `main.js`, `router/`, `pages/` (`XPage` + `mountXPage`), `components/`, `api/http.js`, `auth/`, `utils/` (`polling`, `voz`, `dom`); configuración en `src/js/config.js` |
| Seguridad | Sí | El escape de HTML pasa a la plantilla `html``…``` de `utils/dom.js` (riesgo R-12); el frontend queda sin dependencias de terceros |
| Arquitectura computacional y despliegue | Sí (simplifica) | Sin Node.js ni compilación: el proceso 3 es un servidor estático de Python |
| Pruebas del backend | No | Sin cambios por la migración (164 en verde en la entrega final) |

**Artefactos actualizados**: ADR-002 (revisado), ADR-009 y ADR-012 (notas), 01, 03 (C2 y C3 de la SPA), 04
(§4.1, §4.3, §6), 05, 06, 07, 09 (T-12, R-12), 11, `frontend/docs/ARQUITECTURA-SPA-VANILLA.md`.

**Lección**: es la mejor evidencia de modificabilidad del proyecto: se reemplazó por completo un contenedor y
el resto de la arquitectura no se enteró.

## E-1e · Alcance solo localhost (ejecutado, entrega final)

**Estímulo**: la entrega se ejecuta y evalúa únicamente en localhost; los artefactos de publicación (contenedores,
servidor web, nube) y el modo "producción" de la API no se usaban en la demostración.

| Elemento | ¿Afectado? | Cambio proporcional |
|---|---|---|
| Lógica, C4 y módulos | No | — |
| Despliegue (06) y ADR-012 | Sí | Solo el nodo local; las alternativas quedan como análisis en 05 §6 |
| Configuración de la API | Sí (simplifica) | Sin `FLASK_ENV=production`, validación de producción, `ProxyFix`, TLS a la BD ni OTP de demo pública |
| Seguridad del frontend | Sí | La CSP pasa de `nginx.conf` a una etiqueta `<meta>` en `index.html` |
| Pruebas | Sí | Se retiran 4 pruebas que solo verificaban el modo producción: 164 en verde |

## E-1f · Requisitos del enunciado final: Bootstrap y capas estrictas (ejecutado)

**Estímulo**: el enunciado de la entrega final exige Bootstrap o Tailwind en el frontend y separación por
controladores, servicios, repositorios, DTO y modelos en el backend.

| Elemento | ¿Afectado? | Cambio proporcional |
|---|---|---|
| Estilo, C1, C2 y despliegue | No | Mismos contenedores y nodos |
| SPA (C3) | Sí | Bootstrap 5.3.9 local + `bootstrap-tema.css`; clases de Bootstrap en botones, tablas, alertas, avisos, spinners, grilla de formularios y validación (`.is-invalid`); `.modal` propio renombrado a `.ventana`; fuente local |
| API (C3) | Sí (interno) | Consultas fuera de los controladores: `agentes/consultas.py`, `agentes/admin_servicios.py`, `usuarios/admin_servicios.py`, `turnos/sala.py`, `organizaciones/servicios.py`, repositorios y DTO nuevos. Contrato `/api/v1` sin cambios de forma |
| Persistencia | Sí (corrección) | Las bajadas (`downgrade`) de `7fb57bf505c3` y `c3e5a7b9d1f2` fallaban en MySQL al borrar índices de llaves foráneas (error 1553); ahora se eliminan las tablas directamente. Ciclo completo subida → bajada → subida probado en MariaDB 10.11 |
| Pruebas | Sí | +58 pruebas de arquitectura (`test_arquitectura_capas.py`): 222 en verde |

**Artefactos actualizados**: ADR-017 (nuevo), ADR-001 y ADR-002 (notas), 03, 04, 07, 09 (R-07 cerrado, T-14), 11,
diagrama de componentes, README.

**Evidencia**: capturas antes/después con la misma fuente difieren en menos de 0,1 % de píxeles (solo el reloj);
`python simulacion.py --url …` 50/50 y prueba de concurrencia 6 aceptadas / 12 rechazadas sobre MariaDB.

## E-2 · Crecimiento a 40 sedes y 200 asesores (analizado)

**Estímulo**: TecniVisión se expande a una red nacional.

| Carga | Hoy | Escenario | Cálculo |
|---|---|---|---|
| Consolas | 1,6 req/s | 40 req/s | 200 asesores / 5 s |
| Salas | 1,0 req/s | 10 req/s | 40 TV / 4 s |
| Ciudadanos | 2,5 req/s | 25 req/s | × 10 |
| **Total** | ≈ 6 req/s | **≈ 80 req/s** | ≈ 65 % de un proceso medido (≈ 120 req/s) |
| Red de consolas | 0,6 Mbps | ≈ 15 Mbps | 46 KB × 40 / s |

**Qué se afecta y ajuste proporcional** (sin cambiar de estilo):

| Elemento | Ajuste | Nuevo trade-off |
|---|---|---|
| Despliegue | 2–3 procesos waitress detrás de nginx en un VPS de 4 vCPU; MySQL administrado | +costo (≈ 20–40 USD/mes), +operación |
| ADR-004 | Sigue válido: `FOR UPDATE` coordina entre procesos; el candado en memoria queda como optimización local | — |
| ADR-007 | Respuestas condicionales (`ETag`/`304`) en el panel del asesor o SSE para la sala | +complejidad en el cliente |
| Límite de peticiones (R-09) | Mover a almacén compartido | +dependencia (Redis o tabla) |
| Consola | Paginar la cola (solo hoy + próximos N) con `COLA_SOLO_HOY=true` | El asesor ve menos días |
| Datos | ≈ 15 MB/día a capacidad máxima (28 800 turnos × 0,44 KB + franjas) ⇒ archivar `turnos` por año | Consultas históricas más lentas |

Umbral para reconsiderar ADR-001: si un módulo (p. ej. la sala) necesita escalar 10× más que el resto, se
extrae como servicio de solo lectura alimentado por la misma BD o por eventos.

## E-3 · Avisar al ciudadano cuando su pedido esté listo (analizado)

**Estímulo**: el negocio pide enviar un SMS/WhatsApp al pasar a `LISTO` o `NOVEDAD`.

| Elemento | Impacto |
|---|---|
| `turnos/preparacion.py` | Publica un evento "preparación cambiada" después del `commit` |
| Nuevo componente *Notificaciones* | Envía por el proveedor (reutiliza la interfaz de `otp.py`) con reintentos |
| Integración | Envío asíncrono (cola en tabla o Redis) para que un proveedor lento no frene al asesor |
| Costo | Variable por mensaje (I-02) |
| Privacidad | Consentimiento explícito del canal al reservar (I-03) |

El cambio es **local a un módulo nuevo** y a un punto de extensión ya identificado: la arquitectura lo absorbe
sin tocar reserva, despacho ni sala.

## Evidencia visual de E-1

| Cambio | Captura |
|---|---|
| Paleta principal del portal | ![Portal](img/e1-portal-paleta.png) |
| Llamado por voz con repetición y módulo | ![Consola](img/e1-consola-llamado-voz.png) |
| Preparación previa (asesor) | ![Preparar](img/e1-preparar-pedido.png) |
| Pedido listo (ciudadano) | ![Consulta](img/e1-ciudadano-pedido-listo.png) |
| Sala con nombre completo y módulo | ![Sala](img/e1-sala-nombre-completo.png) |
| Panel uniforme (6 columnas) | ![Asesores](img/e1-panel-asesores.png) |
| Detalle al hacer clic (asesor) | ![Detalle asesor](img/e1-panel-detalle-asesor.png) |
| Detalle al hacer clic (turno del historial) | ![Detalle turno](img/e1-panel-detalle-turno.png) |
| Eliminar asesor (baja lógica) | ![Eliminar](img/e1-eliminar-asesor.png) |

> Capturas tomadas con los datos de `python simulacion.py --cargar`. Desde la entrega final la tipografía *Onest*
> se sirve desde `frontend/public/vendor/fuentes`, así que la demo se ve igual sin internet.

## Evidencia visual de E-1b

| Cambio | Captura |
|---|---|
| Reserva paso a paso: ¿qué necesitas? | ![Paso 1](img/e1b-reserva-que-necesitas.png) |
| Tras verificar el celular: elige el equipo listo | ![Equipo](img/e1b-reserva-elige-equipo.png) |
| Horarios como botones (reemplazado en E-1c por un desplegable) | ![Horario](img/e1b-reserva-horario.png) |
| Garantía con validación de 1 año | ![Garantía](img/e1b-garantia.png) |
| Reclamo en línea o en persona | ![Reclamo](img/e1b-reclamo.png) |
| Consulta por celular: turnos, equipos y reclamos | ![Consulta](img/e1b-consulta-equipos-reclamos.png) |
| Consola: atención de una entrega con su equipo | ![Entrega](img/e1b-consola-entrega-equipo.png) |
| Consola: tablero del taller | ![Taller](img/e1b-consola-taller.png) |
| Consola: bandeja de reclamos | ![Reclamos](img/e1b-consola-reclamos.png) |
| Consola: presencia del asesor | ![Presencia](img/e1b-consola-presencia.png) |
| Panel: estado actual de cada asesor | ![Asesores](img/e1b-panel-asesores-presencia.png) |
| Panel: Sedes alineada | ![Sedes](img/e1b-panel-sedes.png) |
| Panel: trámite con tipo de atención | ![Trámite](img/e1b-panel-tramite.png) |

## Evidencia visual de E-1c

| Cambio | Captura |
|---|---|
| Hora en un desplegable agrupado por jornada, sin desplazarse | ![Hora](img/e2-reserva-hora-desplegable.png) |
| Servicio sin preparación: la confirmación no promete nada que no aplica | ![Sin preparación](img/e2-confirmar-sin-preparacion.png) |
| Entrega de equipo: mensaje propio y aviso de traer la cédula | ![Entrega](img/e2-confirmar-entrega.png) |
| Consulta por celular con códigos `TU-`, `EQ-` y `RC-` | ![Consulta](img/e2-consulta-codigos.png) |
| Consola: cola por nombre con el código como dato secundario | ![Cola](img/e2-consola-cola-nombres.png) |
| Puesto: avatar, nombre y datos breves (turno, celular, cédula enmascarada) | ![Puesto](img/e2-puesto-por-nombre.png) |
| Entrega con cédula que no coincide: el servidor la rechaza | ![Cédula](img/e2-cedula-no-coincide.png) |
| Recibir equipo: la cédula del titular es obligatoria | ![Recibir](img/e2-recibir-equipo-cedula.png) |
| Sala con el código corto en una línea | ![Sala](img/e2-sala-codigo-corto.png) |
| Tablero ejecutivo: indicador principal, tarjetas con variación y tendencia, cruz con tooltip | ![Tablero](img/e2-tablero-ejecutivo.png) |
| Tablero en "Hoy": demanda por hora | ![Hoy](img/e2-tablero-hoy.png) |
| Tablero completo: sedes en vivo, desempeño por sede, taller y reclamos | ![Completo](img/e2-tablero-completo.png) |

## Evidencia visual de la iteración 4 (ADR-016)

| Cambio | Captura |
|---|---|
| Minichat en la consola: cliente, asistente automático y asesor | ![Chat](img/e3-consola-minichat.png) |
| Minichat del ciudadano en el celular | ![Chat móvil](img/e3-movil-minichat.png) |
| Portal, consulta por código y consola en un celular (390 px) | ![Móvil](img/e3-vista-movil.png) |
| Tablero con asistente de métricas y filas parejas | ![Tablero](img/e3-tablero-asistente-metricas.png) |
