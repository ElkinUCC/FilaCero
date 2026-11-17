# FilaCero · Documento de arquitectura (entrega final)

> Arquitectura de Software y Computacional · Momento evaluativo 3 · Semana 16
> Sistema: **FilaCero**, plataforma de turnos presenciales con franja garantizada y preparación previa.
> Estilo: **monolito modular por capas y dominios** (backend Flask) + **SPA sin frameworks** (HTML + CSS + JavaScript puro),
> ejecutado en **localhost** (un nodo) para la demostración.

Este documento cuenta **una sola arquitectura** desde varias vistas. Los nombres de actores, contenedores,
componentes y nodos son los mismos en todos los artefactos (C4, despliegue, ADR, análisis) para que puedan
leerse juntos y verificarse contra el código.

## Cómo leerlo

| # | Artefacto | Pregunta que responde | Evidencia esperada por el curso |
|---|---|---|---|
| 01 | [Síntesis del problema](01-sintesis-problema.md) | ¿Qué problema se resuelve, para quién y con qué límites? | Problema, alcance, actores, restricciones, requisitos arquitectónicamente relevantes |
| 02 | [Atributos de calidad](02-atributos-calidad.md) | ¿Qué cualidades mandan y qué decisión responde a cada una? | Atributos prioritarios y relación con decisiones |
| 03 | [Vistas C4](03-vistas-c4.md) | ¿Cómo se ve el sistema desde afuera, por dentro y en sus piezas? | C4 Context, Container y Component coherentes |
| 04 | [Arquitectura lógica](04-arquitectura-logica.md) | ¿Qué responsabilidad tiene cada capa y módulo, y cómo se comunican y persisten? | Responsabilidades, límites, dependencias, integración, persistencia |
| 05 | [Arquitectura computacional y física](05-arquitectura-fisica.md) | ¿En qué recursos corre y cuánta carga soporta? | Nodos, CPU, RAM, almacenamiento, E/S, red, capacidad, alternativas |
| 06 | [Despliegue](06-despliegue.md) | ¿Qué unidad ejecutable vive en qué nodo? | Diagrama de despliegue coherente con las unidades lógicas |
| 07 | [Análisis de atributos](07-analisis-atributos.md) | ¿Cómo se comporta en rendimiento, disponibilidad, seguridad, costo y escalabilidad? | Análisis con evidencia medida |
| 08 | [ADR](adr/README.md) | ¿Por qué se decidió así y qué se sacrificó? | ADR con contexto, alternativas, decisión y consecuencias |
| 09 | [Trade-offs, riesgos y supuestos](09-tradeoffs-riesgos.md) | ¿Qué se aceptó perder, qué puede fallar y qué no sabemos? | Trade-offs, riesgos, supuestos, incertidumbres |
| 10 | [Evolución](10-evolucion.md) | ¿Cómo cambia la arquitectura ante nuevos requisitos? | Escenarios de cambio y artefactos realmente afectados |
| 11 | [Seguridad](11-seguridad.md) | ¿Qué amenazas se revisaron, qué se corrigió y qué riesgo queda? | STRIDE, auditoría de dependencias, riesgos aceptados |
| 12 | [Diagramas UML](../diagramas/README.md) | ¿Cómo se ve el sistema en notación UML? | Casos de uso, clases, entidad-relación, paquetes, componentes, despliegue y secuencias |
| 13 | [Evidencias de la entrega](../entrega/) | ¿Cómo se presenta? | Informe PDF de decisiones arquitectónicas y guion del video |

## Resumen ejecutivo

FilaCero reemplaza la fila física por una **reserva con franja garantizada**: el ciudadano elige sede,
trámite y franja de 30 minutos; el sistema solo vende los cupos que los asesores alcanzan a atender
(regla: máximo 10 minutos por atención ⇒ 3 personas por asesor y franja). En la entrega final se
agregó la **preparación previa** y, en una segunda iteración, el registro de **equipos de clientes** y
**reclamos**: tras verificar su celular, el ciudadano elige qué equipo va a recoger (solo si está listo),
ingresa un televisor a garantía (compra de máximo 1 año) o radica un reclamo en línea sin desplazarse. Así la promesa no es
solo "no hagas fila", sino "llega a tu hora y sal con lo que viniste a buscar".

