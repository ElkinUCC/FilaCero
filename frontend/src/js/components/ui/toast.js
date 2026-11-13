/**
 * Avisos breves (toasts): avisar("Guardado"); avisar("Falló", "error").
 * Se pintan en #toasts (index.html) y desaparecen solos.
 */
import { html } from "../../utils/dom.js";
import { icono } from "./icon.js";

export function avisar(texto, tipo = "ok") {
  const contenedor = document.getElementById("toasts");
  if (!contenedor || !texto) return;
  // Máximo tres avisos a la vez.
  while (contenedor.children.length >= 3) contenedor.firstElementChild.remove();
  const aviso = document.createElement("div");
  aviso.className = `toast toast--${tipo}`;
  aviso.innerHTML = String(html`${icono(tipo === "error" ? "alerta" : "check", 17)}<span>${texto}</span>`);
  contenedor.appendChild(aviso);
  window.setTimeout(() => aviso.remove(), tipo === "error" ? 6000 : 3500);
}
