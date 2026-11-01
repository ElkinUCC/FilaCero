# ADR-0002 · Cupo por sede y franja con atención máxima de 10 minutos

- **Estado:** Aceptada (reemplaza la decisión inicial "cupo por trámite")
- **RAR / atributos:** RAR-01, RAR-03 · confiabilidad de la promesa

## Contexto
La promesa es atender dentro de la franja reservada. En la versión inicial el cupo se calculaba **por trámite**: una sede con 4 servicios y 1 asesor podía recibir 4 × 3 = 12 personas en la misma media hora, imposibles de atender. La revisión del modelo detectó la contradicción.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Cupo por trámite (inicial) | Simple de calcular | Rompe la promesa cuando hay varios servicios |
| **Cupo por sede = ⌊30/10⌋ × asesores activos** (elegida) | Refleja la capacidad real de atención; se ajusta solo al agregar asesores | Se rechazan reservas aunque haya "espacio" en un servicio |
| Fila FIFO sin franjas | Máximo aprovechamiento | No hay hora prometida: contradice el objetivo del producto |

## Decisión
La capacidad de una franja es **compartida por todos los servicios de la sede**: `cupos_por_asesor (30/10 = 3) × asesores activos`. Configurable con `DURACION_MAX_ATENCION_MIN` y `CUPOS_POR_ASESOR_FRANJA`. Implementado en un solo lugar: `app/horario.py`.

## Consecuencias
- ➕ La promesa es alcanzable por construcción: nunca se agenda más trabajo del que caben en 30 min.
- ➕ Agregar un asesor aumenta la capacidad sin otro cambio.
- ➖ Si un asesor falta sin ser desactivado, la sede queda sobre-agendada (riesgo R2).
- **Revisar si:** los datos reales muestran atenciones típicamente > 10 min o franjas distintas a 30 min.
