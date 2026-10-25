# Sprint 07 — Administración, métricas e historial de turnos

**Proyecto:** FilaCero  
**Módulo:** Backend — Flask REST API  
**Sprint:** 07  
**Estado:** Implementado y validado mediante pruebas automatizadas locales  
**Sprint anterior:** Sprint 06 — Agentes y atención de turnos

---

## 1. Objetivo

Ampliar las funcionalidades administrativas y operativas de FilaCero mediante la consulta y gestión de agentes, la asignación y desasignación de sedes, la consulta del turno actual, las métricas de atención y el historial paginado de turnos.

Las funcionalidades deben conservar la arquitectura modular del backend, utilizar los mecanismos de autenticación JWT existentes y respetar los permisos asociados a los roles del sistema.

## 2. Alcance

El sprint contempla las siguientes funcionalidades:

- Listar agentes registrados.
- Asignar una sede a un agente.
- Desasignar la sede de un agente.
- Consultar el turno actual del agente autenticado.
- Obtener métricas generales de turnos.
- Consultar métricas agrupadas por sede.
- Consultar métricas agrupadas por trámite.
- Consultar el historial de turnos mediante paginación.
- Filtrar las métricas y el historial por fechas, sede, trámite y estado.
- Validar los permisos de acceso según el rol del usuario.
- Verificar la integración de las rutas con la aplicación Flask.

## 3. Arquitectura y componentes involucrados

El desarrollo conserva la arquitectura modular del backend de FilaCero.

| Componente | Responsabilidad |
|---|---|
| `app/dominios/agentes/controladores.py` | Define las rutas de agentes y administración. |
| `app/dominios/agentes/servicios.py` | Implementa las operaciones del ciclo de atención. |
| `app/dominios/turnos/modelos.py` | Define la entidad Turno y sus relaciones. |
| `app/dominios/turnos/dtos.py` | Serializa la información de los turnos para las respuestas de la API. |
| `app/dominios/usuarios/modelos.py` | Define usuarios, roles, estado y sede asignada. |
| `app/dominios/sedes/modelos.py` | Define las sedes del sistema. |
| `app/__init__.py` | Registra los blueprints de la aplicación Flask. |

La implementación utiliza Flask, Flask-JWT-Extended, SQLAlchemy y los modelos existentes del proyecto.

## 4. Endpoints implementados

Todos los endpoints administrativos requieren un JWT válido y el rol `ADMIN`. Los endpoints operativos de agentes requieren un JWT válido y el rol `AGENTE`.

| Método | Endpoint | Rol | Funcionalidad |
|---|---|---|---|
| GET | `/api/v1/admin/agentes/` | ADMIN | Lista los agentes. |
| POST | `/api/v1/admin/agentes/{usuario_id}/sede` | ADMIN | Asigna una sede a un agente. |
| DELETE | `/api/v1/admin/agentes/{usuario_id}/sede` | ADMIN | Elimina la asignación de sede. |
| GET | `/api/v1/admin/agentes/metricas` | ADMIN | Consulta las métricas generales. |
| GET | `/api/v1/admin/agentes/historial` | ADMIN | Consulta el historial paginado. |
| GET | `/api/v1/admin/agentes/metricas/sedes` | ADMIN | Agrupa los turnos por sede. |
| GET | `/api/v1/admin/agentes/metricas/tramites` | ADMIN | Agrupa los turnos por trámite. |
| GET | `/api/v1/agente/actual` | AGENTE | Consulta el turno actual del agente. |

Los endpoints del ciclo operativo que ya existían desde el Sprint 06 se conservan:

| Método | Endpoint | Rol |
|---|---|---|
| GET | `/api/v1/agente/cola` | AGENTE |
| POST | `/api/v1/agente/llamar-siguiente` | AGENTE |
| POST | `/api/v1/agente/turnos/{turno_id}/iniciar` | AGENTE |
| POST | `/api/v1/agente/turnos/{turno_id}/finalizar` | AGENTE |

## 5. Descripción funcional

### 5.1. Listado de agentes

Permite consultar los usuarios cuyo rol es `AGENTE`.

La respuesta incluye información como:

