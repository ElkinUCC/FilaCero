# ADR-0004 · Control de concurrencia en reservas: candado por sede + bloqueo de fila

- **Estado:** Aceptada (actualizada tras la prueba de carga)
- **RAR / atributos:** RAR-02 · integridad

## Contexto
La prueba de carga (`simulacion.py --carga`) envió 18 reservas simultáneas a una franja con 6 cupos y se aceptaron **7**: dos peticiones leyeron "queda 1 cupo" al mismo tiempo. El cupo es por **sede** (ADR-0002), así que bloquear solo la franja no basta: compiten franjas de distintos servicios a la misma hora.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Solo `SELECT … FOR UPDATE` sobre la franja | Estándar en MySQL | No cubre otras franjas de la misma sede/hora; no aplica en SQLite (pruebas) |
| Control optimista (versión + reintento) | Sin esperas | Reintentos bajo picos; más complejo de explicar y probar |
| Cola asíncrona de reservas | Serializa todo | El ciudadano no recibe el código de inmediato; más infraestructura |
| **Candado por sede en el proceso + `SELECT … FOR UPDATE` sobre la sede** (elegida) | Correcto entre hilos (waitress) y entre procesos (MySQL); simple | Las reservas de una misma sede se serializan |

## Decisión
`turnos/servicios.py::crear_turno` toma un candado por sede (hilos del mismo proceso) y, dentro de la transacción, bloquea la fila de la sede (`FOR UPDATE`) antes de recontar la ocupación e insertar.

## Consecuencias
- ➕ Verificado: 18 simultáneas → **6 aceptadas, 12 rechazadas**; prueba automática `test_reservas_concurrentes.py`.
- ➖ Con varias instancias de la API, el candado en memoria no se comparte: la garantía depende del `FOR UPDATE` de MySQL (riesgo R3).
- **Revisar si:** se despliega más de una instancia o se cambia de motor de base de datos.
