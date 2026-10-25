
# Seguridad — FilaCero

## Autenticación

Las rutas protegidas deben exigir un JWT válido. Los tokens no deben compartirse ni registrarse en logs públicos.

## Autorización

- CLIENTE: operaciones propias de consulta, solicitud y cancelación de turnos según las reglas implementadas.
- AGENTE: operaciones de cola y atención de turnos autorizados para su sede.
- ADMIN: operaciones administrativas autorizadas.

La autorización debe verificarse en el servidor, no únicamente en la interfaz.

## Protección de datos

- No almacenar contraseñas en texto plano.
- No incluir secretos en el repositorio.
- No devolver hashes de contraseña en las respuestas.
- Limitar la información personal devuelta por los endpoints.
- Utilizar datos ficticios para las pruebas compartidas.

## Validación de entrada

Validar:
- Tipos de datos.
- Identificadores.
- Fechas.
- Estados de turnos.
- Paginación.
- Existencia y estado de las entidades relacionadas.

## Integridad del flujo de atención

- Solo llamar turnos que cumplan las reglas de espera.
- No iniciar una atención que no haya sido llamada.
- No finalizar una atención que no se haya iniciado.
- Verificar la sede asignada al agente.
- Evitar que solicitudes concurrentes asignen el mismo turno a varios agentes.

## CORS y despliegue

Configurar CORS para los orígenes autorizados en producción. No utilizar configuraciones abiertas de desarrollo como sustituto de una política de producción.

## Verificaciones pendientes

- [ ] Pruebas negativas para cada rol.
- [ ] Revisión de expiración y validación de JWT.
- [ ] Revisión de concurrencia en la llamada de turnos.
- [ ] Verificación de exposición de datos personales.
- [ ] Revisión de configuración antes del despliegue.