- Identificador del agente.
- Nombre.
- Correo electrónico.
- Estado de actividad.
- Identificador de la sede asignada.
- Nombre de la sede cuando existe una asignación.

### 5.2. Asignación de sede

Permite que un administrador asigne una sede a un agente activo.

**Ejemplo de solicitud:**

```http
POST /api/v1/admin/agentes/3/sede
Content-Type: application/json
Authorization: Bearer <token_admin>
```

Cuerpo JSON:

```json
{
  "punto_id": 1
}
```

La operación verifica que exista un agente activo con el identificador suministrado y que la sede exista y esté activa.

### 5.3. Desasignación de sede

Permite eliminar la sede asociada a un agente.

La operación verifica que el agente exista y tenga una sede asignada antes de guardar el cambio.

### 5.4. Consulta del turno actual

El endpoint `/api/v1/agente/actual` consulta los turnos asociados al agente autenticado que estén en estado `LLAMADO` o `EN_ATENCION`.

Si no existe un turno en esos estados, devuelve `null` en el campo `turno`.

### 5.5. Métricas generales

El endpoint `/api/v1/admin/agentes/metricas` presenta:

- Total de turnos.
- Cantidad de turnos por estado.
- Turnos atendidos.
- Turnos cancelados.
- Turnos en espera.
- Turnos en proceso.
- Duración promedio de atención en segundos, cuando existen datos válidos de inicio y finalización.

Admite filtros por fecha inicial, fecha final, sede, trámite y estado.

### 5.6. Métricas por sede

El endpoint `/api/v1/admin/agentes/metricas/sedes` agrupa los turnos según su identificador de sede y devuelve el total correspondiente a cada grupo.

### 5.7. Métricas por trámite

El endpoint `/api/v1/admin/agentes/metricas/tramites` agrupa los turnos según su identificador de trámite y devuelve el total correspondiente a cada grupo.

### 5.8. Historial paginado

El endpoint `/api/v1/admin/agentes/historial` permite consultar los turnos en páginas.

Parámetros disponibles:

| Parámetro | Descripción |
|---|---|
| `pagina` | Número de página; debe ser mayor o igual a 1. |
| `por_pagina` | Registros por página; admite valores entre 1 y 100. |
| `desde` | Fecha inicial con formato `YYYY-MM-DD`. |
| `hasta` | Fecha final con formato `YYYY-MM-DD`. |
| `punto_id` | Identificador positivo de la sede. |
| `tramite_id` | Identificador positivo del trámite. |
| `estado` | Estado válido del turno. |

Ejemplo:

```http
GET /api/v1/admin/agentes/historial?pagina=1&por_pagina=20&estado=ATENDIDO
Authorization: Bearer <token_admin>
```

La respuesta incluye la página actual, el tamaño de página, el total de registros, el total de páginas y la lista de turnos.

## 6. Seguridad y autorización

Las rutas administrativas verifican que el JWT contenga el rol `ADMIN`.

Las rutas de la consola operativa de agentes verifican que el JWT contenga el rol `AGENTE`.

Las operaciones administrativas que modifican asignaciones verifican la existencia y el estado de los registros relacionados.

El ciclo de atención implementado en el Sprint 06 conserva sus validaciones de negocio para impedir operaciones que no correspondan al estado del turno o a la sede del agente.

**Consideración:** la colección Postman deberá incluir pruebas negativas para comprobar que los usuarios sin autorización reciben respuestas HTTP apropiadas.

## 7. Manejo de errores y validaciones

Las validaciones incorporadas contemplan:

- Formato inválido de fechas.
- Fecha inicial posterior a la fecha final.
- Identificadores de sede o trámite que no sean enteros positivos.
- Estados de turno no reconocidos.
- Números de página inferiores a 1.
- Tamaños de página fuera del rango permitido.
- Agentes inexistentes o inactivos para la asignación.
- Sedes inexistentes o inactivas.
- Intentos de desasignación cuando no existe una sede asociada.

Las respuestas de error se devuelven en formato JSON.

## 8. Cambios en la base de datos

El Sprint 07 reutiliza los campos incorporados en el Sprint 06:

