
# FilaCero — Referencia de API

## Base URL local

`http://127.0.0.1:5000`

## Autenticación

Las rutas protegidas utilizan JWT mediante el encabezado:

`Authorization: Bearer <token>`

Roles utilizados:
- `CLIENTE`
- `AGENTE`
- `ADMIN`

Cada endpoint debe validarse con el rol esperado. La respuesta concreta depende de la implementación del controlador.

## Salud del servicio

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/` | Endpoint de inicio. |
| GET | `/health` | Comprobación de salud. |

## Usuarios

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/v1/usuarios/registro` | Registrar usuario. |
| POST | `/api/v1/usuarios/login` | Autenticar usuario. |

## Sedes

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/v1/sedes/` | Consultar sedes. |
| POST | `/api/v1/sedes/` | Crear sede. |
| PUT | `/api/v1/sedes/{punto_id}` | Actualizar sede. |
| DELETE | `/api/v1/sedes/{punto_id}` | Eliminar sede. |

## Trámites

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/v1/tramites/` | Consultar trámites. |
| POST | `/api/v1/tramites/` | Crear trámite. |
| PUT | `/api/v1/tramites/{tramite_id}` | Actualizar trámite. |
| DELETE | `/api/v1/tramites/{tramite_id}` | Eliminar trámite. |

## Franjas

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/v1/franjas/` | Consultar franjas. |
| POST | `/api/v1/admin/franjas/` | Crear franja. |
| PATCH | `/api/v1/admin/franjas/{franja_id}` | Cambiar estado de franja. |

## Turnos de cliente

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/v1/turnos/` | Solicitar turno. |
| GET | `/api/v1/turnos/mis-turnos` | Consultar turnos propios. |
| POST | `/api/v1/turnos/{turno_id}/cancelar` | Cancelar turno propio. |

## Operación de agentes

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/v1/agente/cola` | Consultar cola. |
| GET | `/api/v1/agente/actual` | Consultar turno actual. |
| POST | `/api/v1/agente/llamar-siguiente` | Llamar siguiente turno. |
| POST | `/api/v1/agente/turnos/{turno_id}/iniciar` | Iniciar atención. |
| POST | `/api/v1/agente/turnos/{turno_id}/finalizar` | Finalizar atención. |

## Administración de agentes

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/v1/admin/agentes/` | Listar agentes. |
| POST | `/api/v1/admin/agentes/{usuario_id}/sede` | Asignar sede. |
| DELETE | `/api/v1/admin/agentes/{usuario_id}/sede` | Desasignar sede. |
| GET | `/api/v1/admin/agentes/metricas` | Métricas generales. |
| GET | `/api/v1/admin/agentes/historial` | Historial paginado. |
| GET | `/api/v1/admin/agentes/metricas/sedes` | Métricas por sede. |
| GET | `/api/v1/admin/agentes/metricas/tramites` | Métricas por trámite. |

## Notas

- Las rutas reflejan el listado confirmado mediante `flask routes`.
- Los campos obligatorios de cada cuerpo deben documentarse desde el controlador correspondiente.
- Los códigos HTTP y los ejemplos de respuesta deben completarse a partir de pruebas ejecutadas.
