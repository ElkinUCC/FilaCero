
# Postman — FilaCero

## Archivos

- `FilaCero.postman_collection.json`: colección de endpoints.
- `FilaCero-Local.postman_environment.json`: variables del entorno local.

## Preparación

1. Activar el entorno virtual del backend.
2. Iniciar Flask usando el comando configurado para el proyecto.
3. Importar la colección en Postman.
4. Importar y seleccionar el entorno `FilaCero - Local`.
5. Confirmar que `base_url` corresponda al puerto real de Flask.
6. Iniciar sesión con cuentas de prueba de los roles correspondientes.
7. Copiar los JWT a `token_admin`, `token_agente` o `token_cliente`.

## Orden sugerido de ejecución

1. Health check.
2. Registro e inicio de sesión.
3. Listado de sedes y trámites.
4. Listado de franjas.
5. Solicitud de turno.
6. Consulta de mis turnos.
7. Asignación de sede a un agente.
8. Consulta de cola.
9. Llamar, iniciar y finalizar un turno.
10. Consultar métricas e historial.

## Reglas de seguridad

- No guardar contraseñas reales en la colección.
- No publicar tokens JWT.
- No exportar secretos reales en el entorno compartido.
- Utilizar cuentas y datos de prueba.

## Advertencia sobre los ejemplos

Los cuerpos JSON de registro, sedes, trámites, franjas y turnos son ejemplos iniciales. Antes de considerarlos definitivos, contrastarlos con los controladores y modelos existentes.

## Evidencias

Registrar para cada flujo:
- Endpoint y método.
- Código HTTP.
- Resultado esperado.
- Resultado observado.
- Captura o evidencia reproducible.
