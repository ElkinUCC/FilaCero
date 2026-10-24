# FilaCero — Sprint 4: Administración

## Funciones
- Crear, actualizar y eliminar sedes.
- Crear, actualizar y eliminar trámites.
- Crear franjas horarias y activar/desactivar franjas.
- Las operaciones de escritura requieren JWT con claim `rol=ADMIN`.
- Las sedes y trámites relacionados con turnos o franjas no se eliminan:
  deben desactivarse para conservar el historial.

## Endpoints administrativos

| Método | Endpoint | Acción |
|---|---|---|
| POST | `/api/v1/sedes/` | Crear sede |
| PUT | `/api/v1/sedes/<id>` | Actualizar sede |
| DELETE | `/api/v1/sedes/<id>` | Eliminar sede sin dependencias |
| POST | `/api/v1/tramites/` | Crear trámite |
| PUT | `/api/v1/tramites/<id>` | Actualizar trámite |
| DELETE | `/api/v1/tramites/<id>` | Eliminar trámite sin dependencias |
| POST | `/api/v1/admin/franjas/` | Crear franja |
| PATCH | `/api/v1/admin/franjas/<id>` | Activar/desactivar franja |

## Crear franja
Enviar:
`{"punto_id":1,"tramite_id":1,"fecha":"2026-12-01","hora_inicio":"09:00","hora_fin":"09:30","capacidad":10}`

## Seguridad
El rol se lee del JWT. Para asignar el rol ADMIN se debe usar un proceso
administrativo seguro; el registro público no debe aceptar el rol enviado
por el cliente.

## Pruebas
Ejecutar `python -m pytest -q`.