| Decisión clave | Atributo que protege | ADR |
|---|---|---|
| Monolito modular por capas (un proceso, módulos de dominio) | Mantenibilidad, simplicidad operativa, costo | [ADR-001](adr/ADR-001-monolito-modular-por-capas.md) |
| SPA en HTML + CSS + JavaScript puro (sin frameworks) + API REST versionada `/api/v1` | Modificabilidad, seguridad (cero dependencias), costo | [ADR-002](adr/ADR-002-spa-vanilla-y-api-rest.md) (revisado) |
| MySQL relacional + migraciones Alembic | Integridad, trazabilidad, consistencia | [ADR-003](adr/ADR-003-mysql-y-migraciones.md) |
| Bloqueo por sede + `FOR UPDATE` + `READ COMMITTED` | **Consistencia de cupos** (la promesa del producto) | [ADR-004](adr/ADR-004-consistencia-de-cupos.md) (revisado) |
| JWT con versión de sesión + OTP para ciudadanos sin cuenta | Seguridad, usabilidad | [ADR-005](adr/ADR-005-autenticacion-jwt-y-otp.md) |
| Multiempresa por columna `organizacion_id` | Escalabilidad de negocio, aislamiento | [ADR-006](adr/ADR-006-multiempresa-esquema-compartido.md) |
| Actualización por consulta periódica (polling) | Simplicidad, tolerancia a fallos de red | [ADR-007](adr/ADR-007-actualizacion-por-polling.md) |
| Nombre completo en la pantalla de sala | Usabilidad (identificación inequívoca) | [ADR-008](adr/ADR-008-nombre-completo-en-sala.md) |
| Llamado por voz en el navegador del asesor | Accesibilidad, costo cero de infraestructura | [ADR-009](adr/ADR-009-llamado-por-voz-en-navegador.md) |
| Preparación previa como subestado del turno | Cumplimiento de la promesa, mínima disrupción | [ADR-010](adr/ADR-010-preparacion-previa.md) |
| Baja lógica de cuentas del personal | Trazabilidad, integridad histórica | [ADR-011](adr/ADR-011-baja-logica-de-cuentas.md) |
| Ejecución solo en localhost (un nodo, tres procesos; sin contenedores ni nube) | Costo, reproducibilidad de la demostración, simplicidad | [ADR-012](adr/ADR-012-despliegue-en-un-nodo.md) (revisado) |
| Equipos y reclamos como módulos propios; reserva guiada según el tipo de trámite | Cumplimiento de la promesa, modificabilidad | [ADR-013](adr/ADR-013-equipos-y-reclamos.md) |
| Presencia del asesor (atendiendo, pausa, almuerzo, fuera de turno) | Usabilidad del panel | [ADR-014](adr/ADR-014-presencia-del-asesor.md) |
| Cédula para entregar equipos; códigos visibles uniformes `TU-` / `EQ-` / `RC-` | Seguridad, usabilidad | [ADR-015](adr/ADR-015-cedula-y-codigos-visibles.md) |
| Minichat de reclamos con asistente automático y alertas al asesor | Usabilidad | [ADR-016](adr/ADR-016-minichat-y-alertas.md) |

## Evidencia verificable

- **164 pruebas automatizadas** en verde (`python -m pytest tests/ -v`), incluidas las de la entrega final
  ([test_entrega_final.py](../../backend/tests/test_entrega_final.py), [test_equipos_reclamos.py](../../backend/tests/test_equipos_reclamos.py) y [test_asistente_ia.py](../../backend/tests/test_asistente_ia.py)).
- **Prueba de carga y concurrencia** reproducible: `python simulacion.py --carga --url http://127.0.0.1:5000`
  (resultados en [05](05-arquitectura-fisica.md#5-evidencia-de-capacidad-medida)).
- **Verificación funcional de punta a punta** contra el servidor encendido: `python simulacion.py --url http://127.0.0.1:5000`
  (50 comprobaciones de ciudadano, asesor, administrador, permisos y seguridad).
- Migraciones probadas en subida y bajada (`flask db upgrade` / `flask db downgrade`) sobre motor MySQL/MariaDB.
- **16 ADR**, 15 migraciones Alembic encadenadas y 8 diagramas UML generados desde el código ([`docs/diagramas/`](../diagramas/README.md)).
- Frontend sin dependencias de terceros: `frontend/` contiene solo `index.html`, `src/css/`, `src/js/` y `public/` (ver [ADR-002](adr/ADR-002-spa-vanilla-y-api-rest.md) y el escenario E-1d en [10](10-evolucion.md)).
