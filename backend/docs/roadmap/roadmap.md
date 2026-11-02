# Roadmap de FilaCero

## Sprints completados

| Sprint | Objetivo | Resultado |
|---|---|---|
| 01 | Base técnica: factory, configuración, migraciones | ✅ |
| 02 | Usuarios y seguridad (JWT, hash, roles) | ✅ |
| 03 | Modelo de negocio: sedes, trámites, franjas, turnos | ✅ |
| 04 | Administración de catálogo | ✅ |
| 05 | Portal del ciudadano: reserva sin cuenta con OTP | ✅ |
| 06 | Asesores y ciclo de atención | ✅ |
| 07 | Supervisión: métricas, historial, panel en vivo | ✅ |
| 08 | Documentación y colección Postman | ✅ |
| 09 | Regla de puntualidad: cupo por sede y despacho EDF | ✅ |
| 10 | Usuarios y permisos, bloqueo, revocación, bitácora | ✅ |
| 11 | Accesibilidad WCAG 2.2 AA, pantalla de sala con voz | ✅ |
| 12 | Arquitectura alineada con la referencia (ADR-0009) | ✅ |

## Próximos pasos (después de la sustentación)

| Prioridad | Tarea | Motivo | Referencia |
|---|---|---|---|
| Alta | Conectar un proveedor real de SMS con reintentos y tiempo límite | Hoy el OTP funciona en modo de prueba | `docs/arquitectura/09-evolucion.md` §9.2 |
| Alta | Desplegar en un dominio con HTTPS | Usar la gente real | `docker-compose.yml`, `SECURITY.md` |
| Alta | Respaldo diario de MySQL y prueba de restauración | Riesgo R7 | `05-computacional-y-despliegue.md` |
| Media | Repetir la prueba de carga con MySQL en el servidor | Riesgo R6 | `simulacion.py --carga` |
| Media | Mover OTP y límite por IP a Redis | Poder tener varias instancias | ADR-0004, riesgo R3 |
| Baja | Avisos por WhatsApp o SMS cuando falten 10 minutos | Menos ausencias | — |
| Baja | Versión `/api/v2` con sobre `{"data": ...}` si se abre a terceros | Contrato estándar | ADR-0009 |
