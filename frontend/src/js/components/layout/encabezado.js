/** Encabezado de sección del panel con indicador "en vivo" (sin botón de actualizar). */
import { html } from "../../utils/dom.js";

export function encabezado({ titulo, detalle = "", extra = "" }) {
  return html`
    <header class="adm__cabeza">
      <div>
        <h1>${titulo}</h1>
        ${detalle ? html`<p data-detalle>${detalle}</p>` : ""}
      </div>
      <div class="adm__cabeza-der">
        <span class="en-vivo" data-en-vivo>Conectando…</span>
        ${extra}
      </div>
    </header>`;
}

/** Actualiza el indicador "En vivo · hh:mm:ss" o "Sin conexión" de una sección. */
export function marcarEnVivo(contenedor, { actualizado, error }) {
  const el = contenedor.querySelector("[data-en-vivo]");
  if (!el) return;
  el.classList.toggle("en-vivo--error", Boolean(error));
  el.title = error || "";
  const hora = actualizado?.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  el.textContent = error ? "Sin conexión, reintentando" : actualizado ? `En vivo · ${hora}` : "Conectando…";
}
