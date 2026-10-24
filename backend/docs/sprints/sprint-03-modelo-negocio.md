# SPRINT 03 — MODELO DE NEGOCIO, FRANJAS Y RESERVAS

## 1. Información general

**Proyecto:** FilaCero — Gestión inteligente de turnos y tiempos de atención  
**Sprint:** 03  
**Nombre:** Modelo de negocio, franjas y reservas  
**Estado:** En validación funcional

---

## 2. Objetivo

Implementar el modelo de negocio principal de FilaCero mediante la gestión de sedes o puntos de atención, trámites, franjas horarias y turnos.

Este sprint establece el flujo que permite consultar disponibilidad, reservar un turno y administrar la cancelación de reservas, manteniendo la separación de responsabilidades definida en la arquitectura del proyecto.

## 3. Alcance funcional

El sprint contempla:

- Modelado de sedes o puntos de atención.
- Modelado de trámites.
- Definición de franjas horarias con capacidad limitada.
- Consulta pública de disponibilidad.
- Reserva de turnos por usuarios autenticados.
- Consulta de turnos del usuario autenticado.
- Cancelación de turnos propios que permanezcan en espera.
- Validación de disponibilidad y prevención de reservas duplicadas activas.
- Persistencia mediante SQLAlchemy y MySQL.
- Migraciones controladas mediante Flask-Migrate y Alembic.

## 4. Dominios involucrados

| Dominio | Responsabilidad |
|---|---|
| Sedes | Representar los puntos físicos de atención |
| Trámites | Definir los servicios disponibles |
| Franjas | Establecer fechas, horarios y capacidad |
| Turnos | Registrar y controlar las reservas |
| Usuarios | Identificar al cliente que realiza una reserva |

## 5. Arquitectura del módulo

Los dominios siguen la arquitectura modular establecida en los sprints anteriores.

```text
Solicitud HTTP
      |
      v
Controlador
      |
      v
Validación de datos
      |
      v
Servicio de negocio
      |
      v
Repositorio / SQLAlchemy
      |
      v
Base de datos
      |
      v
Respuesta JSON
```

Los controladores gestionan las solicitudes HTTP, los servicios aplican las reglas del negocio y los modelos representan las entidades persistidas.

## 6. Modelo de datos

### 6.1. Sedes o puntos de atención

Representan los lugares donde se prestan los servicios.

La estructura definitiva debe corresponder al modelo implementado en `app/dominios/sedes/modelos.py`.

### 6.2. Trámites

Representan los servicios que un usuario puede solicitar.

Su disponibilidad debe estar relacionada con los puntos de atención habilitados.

### 6.3. Franjas horarias

Una franja representa un intervalo de atención asociado a un punto de atención y a un trámite.

Debe contemplar:

- Identificador.
- Punto de atención.
- Trámite.
- Fecha.
- Hora de inicio.
- Hora de finalización.
- Capacidad máxima.
- Estado activo.

La capacidad debe ser positiva y el horario debe tener un intervalo válido.

### 6.4. Turnos

Representan las reservas efectuadas por los usuarios.

El modelo debe permitir identificar la franja reservada, el usuario propietario, el código del turno y su estado.

Los nombres definitivos de los campos deben coincidir con los modelos existentes y las migraciones del proyecto.

## 7. Reglas de negocio

1. El usuario debe estar autenticado para reservar un turno.
2. El usuario, el punto de atención y el trámite deben estar activos.
3. La franja debe existir, estar activa y corresponder al punto de atención y al trámite seleccionados.
4. No se deben aceptar reservas para franjas que ya hayan comenzado.
5. La cantidad de reservas activas no puede superar la capacidad de la franja.
6. No se deben permitir reservas activas duplicadas para el mismo usuario y la misma franja.
7. El cliente solo puede consultar y cancelar sus propios turnos mediante los endpoints protegidos.
8. Solo se pueden cancelar turnos que estén en estado de espera.
9. Una cancelación válida debe liberar capacidad para nuevas reservas.
10. Las operaciones deben preservar la integridad de los datos y las relaciones entre entidades.