- `usuarios.punto_asignado_id`
- `turnos.agente_id`
- `turnos.fecha_inicio`
- `turnos.fecha_fin`

No fue necesaria una nueva migración de base de datos para las funcionalidades descritas en este sprint.

La migración registrada para el Sprint 06 es `a91c6d8e42f0`.

## 9. Validación ejecutada

### 9.1. Pruebas automatizadas

Comando ejecutado:

```powershell
python -m pytest -q
```

Resultado compartido:

```text
30 passed, 59 warnings in 2.78s
```

La suite de pruebas terminó satisfactoriamente. Los avisos reportados corresponden a la obsolescencia de `datetime.utcnow()` en el entorno utilizado.

### 9.2. Verificación de rutas

Comando ejecutado:

```powershell
flask routes
```

Se confirmó que Flask registró las rutas administrativas y operativas añadidas, entre ellas:

- `/api/v1/admin/agentes/`
- `/api/v1/admin/agentes/metricas`
- `/api/v1/admin/agentes/historial`
- `/api/v1/admin/agentes/metricas/sedes`
- `/api/v1/admin/agentes/metricas/tramites`
- `/api/v1/agente/actual`

### 9.3. Estado de las migraciones

En la validación anterior del Sprint 06 se reportó:

- Migración actual: `a91c6d8e42f0 (head)`.
- `flask db check`: no se detectaron nuevas operaciones de migración.

No se requirió generar otra migración para el Sprint 07.

## 10. Evidencias del sprint

Las siguientes evidencias deben conservarse en el repositorio:

1. Salida completa de `python -m pytest -q`.
2. Salida de `flask routes`.
3. Resultado de `flask db current` y `flask db check`, cuando corresponda.
4. Capturas de las solicitudes y respuestas de Postman.
5. Colección Postman exportada con los endpoints administrativos y operativos.
6. Evidencias de respuestas de autorización y validación.

Las evidencias de consola de pruebas y rutas ya fueron compartidas durante el desarrollo. La colección Postman y las capturas de solicitudes HTTP quedan pendientes de completar y archivar.

## 11. Criterios de aceptación

| Criterio | Estado |
|---|---|
| Las rutas administrativas aparecen registradas en Flask. | Cumplido según la salida compartida. |
| Las rutas operativas de agentes aparecen registradas. | Cumplido según la salida compartida. |
| La suite automatizada termina sin fallos. | Cumplido: 30 pruebas aprobadas. |
| Se conservan los mecanismos de autorización por rol. | Implementado; conservar pruebas como evidencia. |
| Las métricas y el historial admiten filtros. | Implementado en los controladores. |
| La base de datos requiere una nueva migración para este sprint. | No requerida. |
| Todos los endpoints fueron probados individualmente desde Postman. | Pendiente de evidencia. |
| La colección Postman está exportada y archivada. | Pendiente de confirmar. |

## 12. Riesgos y pendientes

### Pendientes técnicos

- Revisar los avisos relacionados con `datetime.utcnow()` y unificar el manejo de fechas y horas.
- Verificar que la duración promedio de atención sea coherente con las reglas de negocio y los datos disponibles.
- Probar individualmente los endpoints administrativos y operativos desde Postman.
- Verificar respuestas para solicitudes sin JWT, con rol incorrecto y con parámetros inválidos.
- Confirmar el comportamiento de los filtros con diferentes combinaciones de parámetros.

### Pendientes de documentación

- Exportar la colección Postman.
- Documentar variables de entorno y autenticación.
- Adjuntar evidencias de solicitudes y respuestas HTTP.
- Mantener actualizado el README general del backend.

## 13. Resultado final

El Sprint 07 amplía el backend de FilaCero con funcionalidades administrativas, métricas, consulta del turno actual e historial paginado. De acuerdo con las evidencias compartidas, la suite automatizada terminó con 30 pruebas aprobadas y las rutas correspondientes quedaron registradas en Flask.

La validación de la ejecución automatizada está completada para el estado reportado. La comprobación individual de endpoints mediante Postman y el archivo de evidencias deben completarse para cerrar la documentación integral del sprint.
