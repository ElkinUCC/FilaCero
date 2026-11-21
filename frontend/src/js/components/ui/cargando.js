/** Indicador de carga para botones y mensajes */
import { html } from "../../utils/dom.js";

export const cargando = (texto) =>
  html`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> <span>${texto}</span>`;
