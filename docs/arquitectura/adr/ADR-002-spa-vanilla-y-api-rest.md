# ADR-002 · SPA en JavaScript puro (sin frameworks) separada de una API REST versionada

- **Estado**: Revisado · reemplaza la versión inicial basada en un framework de componentes · complementado por [ADR-017](ADR-017-bootstrap-y-capas-estrictas.md) (Bootstrap 5.3 como base de estilos)
- **Atributos**: usabilidad, modificabilidad, seguridad, costo

## Contexto
FilaCero tiene cuatro experiencias distintas (portal ciudadano, consola del asesor, panel administrativo y
pantalla de sala) con actualización en vivo y llamado por voz. La API debe poder usarse desde otros clientes
en el futuro (app móvil, kiosco).

La primera versión del frontend usaba un framework de componentes con un paso de compilación. Para la entrega
final el curso exige un frontend **sin frameworks**, con la misma organización por capas del proyecto de referencia
(*frontend-alojamientos*): una sola entrada HTML (`#app`), páginas, componentes, servicios API, sesión,
router y guardas.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **SPA en HTML + CSS + JavaScript puro (módulos ES) + API JSON `/api/v1`** | Cumple el requisito del curso; cero dependencias de frontend (no hay paquetes de terceros que auditar); no hay compilación: cualquier servidor estático (`python -m http.server`) sirve los archivos tal cual; misma API para todos los clientes | Más código propio para repintar, escapar HTML y delegar eventos; sin el ecosistema de componentes de un framework |
| SPA con un framework de componentes (versión inicial) | Componentes declarativos, escape automático de HTML | Incumple el requisito del curso; agrega Node.js, un gestor de paquetes y un paso de compilación |
| Plantillas en el servidor (Jinja) | Un solo proceso | Acopla presentación y negocio; la interacción en vivo y la voz son más costosas; rompe la separación SPA ↔ API |
| Vanilla + Bootstrap (como la referencia) | Estilos listos; lo exige el enunciado final | En la primera revisión se descartó por tener ya un sistema propio; **se adoptó en la entrega final** como base, conservando los tokens de FilaCero (ADR-017) |

## Decisión
SPA en **HTML5 + CSS3 + JavaScript puro con módulos ES**, sin frameworks de interfaz (React, Angular, Vue) y con **Bootstrap 5.3** (solo CSS, copia local) como base de estilos (ADR-017):
- `index.html` con un único contenedor `#app`; `src/js/main.js` pinta la página de la ruta actual.
- Rutas con `#/` (`router/routes.js`, `router/guards.js`, `router/navegacion.js`): funcionan en cualquier servidor estático.
- Páginas con el patrón `XPage()` + `mountXPage()` (la segunda devuelve la función de limpieza que detiene sondeos y voz).
- Un único cliente HTTP (`src/js/api/http.js`); la configuración vive en `src/js/config.js`.
- Plantilla etiquetada `html``…``` en `utils/dom.js` que **escapa toda interpolación** (protección contra XSS).
- API REST versionada `/api/v1`; toda regla y permiso se valida en el servidor.

## Consecuencias
- (+) Cumple el requisito del curso y la estructura de la referencia.
- (+) La sala, la consola y el panel comparten componentes (`admin/tablaSeccion.js`, `ui/modal.js`, `ui/chat.js`) y utilidades (`utils/polling.js`, `utils/voz.js`).
- (+) La única dependencia de terceros del frontend es el CSS de Bootstrap (copia local fijada en 5.3.9, sin JavaScript de terceros); para ejecutarlo basta servir la carpeta.
- (+) Se elimina Node.js del nodo de demostración (un proceso menos y ≈ 256 MB de RAM menos).
- (+) El versionado `/v1` permitió reemplazar todo el cliente sin tocar la API.
- (−) La protección contra XSS no es automática: depende de usar siempre `html``…``` y de no pasar datos del usuario a `crudo()`. Se mitiga con la CSP de `index.html` (`script-src 'self'`).
- (−) El token sigue en `localStorage` (riesgos R-04 y R-12; ver [07 §3](../07-analisis-atributos.md#3-seguridad) y [11](../11-seguridad.md)).
- (−) Más código propio de infraestructura de UI (repintado, delegación de eventos, foco).
