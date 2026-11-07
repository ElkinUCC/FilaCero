# ADR-007 · Actualización en vivo por consulta periódica (polling)

- **Estado**: Aceptado · **Atributos**: simplicidad, disponibilidad, costo · **Riesgos**: R-05

## Contexto
La sala, la consola y el panel deben reflejar cambios en segundos. El despliegue es un proceso WSGI en localhost.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Polling con intervalo por vista** | Funciona con cualquier servidor WSGI, se recupera solo, fácil de probar | Tráfico y CPU aun sin cambios |
| WebSockets | Empuje inmediato | Servidor asíncrono, reconexión, estado por conexión |
| Server-Sent Events | Más simple que WebSockets | Conexión abierta por cliente en un servidor de hilos |

## Decisión
`usePolling` con intervalos según urgencia: sala 4 s, consola 5 s, asesores 10 s, resumen 15 s, historial,
usuarios y portal 20 s, catálogo 30 s. Indicador "En vivo / Sin conexión, reintentando".

## Consecuencias
- (+) Con la carga del caso (≈ 6 req/s) se usa ≈ 5 % de la capacidad medida.
- (−) La consola transfiere ≈ 46 KB cada 5 s; con cientos de asesores se migraría a SSE o a respuestas
  condicionales (`ETag`) — escenario E-2.
