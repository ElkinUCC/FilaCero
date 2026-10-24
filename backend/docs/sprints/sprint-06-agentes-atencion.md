# Sprint 06 — Agentes y atención de turnos

## Objetivo
Implementar el ciclo de atención de turnos mediante una consola operativa protegida por roles y asociada a una sede.

## Cambios del modelo
- Usuario: campo opcional `punto_asignado_id`.
- Turno: campos opcionales `agente_id`, `fecha_inicio` y `fecha_fin`.
- Estados operativos: `ESPERANDO`, `LLAMADO`, `EN_ATENCION`, `ATENDIDO`.
- La cancelación existente conserva el estado `CANCELADO`.

## Endpoints

| Método | Endpoint | Rol |
|---|---|---|
| GET | `/api/v1/agente/cola` | AGENTE |
| POST | `/api/v1/agente/llamar-siguiente` | AGENTE |
| POST | `/api/v1/agente/turnos/{id}/iniciar` | AGENTE |
| POST | `/api/v1/agente/turnos/{id}/finalizar` | AGENTE |
| POST | `/api/v1/admin/agentes/{id}/sede` | ADMIN |

Todos requieren un JWT válido.

### Asignar una sede

Cuerpo JSON:

    {
      "punto_id": 1
    }

### Reglas de negocio
- El agente debe estar activo y tener una sede activa asignada.
- Solo puede atender turnos de su sede.
- Solo se llama un turno que esté en espera.
- La atención debe comenzar antes de finalizarse.
- Cada operación debe comprobar el estado actual y la asignación del agente.

## Validación
- Pruebas automatizadas del ciclo de atención.
- Pruebas de autorización por rol.
- Pruebas de aislamiento entre sedes.
- Validación de migraciones y rutas registradas.

## Pendiente de confirmar
Este documento describe los cambios propuestos. El sprint solo se considera validado cuando las pruebas se ejecuten satisfactoriamente en el entorno local y la migración se aplique correctamente.
