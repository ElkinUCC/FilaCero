/** 403: hay sesión pero el rol no alcanza. */
import { homeFor } from "../auth/permissions.js";
import { marca } from "../components/layout/marca.js";
import { icono } from "../components/ui/icon.js";
import { html } from "../utils/dom.js";

export function ForbiddenPage({ usuario, embebida = false } = {}) {
  const contenido = html`
    <section class="aviso-pagina" aria-labelledby="titulo-403">
      <span class="aviso-pagina__icono aviso-pagina__icono--alerta">${icono("escudo", 30)}</span>
      <p class="aviso-pagina__codigo">Error 403</p>
      <h1 id="titulo-403">No tienes permiso para ver esta sección</h1>
      <p>Tu cuenta no tiene el rol necesario. Si crees que es un error, pide a un administrador que revise tus permisos.</p>
      <div class="aviso-pagina__acciones">
        <a class="btn btn--primario" href="#${homeFor(usuario)}">Ir a mi inicio</a>
        ${embebida ? "" : html`<button type="button" class="btn btn--borde" data-salir>Cerrar sesión</button>`}
      </div>
    </section>`;
  if (embebida) return contenido;
  return html`<div class="pagina-centrada">${marca()}<main id="contenido" tabindex="-1">${contenido}</main></div>`;
}

export function mountForbiddenPage({ onSalir }) {
  const boton = document.querySelector("[data-salir]");
  boton?.addEventListener("click", onSalir);
}
