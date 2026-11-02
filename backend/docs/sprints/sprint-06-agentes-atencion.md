# Sprint 06 — Consola de agentes y ciclo de atención

**Proyecto:** FilaCero  
**Estado:** Implementado y validado localmente según las evidencias compartidas durante el desarrollo.

## Objetivo
Permitir que los agentes gestionen la cola de turnos de su sede y ejecuten el ciclo de atención desde una consola operativa.

## Historias de usuario
| ID | Historia | Criterios de aceptación |
|---|---|---|
| HU-22 | Como agente, quiero consultar la cola de mi sede. | La cola contiene turnos del ámbito autorizado y respeta el orden de despacho. |
| HU-23 | Como agente, quiero llamar al siguiente cliente. | El turno pasa a estado LLAMADO y queda asociado al agente cuando la operación es válida. |
| HU-24 | Como agente, quiero iniciar la atención. | Solo se inicia un turno en estado permitido y se registra la hora. |
| HU-25 | Como agente, quiero finalizar la atención. | Se registra la finalización y el turno pasa al estado terminal definido. |
| HU-26 | Como agente, quiero consultar el turno actual. | Se devuelve el turno activo del agente autenticado o null si no existe. |

## Alcance
- Asociación de agentes con sedes.
- Consulta de cola operativa.
- Llamado del siguiente turno.
- Inicio y finalización de atención.
- Validación de rol, sede y transiciones de estado.
- Registro de tiempos de atención.

## Arquitectura
```text
Agente -> React -> API Flask -> JWT/Rol -> Servicio de atención
       -> SQLAlchemy -> MySQL
```

## Evidencias registradas
- Migración `a91c6d8e42f0` aplicada según evidencia compartida.
- `flask db current` reportó `a91c6d8e42f0 (head)`.
- `flask db check` no detectó cambios pendientes en esa validación.
- Las rutas operativas quedaron registradas.
- La suite posterior al Sprint 07 reportó 30 pruebas aprobadas; ese total no debe atribuirse exclusivamente a este sprint.

## Criterios de aceptación
- Usuarios sin rol AGENTE no ejecutan operaciones de atención.
- El agente opera solo dentro del ámbito permitido.
- Las transiciones inválidas se rechazan.
- Inicio y fin quedan registrados.
- La cola refleja las operaciones ejecutadas.

## Pendientes de evidencia
- Adjuntar solicitudes y respuestas Postman.
- Conservar capturas de cola, llamado y atención en curso.
- Revalidar con la versión final de base de datos.

## Resultado
El sprint conecta las reservas de los clientes con la atención presencial realizada por los agentes.
