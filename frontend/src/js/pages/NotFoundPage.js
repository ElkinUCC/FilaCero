/** 404: la dirección no existe. embebida: dentro del panel. */
import { marca } from "../components/layout/marca.js";
import { icono } from "../components/ui/icon.js";
import { html } from "../utils/dom.js";

export function NotFoundPage({ embebida = false } = {}) {
  const contenido = html`
    <section class="aviso-pagina" aria-labelledby="titulo-404">
      <span class="aviso-pagina__icono">${icono("buscar", 30)}</span>
      <p class="aviso-pagina__codigo">Error 404</p>
      <h1 id="titulo-404">No encontramos esta página</h1>
      <p>Puede que la dirección esté mal escrita o que la sección ya no exista.</p>
      <div class="aviso-pagina__acciones">
        <a class="btn btn--primario" href="${embebida ? "#/admin" : "#/"}">${embebida ? "Volver al resumen" : "Ir a reservar un turno"}</a>
      </div>
    </section>`;
  if (embebida) return contenido;
  return html`<div class="pagina-centrada">${marca()}<main id="contenido" tabindex="-1">${contenido}</main></div>`;
}
