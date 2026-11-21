# Decisiones de arquitectura (ADR)

Cada ADR tiene el contexto, las alternativas que consideramos, la decisión y sus consecuencias. Cuando una
decisión cambió durante el desarrollo no la borramos: la marcamos como revisada y explicamos por qué.

| ADR | Título | Estado | Atributo principal |
|---|---|---|---|
| [001](ADR-001-monolito-modular-por-capas.md) | Monolito modular por capas | Aceptado | Mantenibilidad, costo |
| [002](ADR-002-spa-vanilla-y-api-rest.md) | SPA en JavaScript puro separada de una API REST | Revisado | Modificabilidad |
| [003](ADR-003-mysql-y-migraciones.md) | MySQL con migraciones Alembic | Aceptado | Integridad |
| [004](ADR-004-consistencia-de-cupos.md) | Consistencia de cupos bajo concurrencia | Revisado | Consistencia |
| [005](ADR-005-autenticacion-jwt-y-otp.md) | JWT con versión de sesión y OTP para ciudadanos | Aceptado | Seguridad |
| [006](ADR-006-multiempresa-esquema-compartido.md) | Multiempresa en esquema compartido | Aceptado | Aislamiento |
| [007](ADR-007-actualizacion-por-polling.md) | Actualización en vivo por polling | Aceptado | Simplicidad |
| [008](ADR-008-nombre-completo-en-sala.md) | Nombre completo en la pantalla de sala | Revisado | Usabilidad vs. privacidad |
| [009](ADR-009-llamado-por-voz-en-navegador.md) | Llamado por voz en el navegador del asesor | Aceptado | Accesibilidad |
| [010](ADR-010-preparacion-previa.md) | Preparación previa como subestado del turno | Revisado | Cumplir la promesa al ciudadano |
| [011](ADR-011-baja-logica-de-cuentas.md) | Baja lógica de cuentas del personal | Aceptado | Trazabilidad |
| [012](ADR-012-despliegue-en-un-nodo.md) | Ejecución en un solo nodo (localhost) | Revisado | Costo, simplicidad |
| [013](ADR-013-equipos-y-reclamos.md) | Equipos y reclamos como dominios propios | Aceptado | Modificabilidad |
| [014](ADR-014-presencia-del-asesor.md) | Presencia del asesor | Aceptado | Usabilidad |
| [015](ADR-015-cedula-y-codigos-visibles.md) | Cédula para entregar equipos y códigos cortos | Aceptado | Seguridad, usabilidad |
| [016](ADR-016-minichat-y-alertas.md) | Minichat con asistente automático y alertas | Aceptado | Usabilidad |
| [017](ADR-017-bootstrap-y-capas-estrictas.md) | Bootstrap 5.3 y capas estrictas en el backend | Aceptado | Mantenibilidad |
