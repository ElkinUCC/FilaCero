# FilaCero · Documento de arquitectura

Aquí está la arquitectura de FilaCero vista desde varios ángulos. Usamos los mismos nombres de actores,
contenedores, componentes y nodos en todos los documentos (C4, despliegue, ADR) para que se puedan leer juntos
y comparar con el código.

- **Estilo:** monolito modular por capas y dominios (backend Flask) + SPA en JavaScript puro.
- **Ejecución:** en localhost, un solo equipo con tres procesos (MySQL, API y frontend).

## Contenido

| # | Documento | Qué responde |
|---|---|---|
| 01 | [Síntesis del problema](01-sintesis-problema.md) | Problema, alcance, actores, restricciones y requisitos arquitectónicamente relevantes |
| 02 | [Atributos de calidad](02-atributos-calidad.md) | Qué cualidades son prioritarias y qué decisión responde a cada una |
| 03 | [Vistas C4](03-vistas-c4.md) | Diagramas de contexto, contenedores y componentes |
| 04 | [Arquitectura lógica](04-arquitectura-logica.md) | Capas, dominios, dependencias, API y persistencia |
| 05 | [Arquitectura computacional y física](05-arquitectura-fisica.md) | Nodos, recursos y capacidad medida |
| 06 | [Despliegue](06-despliegue.md) | Qué se ejecuta en cada nodo |
| 07 | [Análisis de atributos](07-analisis-atributos.md) | Rendimiento, disponibilidad, seguridad, costo y escalabilidad |
| 09 | [Trade-offs, riesgos y supuestos](09-tradeoffs-riesgos.md) | Qué aceptamos perder y qué puede fallar |
| 10 | [Evolución](10-evolucion.md) | Cómo crecería el sistema (más sedes, avisos al ciudadano) |
| 11 | [Seguridad](11-seguridad.md) | Amenazas revisadas (STRIDE) y riesgos que quedan |
| — | [ADR](adr/README.md) | Decisiones de arquitectura con alternativas y justificación |
| — | [Diagramas UML](../diagramas/README.md) | Casos de uso, clases, entidad-relación, paquetes, componentes, despliegue y secuencias |

## Resumen

FilaCero cambia la fila física por una **reserva con franja garantizada**. El ciudadano elige sede, trámite y
una franja de 30 minutos, y el sistema solo ofrece los cupos que los asesores alcanzan a atender (cada atención
dura máximo 10 minutos, o sea 3 personas por asesor en cada franja). Además, cuando el trámite lo necesita,
el asesor alista el pedido antes de que llegue la persona (preparación previa). También se manejan los equipos
que los clientes dejan en reparación, las garantías y los reclamos.

## Decisiones principales

| Decisión | Atributo que protege | ADR |
|---|---|---|
| Monolito modular por capas | Mantenibilidad, costo | [ADR-001](adr/ADR-001-monolito-modular-por-capas.md) |
| SPA en JavaScript puro + API REST `/api/v1` | Modificabilidad, cero dependencias | [ADR-002](adr/ADR-002-spa-vanilla-y-api-rest.md) |
| MySQL con migraciones Alembic | Integridad de los datos | [ADR-003](adr/ADR-003-mysql-y-migraciones.md) |
| Bloqueo por sede + `FOR UPDATE` + `READ COMMITTED` | Consistencia de cupos | [ADR-004](adr/ADR-004-consistencia-de-cupos.md) |
| JWT con versión de sesión + OTP para ciudadanos | Seguridad y facilidad de uso | [ADR-005](adr/ADR-005-autenticacion-jwt-y-otp.md) |
| Multiempresa con columna `organizacion_id` | Aislamiento entre organizaciones | [ADR-006](adr/ADR-006-multiempresa-esquema-compartido.md) |
| Actualización por consulta periódica (polling) | Simplicidad | [ADR-007](adr/ADR-007-actualizacion-por-polling.md) |
| Ejecución en un solo nodo (localhost) | Costo y simplicidad | [ADR-012](adr/ADR-012-despliegue-en-un-nodo.md) |
| Bootstrap 5.3 local y capas verificadas con pruebas | Mantenibilidad | [ADR-017](adr/ADR-017-bootstrap-y-capas-estrictas.md) |

## Cómo lo verificamos

- Pruebas automáticas con pytest: `python -m pytest` en `backend/`.
- Prueba de carga y de sobrecupo contra MySQL: `python simulacion.py --carga --url http://127.0.0.1:5000`
  (resultados en [05](05-arquitectura-fisica.md)).
- Recorrido completo contra el servidor encendido: `python simulacion.py --url http://127.0.0.1:5000`.
- Migraciones probadas hacia arriba y hacia abajo (`flask db upgrade` / `flask db downgrade`).
