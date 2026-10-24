# SPRINT 04 — ADMINISTRACIÓN DEL SISTEMA

## 1. Información general

**Proyecto:** FilaCero — Gestión inteligente de turnos y tiempos de atención  
**Sprint:** 04  
**Nombre:** Administración del sistema  
**Estado:** Pendiente de validación funcional

---

## 2. Objetivo

Implementar las funcionalidades administrativas del backend para gestionar los puntos de atención, los trámites y las franjas horarias de FilaCero.

Las operaciones de modificación deben estar protegidas mediante JWT y autorización por roles, de forma que únicamente los usuarios con rol `ADMIN` puedan ejecutar acciones administrativas.

## 3. Alcance funcional

El sprint contempla:

- Crear puntos de atención.
- Consultar puntos de atención.
- Actualizar información de puntos de atención.
- Desactivar o eliminar puntos de atención cuando las reglas de integridad lo permitan.
- Crear trámites.
- Consultar trámites.
- Actualizar información de trámites.
- Desactivar o eliminar trámites cuando las reglas de integridad lo permitan.
- Crear franjas horarias.
- Activar y desactivar franjas.
- Proteger las operaciones administrativas mediante JWT y roles.
- Validar los datos recibidos antes de modificar la persistencia.

## 4. Arquitectura

Las funcionalidades administrativas deben respetar la arquitectura modular del proyecto.

```text
Administrador
      |
      v
API REST
      |
      v
Controlador
      |
      v
Autenticación JWT
      |
      v
Autorización ADMIN
      |
      v
DTO / Validación
      |
      v
Servicio de negocio
      |
      v
Repositorio / SQLAlchemy
      |
      v
MySQL
```

Los controladores reciben las solicitudes; los mecanismos de seguridad validan identidad y permisos; los servicios aplican las reglas del negocio y la persistencia se realiza mediante los modelos existentes.

## 5. Dominios involucrados

| Dominio | Responsabilidad |
|---|---|
| Sedes | Administración de los puntos de atención |
| Trámites | Administración de los servicios disponibles |
| Franjas | Creación y control del estado de los horarios |
| Usuarios y seguridad | Identificación y autorización del administrador |

## 6. Endpoints administrativos

| Método | Endpoint | Acción |
|---|---|---|
| POST | `/api/v1/sedes/` | Crear punto de atención |
| PUT | `/api/v1/sedes/<id>` | Actualizar punto de atención |
| DELETE | `/api/v1/sedes/<id>` | Eliminar cuando no existan dependencias |
| POST | `/api/v1/tramites/` | Crear trámite |
| PUT | `/api/v1/tramites/<id>` | Actualizar trámite |
| DELETE | `/api/v1/tramites/<id>` | Eliminar cuando no existan dependencias |
| POST | `/api/v1/admin/franjas/` | Crear franja |
| PATCH | `/api/v1/admin/franjas/<id>` | Activar o desactivar franja |

Los endpoints de consulta pública existentes deben mantenerse compatibles con el flujo del cliente.

## 7. Reglas de negocio

### 7.1. Administración de puntos de atención

- Validar los campos obligatorios.
- Evitar la creación de registros con información inválida.
- Validar la existencia del registro antes de actualizarlo o eliminarlo.
- Preservar la integridad de las franjas y los turnos asociados.
- Cuando existan dependencias históricas, utilizar la desactivación en lugar de eliminar físicamente el registro.

### 7.2. Administración de trámites

- Validar la información obligatoria del trámite.
- Comprobar la existencia del registro en operaciones de modificación.
- Evitar eliminar físicamente trámites que estén relacionados con franjas o turnos.
- Permitir la desactivación cuando sea necesario conservar el historial.

### 7.3. Administración de franjas

Una franja debe incluir, como mínimo, el punto de atención, el trámite, la fecha, la hora de inicio, la hora de finalización y la capacidad.

Reglas:

