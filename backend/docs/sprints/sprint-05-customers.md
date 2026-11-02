# SPRINT 05 — FLUJO COMPLETO DEL CLIENTE

## 1. Información general

**Proyecto:** FilaCero — Gestión inteligente de turnos y tiempos de atención  
**Sprint:** 05  
**Nombre:** Flujo completo del cliente  
**Estado:** Implementado; validar flujo final de extremo a extremo.

---

## 2. Objetivo

Consolidar el recorrido del cliente en FilaCero, desde la consulta de los puntos de atención y los trámites hasta la consulta de disponibilidad, reserva de un turno, seguimiento de su estado y cancelación cuando corresponda.

Este sprint integra los dominios desarrollados previamente y verifica que las funcionalidades estén disponibles mediante una API REST coherente, segura y preparada para una futura interfaz web.

## 3. Alcance funcional

El sprint contempla:

- Consultar los puntos de atención disponibles.
- Consultar los trámites disponibles.
- Consultar las franjas horarias.
- Filtrar la disponibilidad por punto de atención, trámite y fecha.
- Reservar turnos mediante JWT.
- Consultar los turnos del usuario autenticado.
- Cancelar turnos propios que permanezcan en espera.
- Validar la disponibilidad y la capacidad antes de reservar.
- Impedir reservas duplicadas activas.
- Proteger los datos personales y la propiedad de los turnos.
- Verificar el flujo completo mediante pruebas automatizadas.

Este sprint consolida el backend del cliente; no implica desarrollar todavía la interfaz gráfica.

## 4. Flujo funcional

```text
Inicio del cliente
        |
        v
Consultar puntos de atención
        |
        v
Seleccionar trámite
        |
        v
Consultar franjas disponibles
        |
        v
Seleccionar franja
        |
        v
Autenticación mediante JWT
        |
        v
Validar disponibilidad
        |
        v
Crear reserva
        |
        v
Obtener código del turno
        |
        v
Consultar mis turnos
        |
        v
Cancelar si corresponde
```

El backend debe validar cada operación independientemente, sin confiar en que el cliente haya seguido correctamente el orden de la interfaz.

## 5. Endpoints del cliente

| Método | Endpoint | Acceso |
|---|---|---|
| GET | `/api/v1/sedes/` | Público |
| GET | `/api/v1/tramites/` | Público |
| GET | `/api/v1/franjas/` | Público |
| POST | `/api/v1/turnos/` | JWT |
| GET | `/api/v1/turnos/mis-turnos` | JWT |
| POST | `/api/v1/turnos/<id>/cancelar` | JWT |

## 6. Consulta de puntos de atención

`GET /api/v1/sedes/`

Debe permitir consultar los puntos de atención habilitados para el cliente.

La respuesta debe exponer únicamente los datos necesarios para seleccionar el lugar donde se realizará el trámite.

## 7. Consulta de trámites

`GET /api/v1/tramites/`

Debe permitir consultar los trámites disponibles para el cliente.

Los trámites inactivos no deben ofrecerse como opciones disponibles para nuevas reservas.

## 8. Consulta de disponibilidad

`GET /api/v1/franjas/?punto_id=1&tramite_id=1&fecha=2026-12-01`

Los filtros son opcionales y permiten consultar las franjas correspondientes a un punto de atención, un trámite y una fecha.

La respuesta debe permitir identificar:

- Fecha de la franja.
- Hora de inicio y finalización.
- Capacidad máxima.
- Reservas contabilizadas.
- Cupos disponibles.
- Estado de disponibilidad.

La información debe calcularse a partir de los datos persistidos y de las reglas vigentes del negocio.

## 9. Reserva de turnos

`POST /api/v1/turnos/`

Encabezado:

`Authorization: Bearer <access_token>`

Cuerpo JSON:

```json
{
  "tramite_id": 1,
  "punto_id": 1,
  "franja_id": 1
}
```

### Validaciones obligatorias

1. El token debe ser válido.
2. El usuario autenticado debe existir y estar activo.
3. El punto de atención debe existir y estar activo.
4. El trámite debe existir y estar activo.
5. La franja debe existir, estar activa y corresponder al punto y al trámite.
6. La franja no debe haber comenzado.
7. Debe existir capacidad disponible.
8. No debe existir otra reserva activa equivalente del mismo usuario.
9. La operación debe preservar la integridad de la base de datos.

Una reserva exitosa debe devolver HTTP 201 y los datos del turno creado, incluido su código cuando corresponda.

## 10. Código y estado del turno

El código del turno debe permitir identificar la reserva de forma práctica.

La implementación documentada contempla un código con prefijo `FC` y una referencia a la fecha.

El formato definitivo debe coincidir con el servicio implementado y garantizar la unicidad exigida por el modelo de datos.

Los estados deben corresponder al ciclo de vida definido en el dominio de turnos. La cancelación del cliente debe respetar el estado permitido por las reglas de negocio.

