# ADR-001 · Monolito modular por capas

- **Estado**: Aceptado · **Atributos**: mantenibilidad, rendimiento, costo · **Riesgos**: R-05, R-07

## Contexto
Equipo de una persona, plazo académico, despliegue en localhost y un dominio acotado (turnos). El curso exige
una arquitectura profesional y modular, y el docente pidió explícitamente "monolítico modular por capas".

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Monolito modular por capas** | Un despliegue, transacciones locales (clave para cupos), depuración simple, límites claros por módulo | Escala como una unidad; disciplina manual para no cruzar capas |
| Monolito en capas sin módulos | Más simple al inicio | Crece como "bola de barro": todo el negocio en un `servicios.py` |
| Microservicios (reservas, atención, identidad) | Escala y despliegue independientes | Transacción distribuida para el cupo, red entre servicios, observabilidad y costo injustificados para 4 sedes |

## Decisión
Un proceso Flask con **módulos de dominio** (`usuarios`, `sedes`, `tramites`, `franjas`, `turnos`, `agentes`,
`auditoria`, `organizaciones`), cada uno con capas controlador → servicio → repositorio → modelo y DTO.

## Consecuencias
- (+) La reserva es una transacción ACID local: base de ADR-004.
- (+) La entrega final agregó preparación, módulo y bajas tocando solo los módulos afectados (ver [10](../10-evolucion.md)).
- (−) Todo escala junto; el techo medido es ≈ 120 req/s por proceso (suficiente con 20× de margen).
- (−) Las reglas de capas no las impone el lenguaje: se detectó deuda en métricas (R-07).
- Si un módulo necesitara escalar aparte (p. ej. la sala con miles de TV), es el primer candidato a extraerse (E-2).