- El punto de atención y el trámite deben existir.
- La capacidad debe ser positiva.
- La hora de finalización debe ser posterior a la hora de inicio.
- Deben respetarse las restricciones de unicidad definidas en la base de datos.
- Una franja con reservas no debe modificarse de forma que invalide las reservas existentes.
- Desactivar una franja debe impedir nuevas reservas, sin borrar el historial de turnos.

## 8. Ejemplo de creación de franja

`POST /api/v1/admin/franjas/`

Encabezado:

`Authorization: Bearer <access_token>`

Cuerpo JSON:

```json
{
  "punto_id": 1,
  "tramite_id": 1,
  "fecha": "2026-12-01",
  "hora_inicio": "09:00",
  "hora_fin": "09:30",
  "capacidad": 10
}
```

Los nombres y formatos definitivos deben coincidir con los DTOs y los modelos implementados en el backend.

## 9. Seguridad y autorización

Todas las operaciones de escritura administrativa deben exigir un JWT válido y el rol `ADMIN`.

### Reglas de seguridad

1. Rechazar solicitudes sin token cuando el endpoint sea protegido.
2. Rechazar tokens inválidos o vencidos.
3. Rechazar usuarios autenticados que no tengan el rol requerido.
4. Obtener el rol desde los claims confiables del JWT validado.
5. No aceptar el rol administrativo enviado libremente en el cuerpo de una solicitud.
6. No permitir que el registro público convierta un usuario en administrador.
7. Evitar exponer información sensible en las respuestas de error.

La asignación del rol `ADMIN` debe realizarse mediante un procedimiento administrativo controlado.

## 10. Validación de datos

Los DTOs deben comprobar:

- Presencia de campos obligatorios.
- Tipos de datos correctos.
- Longitud y formato de los campos.
- Fechas y horas válidas.
- Capacidad positiva.
- Existencia de los registros relacionados.
- Coherencia de los cambios con las reglas del negocio.

Los errores de validación deben producir respuestas HTTP consistentes y mensajes comprensibles.

## 11. Persistencia y migraciones

La administración debe reutilizar los modelos y tablas de los sprints anteriores.

No se deben recrear tablas ni eliminar migraciones existentes para implementar las funcionalidades administrativas.

Si se requieren cambios de esquema:

1. Revisar los modelos.
2. Generar una migración.
3. Inspeccionar el archivo generado.
4. Aplicar la migración únicamente después de comprobar que preserva los datos existentes.

## 12. Pruebas

Ejecutar desde `backend`:

```powershell
python -m pytest -q
```

Las pruebas deben comprobar:

- Creación y actualización de puntos de atención.
- Creación y actualización de trámites.
- Validación de identificadores inexistentes.
- Rechazo de solicitudes sin JWT.
- Rechazo de usuarios sin rol `ADMIN`.
- Aceptación de solicitudes con autorización válida.
- Validación de capacidad y horarios.
- Protección de registros que tienen dependencias.
- Activación y desactivación de franjas.
- Conservación de las reservas históricas.
- Compatibilidad con los endpoints públicos del cliente.

## 13. Criterios de aceptación

El sprint podrá considerarse validado cuando:

- Las operaciones administrativas funcionen con datos persistidos.
- Los endpoints de escritura estén protegidos por rol.
- Las reglas de integridad estén verificadas.
- Los errores se gestionen de forma consistente.
- Las pruebas automatizadas pasen.
- No se produzcan modificaciones incompatibles con los sprints anteriores.

## 14. Pendientes

- Verificar los controladores y servicios administrativos existentes.
- Confirmar la protección efectiva de cada endpoint.
- Ejecutar y revisar las pruebas.
- Validar las operaciones contra la base de datos de desarrollo.
- Documentar los resultados y las limitaciones identificadas.

## 15. Resultado esperado

Al finalizar este sprint, el backend permitirá administrar de forma controlada los recursos principales del sistema y preparar la oferta de servicios que utilizarán los clientes.

El estado del sprint debe reflejar las funcionalidades realmente implementadas y verificadas.

---

**Proyecto:** FilaCero  
**Área:** Arquitectura de Software y Computacional  
**Sprint:** 04 — Administración del sistema