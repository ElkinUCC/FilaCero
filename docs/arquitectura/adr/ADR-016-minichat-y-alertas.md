# ADR-016 · Minichat de reclamos y consultas, con asistente automático y alertas al asesor

- **Estado**: Aceptado · **Atributos**: usabilidad, cumplimiento de la promesa, modificabilidad

## Contexto
El asesor respondía un reclamo una sola vez (p. ej. "la revisión vale $50.000") y el ciudadano no podía
preguntar nada más sin desplazarse. Muchos diagnósticos previos se resuelven conversando. Además, el asesor
necesitaba avisos visibles cuando la franja está por terminar o la siguiente persona va tarde.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Mensajes en tabla propia + polling (ADR-007)** | Una migración aditiva; reutiliza OTP, roles y sede | Latencia de hasta 12–15 s |
| WebSockets / servidor de chat | Tiempo real | Proceso asíncrono adicional; contradice ADR-007 y ADR-012 |
| Integrar WhatsApp | Canal conocido | Costo, cuenta empresarial, fuera de alcance |
| Asistente con modelo de lenguaje externo | Respuestas más libres | Costo, datos personales a un tercero, respuestas no verificables (precios) |

## Decisión
- `mensajes_reclamo` (autor CLIENTE, ASESOR o ASISTENTE; leído por cada lado). Migración `d2f4b6c8e0a1`.
- Nueva categoría **"Consulta o diagnóstico previo"**: el ciudadano pregunta antes de ir.
- El **asistente automático** (`reclamos/asistente.py`) contesta al instante con **reglas explicables** y datos
  reales (horario, estado del equipo, requisitos de cédula y garantía). **No inventa precios ni diagnósticos**:
  remite al asesor. Mismo enfoque de reglas que el asistente de despacho y el asistente de métricas del tablero.
- El asesor ve contadores de mensajes sin leer y **alertas emergentes**: fin de franja (≤ 5 min con personas
  pendientes), siguiente persona en riesgo o atrasada según la proyección de la cola, y mensaje nuevo de un cliente.
- Consulta **por código** sin pedir celular: el código de verificación llega al celular registrado en el turno.

## Consecuencias
- (+) Menos viajes innecesarios; el ciudadano llega "a la fija".
- (+) Sin infraestructura nueva; el chat hereda el aislamiento multiempresa y la verificación OTP.
- (−) No es tiempo real estricto (polling). Evolución: SSE si el volumen crece (escenario E-2).
- (−) Las reglas del asistente se mantienen a mano; evolución: base de preguntas frecuentes editable en el panel.
