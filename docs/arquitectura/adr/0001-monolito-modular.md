# ADR-0001 · Monolito modular por dominios

- **Estado:** Aceptada
- **RAR / atributos:** RAR-08 · mantenibilidad, costo, consistencia

## Contexto
Equipo pequeño, un semestre y un único servidor. Las reglas centrales (cupo, reserva, despacho) necesitan consistencia transaccional entre turnos, franjas y asesores.

## Alternativas
| Alternativa | A favor | En contra para este caso |
|---|---|---|
| **Monolito modular** (elegida) | Un desplegable; transacciones locales; límites por dominio claros | Un fallo afecta a todo el sistema; escala como unidad |
| Microservicios (reservas, despacho, usuarios) | Escalado y despliegue independientes | Exige transacciones distribuidas para el cupo, más infraestructura y operación; desproporcionado para ~5 pet./s |
| Monolito en capas sin dominios | Más simple al inicio | Las reglas se mezclan; cambiar la regla de cupo toca muchos archivos |

## Decisión
Una sola API Flask organizada en dominios (`usuarios`, `sedes`, `tramites`, `franjas`, `turnos`, `agentes`, `auditoria`) con capas controlador → servicio → repositorio.

## Consecuencias
- ➕ La reserva verifica cupo e inserta en una sola transacción (RAR-02).
- ➕ Cada dominio puede extraerse a futuro porque sus límites son explícitos.
- ➖ Todo se despliega junto; un error en un dominio puede tumbar la API.
- **Revisar si:** un dominio necesita escalar o desplegarse con un ritmo muy distinto (p. ej., la pantalla de sala con cientos de TV).
