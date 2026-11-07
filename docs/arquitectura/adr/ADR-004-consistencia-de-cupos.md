# ADR-004 · Consistencia de cupos bajo concurrencia

- **Estado**: **Revisado en la entrega final** · **Atributos**: consistencia (prioridad 1), rendimiento · **Riesgos**: R-01

## Contexto
La promesa de FilaCero es que la franja reservada se cumple. Eso exige que **nunca** haya más turnos que
`asesores activos × 3` en una sede y franja, aunque muchas personas reserven a la vez. La regla se verifica
contando turnos y comparando con la capacidad: entre el conteo y la inserción otra petición puede colarse.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Restricción única en BD | Garantía absoluta | El cupo es variable (depende de asesores) y suma todos los trámites: no se expresa con un `UNIQUE` |
| Bloqueo optimista (versión + reintento) | Sin esperas | Muchos reintentos justo en los picos de reserva |
| Contador de cupos en una tabla + `UPDATE … WHERE libres > 0` | Atómico | Duplica la fuente de verdad (cupo derivado de asesores) |
| **Bloqueo pesimista por sede**: candado en memoria + `SELECT … FOR UPDATE` sobre la fila de la sede | Simple, correcto entre hilos y entre procesos | Serializa las reservas de **una** sede (aceptable: son segundos por pico) |

## Decisión original (sprint 6)
Candado en memoria por sede (hilos del mismo proceso) + `SELECT … FOR UPDATE` sobre `puntos` (entre procesos),
y dentro de la sección crítica: contar ocupación de la franja y de la sede, validar e insertar.

## Revisión (entrega final) — qué cambió y por qué
Al ejecutar la prueba de concurrencia **contra MySQL/InnoDB** (`simulacion.py --carga`) se observaron
**18 reservas aceptadas sobre 6 cupos**. Causa: el aislamiento por defecto de InnoDB es `REPEATABLE READ`; la
"foto" de la transacción se fija en la **primera lectura** (resolución de organización y validaciones), que ocurre
**antes** de obtener el bloqueo. Las lecturas de conteo posteriores, aunque ocurren con el bloqueo tomado, leen esa
foto vieja y no ven los turnos que otro hilo acaba de confirmar. La suite automatizada usa SQLite, que no tiene
este comportamiento, por lo que el defecto no se veía.

**Decisión revisada**: mantener el bloqueo pesimista y fijar el nivel de aislamiento **`READ COMMITTED`** para
conexiones MySQL (en `create_app`). Cada consulta ve lo confirmado por quien liberó el bloqueo.

## Consecuencias
- (+) Medido después del cambio: **6 aceptadas / 12 rechazadas** con 18 reservas simultáneas (antes: 18 / 0).
- (+) Sin cambios en el modelo de datos ni en la API; 138 pruebas y 50 comprobaciones de punta a punta en verde.
- (−) `READ COMMITTED` permite lecturas no repetibles dentro de una transacción: aceptable porque ninguna regla
  lee dos veces el mismo dato esperando que no cambie; las decisiones críticas se toman con el bloqueo tomado.
- (−) Las reservas de una misma sede se procesan en fila (latencia adicional de milisegundos en picos).
- Lección registrada: **las pruebas de concurrencia deben correr sobre el mismo motor de producción**.
