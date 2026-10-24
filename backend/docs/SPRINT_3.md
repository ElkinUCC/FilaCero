# FilaCero — Sprint 3: Franjas y reservas

## Objetivo
Permitir consultar disponibilidad y reservar turnos asociados a una sede,
un trámite y una franja horaria con capacidad definida.

## Implementado
- Modelo Franja con fecha, horas, capacidad y estado activo.
- Relaciones entre sedes, trámites, franjas, usuarios y turnos.
- Consulta pública de disponibilidad.
- Reserva de turnos con JWT y validación de usuario, sede, trámite y franja.
- Código de turno único con prefijo FC y fecha.
- Control de capacidad y prevención de reservas duplicadas activas.
- Cancelación del turno propio cuando está en estado ESPERANDO.
- La cancelación libera capacidad para una nueva reserva.
- Restricciones de base de datos para capacidad positiva, horarios válidos
  y combinación de sede, trámite, fecha y hora de inicio.

## Endpoints
| Método | Endpoint | Acceso |
|---|---|---|
| GET | `/api/v1/franjas/` | Público |
| GET | `/api/v1/sedes/` | Público |
| GET | `/api/v1/tramites/` | Público |
| POST | `/api/v1/turnos/` | JWT |
| GET | `/api/v1/turnos/mis-turnos` | JWT |
| POST | `/api/v1/turnos/<id>/cancelar` | JWT |

### Consultar franjas
`GET /api/v1/franjas/?punto_id=1&tramite_id=1&fecha=AAAA-MM-DD`

Los filtros son opcionales. La respuesta incluye capacidad, reservados,
disponibles y si la franja tiene cupos.

### Crear reserva
Enviar token JWT y JSON:
`{"tramite_id": 1, "punto_id": 1, "franja_id": 1}`

Una reserva exitosa devuelve HTTP 201.

## Base de datos
Migración Alembic: `sprint 3 franjas y reservas`.
Tablas creadas: `puntos`, `tramites`, `franjas`, `turnos`.
La tabla `usuarios` existente se conserva.

## Pruebas
Ejecutar `python -m pytest -q`.
Las pruebas usan SQLite en memoria y no necesitan datos de MySQL.

## Pendientes
- Interfaz web del cliente en Sprint 5.
- Administración protegida de sedes, trámites y franjas en Sprint 4.
- Pruebas de concurrencia reales contra MySQL.
- Revisar configuración de secretos antes de desplegar.
