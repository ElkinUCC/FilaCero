/**
 * Indicador de carga para botones y mensajes: spinner de Bootstrap + texto.
 *   ${s.guardando ? cargando("Guardando…") : "Guardar"}
 * El spinner es decorativo (aria-hidden); el texto es lo que lee el lector de pantalla.
 */
import { html } from "../../utils/dom.js";

export const cargando = (texto) =>
  html`<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> <span>${texto}</span>`;
