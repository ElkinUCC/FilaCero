/** Avisos breves (toasts): avisar("Guardado"); avisar("Falló", "error"). */
import { html } from "../../utils/dom.js";
import { icono } from "./icon.js";

export function avisar(texto, tipo = "ok") {
  const contenedor = document.getElementById("toasts");
  if (!contenedor || !texto) return;
  // Máximo tres avisos a la vez.
  while (contenedor.children.length >= 3) contenedor.firstElementChild.remove();
  const aviso = document.createElement("div");
  // .toast y .show son clases de Bootstrap; toast--ok/--error dan el color de FilaCero.
  aviso.className = `toast show toast--${tipo}`;
  aviso.innerHTML = String(html`${icono(tipo === "error" ? "alerta" : "check", 17)}<span>${texto}</span>`);
  contenedor.appendChild(aviso);
  window.setTimeout(() => aviso.remove(), tipo === "error" ? 6000 : 3500);
}
