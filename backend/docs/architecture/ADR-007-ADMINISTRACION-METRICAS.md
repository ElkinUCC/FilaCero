
# ADR-007 — Administración y métricas dentro del backend modular

- **Estado:** Aceptada como decisión de implementación actual.
- **Contexto:** FilaCero necesita operaciones administrativas, consultas de métricas e historial de turnos.
- **Decisión:** Mantener estas operaciones dentro de los dominios existentes del backend Flask, reutilizando modelos, servicios y autenticación JWT.
- **Alternativas consideradas:**
  1. Mantener las funcionalidades en el monolito modular.
  2. Separar administración y métricas en un servicio independiente.
- **Justificación:** La solución actual mantiene las funcionalidades dentro de la arquitectura modular existente y evita introducir infraestructura adicional sin una necesidad demostrada.
- **Consecuencias positivas:**
  - Reutilización de modelos y lógica de negocio.
  - Menor complejidad de despliegue.
  - Rutas agrupadas por responsabilidad.
  - Pruebas integradas en la suite existente.
- **Riesgos y límites:**
  - Los controladores pueden acumular demasiadas responsabilidades si crecen sin una separación clara.
  - Las consultas agregadas deben evaluarse con datos de mayor volumen.
  - Los permisos deben comprobarse en todas las rutas protegidas.
- **Evidencia:** rutas Flask registradas y ejecución compartida de 30 pruebas aprobadas.
- **Pendiente:** medir rendimiento con un volumen representativo de turnos y revisar el diseño de consultas.
