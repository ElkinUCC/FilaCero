# Registro de decisiones de arquitectura (ADR)

Formato: **contexto → alternativas → decisión → consecuencias**, con estado y trazabilidad a atributos de
calidad ([02](../02-atributos-calidad.md)) y riesgos ([09](../09-tradeoffs-riesgos.md)). Un ADR no se borra:
si la implementación cambia la decisión, se **revisa** y se deja constancia (ver ADR-002, ADR-004 y ADR-008).

Total: **17 ADR**.

| ADR | Título | Estado | Atributo principal |
|---|---|---|---|
| [001](ADR-001-monolito-modular-por-capas.md) | Monolito modular por capas | Aceptado | Mantenibilidad, costo |
| [002](ADR-002-spa-vanilla-y-api-rest.md) | SPA en JavaScript puro (sin frameworks) separada de una API REST versionada | **Revisado** (entrega final) | Modificabilidad, seguridad, costo |
| [003](ADR-003-mysql-y-migraciones.md) | MySQL relacional con migraciones Alembic | Aceptado | Integridad |
| [004](ADR-004-consistencia-de-cupos.md) | Consistencia de cupos bajo concurrencia | **Revisado** (entrega final) | Consistencia |
| [005](ADR-005-autenticacion-jwt-y-otp.md) | JWT con versión de sesión y OTP para ciudadanos | Aceptado | Seguridad |
| [006](ADR-006-multiempresa-esquema-compartido.md) | Multiempresa en esquema compartido | Aceptado | Escalabilidad de negocio |
| [007](ADR-007-actualizacion-por-polling.md) | Actualización en vivo por polling | Aceptado | Simplicidad, disponibilidad |
| [008](ADR-008-nombre-completo-en-sala.md) | Nombre completo en la pantalla de sala | **Revisado** (entrega final) | Usabilidad vs. privacidad |
| [009](ADR-009-llamado-por-voz-en-navegador.md) | Llamado por voz en el navegador del asesor | Nuevo | Accesibilidad |
| [010](ADR-010-preparacion-previa.md) | Preparación previa como subestado del turno | **Revisado** (iteración 3) | Cumplimiento de la promesa |
| [011](ADR-011-baja-logica-de-cuentas.md) | Baja lógica de cuentas del personal | Nuevo | Trazabilidad |
| [012](ADR-012-despliegue-en-un-nodo.md) | Ejecución solo en localhost (un nodo) | **Revisado** (entrega final) | Costo, riesgo de demo, simplicidad |
| [013](ADR-013-equipos-y-reclamos.md) | Equipos y reclamos como módulos de dominio | Nuevo (iteración 2) | Cumplimiento de la promesa |
| [014](ADR-014-presencia-del-asesor.md) | Presencia del asesor | Nuevo (iteración 2) | Usabilidad del panel |
| [015](ADR-015-cedula-y-codigos-visibles.md) | Cédula para entregar equipos y códigos visibles uniformes | Nuevo (iteración 3) | Seguridad, usabilidad |
| [016](ADR-016-minichat-y-alertas.md) | Minichat con asistente automático y alertas al asesor | Nuevo (iteración 4) | Usabilidad |
| [017](ADR-017-bootstrap-y-capas-estrictas.md) | Bootstrap 5.3 como base visual de la SPA y capas estrictas en el backend | Nuevo (entrega final) | Mantenibilidad, verificabilidad |
