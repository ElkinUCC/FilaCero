# ADR-002 · SPA en JavaScript puro (sin frameworks) separada de una API REST versionada

- **Estado**: **Revisado** (entrega final) · reemplaza la versión "SPA React separada de una API REST versionada"
- **Atributos**: usabilidad, modificabilidad, seguridad, costo

## Contexto
FilaCero tiene cuatro experiencias distintas (portal ciudadano, consola del asesor, panel administrativo y
pantalla de sala) con actualización en vivo y llamado por voz. La API debe poder usarse desde otros clientes
en el futuro (app móvil, kiosco).

La primera versión del frontend se construyó con React 19 + Vite. Para la entrega final el curso exige un
frontend **sin frameworks**, con la misma organización por capas del proyecto de referencia
(*frontend-alojamientos*): una sola entrada HTML (`#app`), páginas, componentes, servicios API, sesión,
router y guardas.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **SPA en HTML + CSS + JavaScript puro (módulos ES) + API JSON `/api/v1`** | Cumple el requisito del curso; cero dependencias de frontend (nada que auditar con `npm audit`); no hay compilación: nginx o cualquier servidor estático sirve los archivos tal cual; misma API para todos los clientes | Más código propio para repintar, escapar HTML y delegar eventos; sin el ecosistema de componentes de un framework |
| SPA React 19 + Vite (versión anterior) | Componentes declarativos, escape automático de HTML | Incumple el requisito del curso; agrega Node, npm y un paso de compilación |
| Plantillas en el servidor (Jinja) | Un solo proceso | Acopla presentación y negocio; la interacción en vivo y la voz son más costosas; rompe la separación SPA ↔ API |
| Vanilla + Bootstrap (como la referencia) | Estilos listos | FilaCero ya tenía un sistema de estilos propio (tokens CSS) con paleta de alto contraste; Bootstrap agregaría peso sin beneficio |

## Decisión
SPA en **HTML5 + CSS3 + JavaScript puro con módulos ES**, sin frameworks ni librerías:
- `index.html` con un único contenedor `#app`; `src/js/main.js` pinta la página de la ruta actual.
- Rutas con `#/` (`router/routes.js`, `router/guards.js`, `router/navegacion.js`): funcionan en cualquier servidor estático.
- Páginas con el patrón `XPage()` + `mountXPage()` (la segunda devuelve la función de limpieza que detiene sondeos y voz).
- Un único cliente HTTP (`src/js/api/http.js`); la configuración vive en `src/js/config.js`.
- Plantilla etiquetada `html``…``` en `utils/dom.js` que **escapa toda interpolación** (protección contra XSS).
- API REST versionada `/api/v1`; toda regla y permiso se valida en el servidor.

## Consecuencias
- (+) Cumple el requisito del curso y la estructura de la referencia.
- (+) El frontend no tiene dependencias: superficie de ataque de la cadena de suministro = 0; despliegue = copiar archivos.
- (+) Se elimina Node.js del nodo de demostración (un proceso menos y ≈ 256 MB de RAM menos).
- (+) El versionado `/v1` permitió cambiar todo el cliente sin tocar la API (prueba de que la separación funciona).
- (−) La protección contra XSS ya no la da React: depende de usar siempre `html``…``` y de no pasar datos del usuario a `crudo()`. Se mitiga con la CSP estricta de nginx (`script-src 'self'`).
- (−) El token sigue en `localStorage` (riesgo R-04; ver 07 §3 y 11).
- (−) Más código propio de infraestructura de UI (repintado, delegación de eventos, foco).
