# Roadmap de FilaCero

## Completado

| Bloque | Objetivo | Referencia |
|---|---|---|
| Sprints 01–10 | Base, seguridad, modelo de negocio, catálogo, reserva con OTP, consola, supervisión, documentación, integración SPA y calidad | `docs/sprints/` |
| Iteraciones E-1 a E-1c e iteración 4 | Preparación previa, voz, equipos, garantía, reclamos, cédula, tablero ejecutivo, minichat | `docs/arquitectura/10-evolucion.md` |
| E-1d · E-1e | SPA sin frameworks; ejecución solo en localhost | ADR-002, ADR-012 |
| E-1f (entrega final) | Bootstrap 5.3 local, capas estrictas verificadas por pruebas, migraciones reversibles en MySQL | ADR-017 |

## Después de la sustentación (fuera del alcance)

| Prioridad | Tarea | Referencia |
|---|---|---|
| Alta | Proveedor real de SMS con reintentos | Incertidumbre I-02 |
| Alta | Respaldo diario de MySQL y prueba de restauración | Riesgo R-03 |
| Media | Límite de peticiones en un almacén compartido para varios procesos | Riesgo R-09 |
| Media | JWT en cookie HttpOnly + CSRF si se publicara | `docs/arquitectura/11-seguridad.md` |
| Baja | Avisar por SMS cuando el pedido esté listo | Escenario E-3 |
