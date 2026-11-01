# ADR-0003 · Asistente de despacho: predicción de duración + EDF

- **Estado:** Aceptada
- **RAR / atributos:** RAR-01 · confiabilidad de la promesa, usabilidad del asesor

## Contexto
Aun con el cupo correcto, el orden de atención importa: llamar primero a quien reservó para más tarde, alargar atenciones o no detectar ausencias hace que la franja se venza. El asesor necesita saber **a quién llamar, cuándo pausar y cuándo cerrar**.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| FIFO por hora de solicitud (inicial) | Trivial | Quien reservó la próxima semana pasaba antes que el de hoy |
| **EDF (primero el plazo más próximo) + regresión sobre duraciones** (elegida) | Algoritmo conocido para cumplir plazos; explicable; aprende de cada sede y servicio | Recalcula en cada consulta (CPU) |
| Modelo de aprendizaje automático o LLM | Podría capturar más patrones | Requiere datos que no existen aún; difícil de explicar y de probar |

## Decisión
`agentes/despacho.py`: estima la duración por sede y servicio (regresión lineal sobre las últimas 60 atenciones, tope 10 min), ordena la cola por fin de franja (EDF), proyecta la hora de inicio repartiendo entre los asesores activos y marca cada turno: a tiempo, en riesgo, atrasado o próxima franja. Recomienda: **llamar ya**, **pausa activa** (si la última atención fue rápida y hay margen), **adelantar**, **ve cerrando** (8 min) o **no asistió** (3 min sin llegar).

## Consecuencias
- ➕ Indicador medible: % atendidos dentro de su franja (99,8 % en simulación).
- ➕ Cubierto por 10 pruebas con horas simuladas (`test_despacho.py`).
- ➖ Es una recomendación: si el asesor la ignora, la promesa puede fallar.
- **Revisar si:** la predicción se desvía de forma sistemática (comparar estimado vs. real por servicio).
