# ADR-002 · SPA React separada de una API REST versionada

- **Estado**: Aceptado · **Atributos**: usabilidad, modificabilidad, seguridad

## Contexto
Cuatro experiencias muy distintas (portal, consola del asesor, panel, sala de TV) con interacción en vivo,
accesibilidad y voz. La API debe poder usarse desde otros clientes en el futuro (app móvil, kiosco).

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **SPA React + API JSON `/api/v1`** | Interfaz rica, una sola API para todos los clientes, front y back evolucionan por separado | Dos contenedores; CORS y manejo de token en el cliente |
| Plantillas en el servidor (Jinja) | Un solo proceso | Interacción en vivo y accesibilidad dinámica más costosas; acopla presentación y negocio |
| SPA con librerías extra (Redux, React Router) | Patrones conocidos | Dependencias innecesarias para el tamaño del proyecto |

## Decisión
SPA React 19 + Vite **sin librerías de estado ni enrutador externos** (History API propia, hooks), con un único
cliente HTTP (`api/http.js`). API REST versionada; toda regla se valida en el servidor.

## Consecuencias
- (+) La sala, la consola y el panel comparten componentes (`PanelDetalle`, `TablaSeccion`, `Modal`).
- (+) El versionado `/v1` permite cambios aditivos (los de esta entrega) sin romper clientes.
- (−) El token vive en `localStorage` (riesgo XSS; ver [07 §3](../07-analisis-atributos.md#3-seguridad)).
