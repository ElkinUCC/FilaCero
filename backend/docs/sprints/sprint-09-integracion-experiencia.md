# Sprint 09 — Integración frontend-backend y experiencia de usuario

**Proyecto:** FilaCero — Gestión inteligente de turnos  
**Estado:** Integración funcional desarrollada; pulido visual final identificado como actividad de cierre.

## Objetivo
Integrar los recorridos de cliente, agente y administrador con la API REST y consolidar una experiencia coherente. Las reglas críticas de negocio permanecen en el backend.

## Historias de usuario
| ID | Actor | Historia | Criterios de aceptación |
|---|---|---|---|
| HU-38 | Cliente | Como cliente, quiero reservar mediante pasos consecutivos para completar el proceso fácilmente. | Se solicitan sede, trámite, horario y datos progresivamente; volver no borra selecciones. |
| HU-39 | Cliente | Como cliente, quiero ver horarios disponibles para elegir una opción válida. | La vista consume disponibilidad del backend y maneja lista vacía y errores. |
| HU-40 | Cliente | Como cliente, quiero consultar mi turno y conocer su código y estado. | Se presenta información correspondiente a la reserva consultada. |
| HU-41 | Agente | Como agente, quiero operar la cola desde una consola web. | La interfaz refleja el ciclo operativo y los permisos del agente. |
| HU-42 | Administrador | Como administrador, quiero gestionar recursos y consultar indicadores desde un panel. | Las acciones corresponden al rol ADMIN y a las respuestas API. |
| HU-43 | Todos | Como usuario, quiero mensajes claros de carga, éxito y error. | Cada operación informa su estado y libera controles al terminar. |

## Alcance
- Integración del frontend (HTML + CSS + JS puro) con endpoints Flask.
- Gestión centralizada de solicitudes y JWT.
- Flujo de reserva del cliente.
- Manejo de estados de carga, error y resultados vacíos.
- Vistas diferenciadas por rol.
- Consulta de disponibilidad por sede, trámite y fecha.
- Consola de agentes y ciclo de atención.
- Administración, métricas e historial.

## Flujo de reserva
1. Selección de sede.
2. Selección de trámite.
3. Selección de fecha y horario.
4. Captura y validación de datos.
5. Confirmación.
6. Presentación del código y resumen del turno.

El backend vuelve a validar capacidad y reglas al confirmar la reserva; la disponibilidad mostrada en pantalla no garantiza por sí sola un cupo.

## Reglas de experiencia
- Mostrar un paso principal a la vez.
- Mantener visible el progreso.
- Permitir regresar sin perder selecciones.
- Reducir scroll y espacios vacíos innecesarios.
- Utilizar mensajes concretos y accesibles.
- Mantener consistencia entre cliente, agente y administrador.
- Adaptar la interfaz a escritorio y móvil.

## Integración y diagnóstico
Durante la depuración se observó la consulta `GET /api/v1/franjas/disponibles`. Una respuesta con `cantidad: 0` y `franjas: []` puede ser válida si no hay franjas configuradas para la fecha o si la fecha no cumple la regla de atención. La configuración final de días de servicio debe coincidir con las franjas creadas.

## Criterios de aceptación
- El frontend consulta sedes, trámites y disponibilidad desde la API.
- El flujo del cliente presenta un paso a la vez.
- Los estados vacíos y errores se comunican claramente.
- Las vistas respetan permisos.
- Las operaciones críticas persisten en backend.
- La interfaz funciona en escritorio y móvil.
- No se exponen secretos en el frontend.

## Evidencias
- Capturas de reserva por pasos.
- Respuesta de disponibilidad en Network.
- Capturas de consola de agente y panel administrador.
- Evidencia de confirmación de turno.
- Pruebas automatizadas de integración.

## Pendiente de cierre visual
En la revisión con el profesor se identificó la necesidad de reducir el color verde dominante, compactar espacios, reducir scroll y hacer que el contenido cambie paso a paso. Si estos ajustes aún no se han aplicado y probado, deben quedar como pendientes de presentación, no como terminados.

## Resultado
El sprint documenta la integración de los roles y el flujo web. Su aceptación final requiere una reserva de extremo a extremo y evidencias visuales de cada rol.

## Cierre en la entrega final

Los pendientes registrados en este sprint quedaron resueltos así:

- Los ajustes visuales pedidos se aplicaron en las iteraciones E-1 y E-1d: nueva paleta del portal, reserva paso a paso y vista compacta para celular (ver `docs/arquitectura/10-evolucion.md`).
- La reserva de extremo a extremo se comprobó en el navegador y quedó guardada en MySQL; hay capturas de cada rol en el informe HTML.
