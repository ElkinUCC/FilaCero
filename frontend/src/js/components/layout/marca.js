/** Logotipo de FilaCero (se repite en portal, panel, consola y sala). */
import { html } from "../../utils/dom.js";

export const marca = (clase = "") => html`
  <div class="marca ${clase}">
    <span class="marca__logo" aria-hidden="true">F0</span>
    <span class="marca__nombre">FilaCero</span>
  </div>`;

/** Enlace invisible para saltar la navegación con el teclado (Tab). */
export const saltarAlContenido = () => html`<a class="saltar" href="javascript:void(0)" data-saltar>Saltar al contenido</a>`;
