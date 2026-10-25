
# Plan de pruebas de API — FilaCero

## Objetivo

Comprobar que los endpoints responden correctamente, respetan los roles y preservan las reglas de negocio del sistema de turnos.

## Pruebas de salud
- [ ] `GET /`
- [ ] `GET /health`

## Autenticación
- [ ] Inicio de sesión con credenciales válidas.
- [ ] Inicio de sesión con contraseña incorrecta.
- [ ] Acceso a una ruta protegida sin JWT.
- [ ] Acceso con JWT inválido o expirado.

## Autorización
- [ ] Un cliente no puede usar endpoints exclusivos de agente.
- [ ] Un agente no puede usar endpoints exclusivos de administrador.
- [ ] Un administrador puede consultar los endpoints administrativos.
- [ ] Las operaciones de un agente se limitan a la sede asignada.

## Ciclo de atención
- [ ] Solicitar un turno con datos válidos.
- [ ] Consultar los turnos propios.
- [ ] Cancelar un turno permitido.
- [ ] Consultar la cola de espera.
- [ ] Llamar un turno en espera.
- [ ] Iniciar un turno llamado.
- [ ] Finalizar una atención iniciada.
- [ ] Rechazar transiciones de estado inválidas.
- [ ] Comprobar que no se atienda un turno de otra sede.

## Administración
- [ ] Listar agentes.
- [ ] Asignar sede a un agente activo.
- [ ] Rechazar una sede inexistente o inactiva.
- [ ] Desasignar una sede.
- [ ] Consultar métricas generales.
- [ ] Consultar métricas por sede.
- [ ] Consultar métricas por trámite.
- [ ] Consultar historial paginado.
- [ ] Rechazar fechas mal formadas.
- [ ] Rechazar una fecha inicial posterior a la final.
- [ ] Rechazar páginas o tamaños de página inválidos.

## Evidencia por prueba

Registrar:
- Identificador de prueba.
- Método y endpoint.
- Datos de entrada.
- Resultado esperado.
- Resultado observado.
- Código HTTP.
- Estado: APROBADA, FALLIDA o PENDIENTE.
- Referencia de captura o log.

## Criterio de cierre

No marcar una prueba como aprobada hasta ejecutar la solicitud y verificar su resultado. Separar las pruebas automatizadas de las ejecutadas manualmente en Postman.