## 11. Consulta de turnos propios

`GET /api/v1/turnos/mis-turnos`

Requiere JWT.

El backend debe identificar al usuario a partir del token y devolver únicamente los turnos que le pertenecen.

La consulta debe facilitar el seguimiento de las reservas sin exponer información de otros usuarios.

## 12. Cancelación de reservas

`POST /api/v1/turnos/<id>/cancelar`

Requiere JWT.

Antes de cancelar, el backend debe comprobar:

- Que el turno exista.
- Que pertenezca al usuario autenticado.
- Que se encuentre en el estado permitido para cancelar.
- Que la operación pueda completarse sin comprometer la integridad de los datos.

Una cancelación exitosa debe actualizar el estado del turno y liberar la capacidad correspondiente para futuras reservas.

Las cancelaciones de turnos ajenos o que ya no estén en espera deben rechazarse.

## 13. Seguridad

El flujo del cliente debe cumplir las siguientes reglas:

- Autenticación mediante JWT para las operaciones protegidas.
- Contraseñas almacenadas mediante hashes.
- Identificación del usuario mediante los claims confiables del token.
- Validación de propiedad de las reservas.
- Prohibición de consultar o cancelar turnos de otros usuarios.
- Validación de los identificadores recibidos.
- Gestión de secretos mediante variables de entorno.
- Respuestas de error sin información sensible.

## 14. Integridad y concurrencia

La disponibilidad mostrada al cliente es informativa: puede cambiar antes de confirmar una reserva.

Por eso, la capacidad debe verificarse nuevamente al realizar la reserva.

Las operaciones concurrentes no deben permitir que el número de reservas activas supere la capacidad configurada.

La solución debe verificarse específicamente contra MySQL. Las pruebas que utilicen SQLite en memoria son útiles para validar reglas funcionales, pero no demuestran por sí solas el comportamiento concurrente de MySQL.

## 15. Pruebas

Ejecutar desde `backend`:

```powershell
python -m pytest -q
```

El conjunto de pruebas debe cubrir:

- Consulta pública de puntos de atención.
- Consulta pública de trámites.
- Consulta y filtrado de franjas.
- Reserva con token válido.
- Rechazo de solicitudes protegidas sin autenticación.
- Rechazo de usuarios inactivos.
- Rechazo de franjas inactivas o vencidas.
- Prevención de reservas duplicadas.
- Prevención de sobreventa de cupos.
- Consulta exclusiva de turnos propios.
- Rechazo de cancelaciones de turnos ajenos.
- Cancelación válida de turnos en espera.
- Liberación de capacidad después de cancelar.
- Respuestas HTTP consistentes ante errores de validación.

## 16. Criterios de aceptación

El sprint podrá considerarse validado cuando:

- El recorrido completo del cliente funcione a través de la API.
- La autenticación y la autorización se apliquen correctamente.
- La disponibilidad corresponda a la información persistida.
- Las reservas respeten las reglas de negocio.
- La consulta y cancelación de turnos respeten la propiedad del usuario.
- Las pruebas automatizadas pasen.
- Se hayan documentado las limitaciones de concurrencia pendientes.
- Los endpoints mantengan compatibilidad con los dominios administrativos.

## 17. Pendientes

- Verificar los contratos reales de los endpoints.
- Confirmar que las respuestas JSON sean consistentes.
- Ejecutar las pruebas automatizadas.
- Validar las operaciones contra la base de datos.
- Probar la capacidad bajo solicitudes concurrentes.
- Preparar la integración futura con la interfaz web.

## 18. Resultado esperado

Al finalizar este sprint, FilaCero dispondrá de un flujo de cliente verificable desde la consulta de disponibilidad hasta la gestión de sus reservas.

Esta base permitirá avanzar hacia la interfaz web sin trasladar las reglas de negocio al frontend.

El sprint solo debe marcarse como completado cuando los criterios de aceptación hayan sido comprobados.

---

**Proyecto:** FilaCero  
**Área:** Arquitectura de Software y Computacional  
**Sprint:** 05 — Flujo completo del cliente


## Historias de usuario (HU)
| ID | Historia | Criterio de aceptación |
|---|---|---|
| HU-17 | Como cliente, quiero completar una reserva guiada. | El recorrido solicita sede, trámite, horario y datos de forma ordenada. |
| HU-18 | Como cliente, quiero verificar mi celular con OTP. | El código se valida; el modo de prueba se identifica como no productivo. |
| HU-19 | Como cliente, quiero obtener un código de turno. | La confirmación muestra identificador único y resumen. |
| HU-20 | Como cliente, quiero consultar mis turnos. | La consulta devuelve únicamente los turnos propios. |
| HU-21 | Como cliente, quiero cancelar una reserva permitida. | Se valida propiedad y estado y se libera capacidad. |

**Pendiente de integración externa:** si el entorno usa OTP de prueba, no documentar el envío SMS real como terminado.
