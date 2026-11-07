# ADR-010 · Preparación previa como subestado del turno

- **Estado**: **Revisado** (iteración 3) · **Atributos**: cumplimiento de la promesa, usabilidad, modificabilidad

## Contexto
Objetivo planteado por el estudiante: que cuando el ciudadano llegue **todo esté hecho** (televisor listo para
recoger, garantía revisada, factura generada) y solo recoja o firme. El sistema ya capturaba la necesidad con
preguntas por trámite; faltaba el ciclo de trabajo previo y su visibilidad para el ciudadano.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Subestado en `turnos`** (`estado_preparacion`, nota, fecha, responsable) | Una migración aditiva; la preparación viaja con el turno a consola, historial y consulta pública | Un pedido = un turno (no modela pedidos sin cita) |
| Nuevo módulo "Órdenes" con tabla propia | Modela inventario y pedidos independientes | Más tablas, endpoints y pantallas; fuera del alcance del semestre |
| Integración con un ERP externo | Datos reales de inventario | No existe en el caso; acoplamiento externo |

## Decisión
- `tramites.requiere_preparacion` marca qué trámites se alistan; el turno nace `PENDIENTE`.
- El asesor de **la misma sede** cambia el estado (`EN_PREPARACION`, `LISTO`, `NOVEDAD` con mensaje obligatorio, o `PENDIENTE`).
- El ciudadano ve el estado y el mensaje al consultar su turno; el historial muestra quién y cuándo.
- El asistente de despacho sugiere **"Alista el pedido de X"** cuando hay tiempo libre antes de la siguiente
  franja, y advierte al llamar a alguien cuyo pedido no está listo.

## Consecuencias
- (+) La promesa pasa de "no hagas fila" a "llega a tu hora y sal con lo que viniste a buscar".
- (+) Cambio aislado en `turnos` (nuevo `preparacion.py`) y `agentes`; ningún contrato existente roto.
- (−) No se modela inventario; si un repuesto no llega, el asesor lo comunica con `NOVEDAD`.
- Evolución natural: notificar al ciudadano por SMS/WhatsApp al pasar a `LISTO` o `NOVEDAD` (escenario E-3).

## Revisión (iteración 3): la preparación la decide el tipo de atención
En la simulación el mensaje "Lo dejamos listo antes de que llegues" aparecía en servicios donde no había nada
que alistar (p. ej. cotización o diagnóstico), lo que confundía al ciudadano.

- `tramites.requiere_preparacion` deja de ser una casilla libre y se **deriva** de `tipo_flujo`:
  solo `ENTREGA` (equipo reparado) y `GARANTIA` se alistan. La migración `c1e3a5b7d9f0` lo recalcula y limpia
  la preparación de los turnos activos de otros servicios.
- Los textos se adaptan al flujo: *Equipo por alistar / Alistando el equipo / Equipo listo para entregar* y
  *Garantía por revisar / Revisando la garantía / Garantía revisada*. En un reclamo se muestra el radicado, no
  una preparación.
- El panel de Trámites muestra la regla como información (no editable), para que no vuelva a quedar inconsistente.
