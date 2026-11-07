# ADR-014 · Presencia del asesor (lo que está haciendo ahora)

- **Estado**: Nuevo (entrega final, iteración 2) · **Atributos**: usabilidad del panel, trazabilidad

## Contexto
El docente pidió que el **estado** de cada asesor en el panel sea lo que está haciendo en ese momento:
atendiendo, en pausa, en almuerzo o inactivo. Antes solo se derivaba del turno en curso ("Disponible" si no tenía).

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Inferir por inactividad (sin peticiones en N minutos) | Automático | Falsos positivos (la consola consulta cada 5 s aunque nadie esté) |
| **Estado declarado por el asesor + derivado del turno** | Explícito, auditable, simple | Depende de que el asesor lo marque |
| Integración con control de asistencia | Exacto | Fuera del alcance |

## Decisión
`usuarios.presencia` (`DISPONIBLE`, `PAUSA`, `ALMUERZO`, `AUSENTE`) y `presencia_desde`. El estado que muestra el
panel combina: turno en curso (**Atendiendo**/**Llamando**) > presencia declarada > disponible. Reglas automáticas:
al iniciar sesión queda Disponible, al cerrar sesión Fuera de turno, al llamar a alguien vuelve a Disponible y la
pausa activa sugerida por el asistente marca En pausa. No se puede salir a pausa con un turno en curso.
Cada cambio queda en la bitácora.

## Consecuencias
- (+) El panel y "Sedes ahora" muestran la realidad de la sede (quién está en almuerzo, quién atiende).
- (−) La capacidad de la sede no se reduce durante el almuerzo: se decidió así para no cancelar reservas ya confirmadas; queda como evolución (bloquear cupos futuros por presencia).