## 8. Endpoints

| Método | Endpoint | Acceso |
|---|---|---|
| GET | `/api/v1/sedes/` | Público |
| GET | `/api/v1/tramites/` | Público |
| GET | `/api/v1/franjas/` | Público |
| POST | `/api/v1/turnos/` | JWT |
| GET | `/api/v1/turnos/mis-turnos` | JWT |
| POST | `/api/v1/turnos/<id>/cancelar` | JWT |

### 8.1. Consultar disponibilidad

`GET /api/v1/franjas/?punto_id=1&tramite_id=1&fecha=2026-12-01`

Los filtros permiten consultar las franjas según el punto de atención, el trámite y la fecha.

La respuesta debe informar los datos de la franja, la capacidad, las reservas contabilizadas y los cupos disponibles.

### 8.2. Reservar un turno

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

Una reserva válida debe devolver HTTP 201 y la información del turno creado.

### 8.3. Consultar mis turnos

`GET /api/v1/turnos/mis-turnos`

Requiere JWT. Los resultados deben limitarse al usuario autenticado.

### 8.4. Cancelar un turno

`POST /api/v1/turnos/<id>/cancelar`

Requiere JWT. El backend debe comprobar la propiedad del turno y su estado antes de cancelar.

## 9. Seguridad

- Validar el token JWT en las operaciones protegidas.
- Obtener la identidad del usuario a partir del token.
- No confiar en un identificador de usuario enviado por el cliente para determinar la propiedad de la reserva.
- Validar los identificadores y datos recibidos.
- Impedir el acceso o la cancelación de turnos pertenecientes a otros usuarios.
- Mantener las credenciales y secretos en variables de entorno.

## 10. Persistencia y migraciones

La implementación utiliza SQLAlchemy y Flask-Migrate.

Las tablas documentadas para este sprint son:

- `puntos`
- `tramites`
- `franjas`
- `turnos`

La tabla `usuarios` existente debe conservarse.

Antes de aplicar cambios en la base de datos, se deben revisar las migraciones generadas y verificar que no eliminen información existente.

## 11. Pruebas

Ejecutar desde `backend`, con el entorno virtual activo:

```powershell
python -m pytest -q
```

La validación debe cubrir:

- Consulta de sedes, trámites y franjas.
- Filtrado de disponibilidad.
- Reserva con JWT válido.
- Rechazo de solicitudes sin autenticación.
- Rechazo de reservas cuando no existe capacidad.
- Prevención de reservas duplicadas.
- Rechazo de franjas inactivas o que ya comenzaron.
- Consulta de turnos del usuario autenticado.
- Rechazo de cancelaciones de turnos ajenos.
- Cancelación de turnos en espera.
- Liberación de capacidad tras cancelar.

## 12. Criterios de aceptación

El sprint podrá considerarse validado cuando:

- Los modelos estén correctamente relacionados.
- Las migraciones se apliquen sin perder información.
- Los endpoints respondan según el contrato definido.
- Las reglas de reserva y cancelación estén verificadas.
- Las pruebas automatizadas pasen.
- Se documenten las limitaciones pendientes, especialmente las relacionadas con concurrencia en MySQL.

## 13. Pendientes

- Verificar el comportamiento real de los modelos y servicios existentes.
- Confirmar el resultado de las pruebas automatizadas.
- Validar concurrencia y sobreventa de cupos contra MySQL.
- Revisar las restricciones de integridad y los índices.
- Actualizar el README con los resultados comprobados.

## 14. Resultado esperado

Al finalizar este sprint, FilaCero contará con el flujo central de reservas preparado para integrarse con las funcionalidades administrativas y el recorrido del cliente.

El estado de completitud debe actualizarse únicamente después de verificar el código, las migraciones y las pruebas.

---

**Proyecto:** FilaCero  
**Área:** Arquitectura de Software y Computacional  
**Sprint:** 03 — Modelo de negocio, franjas y reservas