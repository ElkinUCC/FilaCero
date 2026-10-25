
# Hoja de ruta técnica — FilaCero

## Estado base confirmado

- Sprint 06: ciclo de atención de turnos.
- Sprint 07: administración, métricas e historial.
- Última ejecución compartida: 30 pruebas aprobadas.
- Rutas de Flask: registradas.
- Migración reportada: `a91c6d8e42f0`.
- Advertencias conocidas: uso de `datetime.utcnow()` en dependencias o valores por defecto.

## Prioridad 1 — Cierre de Sprint 08

- [ ] Guardar la colección Postman.
- [ ] Importar colección y entorno.
- [ ] Confirmar los cuerpos JSON de cada controlador.
- [ ] Ejecutar los flujos principales.
- [ ] Adjuntar evidencias de resultados.

## Prioridad 2 — Calidad del backend

- [ ] Revisar avisos de fechas y horas.
- [ ] Comprobar permisos para todas las rutas protegidas.
- [ ] Revisar transiciones inválidas de estado.
- [ ] Probar solicitudes concurrentes de llamada de turnos.
- [ ] Comprobar validación y consistencia de errores.

## Prioridad 3 — Integración del frontend

- [ ] Verificar la URL base de la API.
- [ ] Implementar o comprobar el almacenamiento seguro del token según la plataforma.
- [ ] Conectar el flujo del cliente.
- [ ] Conectar la consola administrativa.
- [ ] Conectar la consola del agente.
- [ ] Comprobar estados de carga, errores y respuestas vacías.

## Prioridad 4 — Entrega académica

- [ ] Revisar README principal.
- [ ] Completar diagramas C4 de contexto y contenedores.
- [ ] Registrar decisiones arquitectónicas.
- [ ] Relacionar requisitos, implementación y evidencias.
- [ ] Preparar instrucciones reproducibles de ejecución.
- [ ] Confirmar qué se ejecutó realmente antes de entregar.

## Regla de seguimiento

Marcar un punto como terminado solo cuando exista evidencia verificable. No asumir que el frontend está conectado o que todos los endpoints pasan pruebas de Postman por el hecho de que Flask los registre.

## Mejora de calidad — Manejo de fechas y horas

- **Problema:** SQLAlchemy reportaba advertencias por el uso de
  `datetime.utcnow()`, una función obsoleta.
- **Acción:** sustituir los usos identificados por generación explícita
  de fechas y horas UTC, manteniendo compatibilidad con las columnas
  `DateTime` existentes.
- **Base de datos:** no se espera un cambio de esquema.
- **Validación:** ejecutar la suite de pruebas y `flask db check`.
- **Estado:** pendiente de confirmar tras la ejecución posterior al cambio.