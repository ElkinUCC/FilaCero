/**
 * Utilidades de interfaz sin componentes: voz (Web Speech API), avisos para
 * lectores de pantalla y teclado en pestañas.
 *
 * El menú de "Accesibilidad" (texto grande, alto contraste, leer avisos) se
 * retiró en la entrega final: la paleta de alto contraste quedó como la
 * principal del portal y la voz se usa en el llamado del asesor.
 */
import { guardarLocal } from "../utils/storage";

// Limpia preferencias guardadas por versiones anteriores del menú.
guardarLocal("filacero_accesibilidad", null);
if (typeof document !== "undefined") {
  delete document.documentElement.dataset.texto;
  delete document.documentElement.dataset.contraste;
}

/* ------------------------------------------------------------------
   Avisos: región "en vivo" para lectores de pantalla (sin voz)
   ------------------------------------------------------------------ */

let region = null;
function regionViva() {
  if (!region) {
    region = document.createElement("div");
    region.className = "sr";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  return region;
}

/** Habla en español con la voz del navegador. Devuelve false si no hay voz. */
export function hablar(texto) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = "es-CO";
  frase.rate = 0.95;
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("es"));
  if (voz) frase.voice = voz;
  window.speechSynthesis.speak(frase);
  return true;
}

export function anunciar(texto) {
  const r = regionViva();
  r.textContent = "";
  window.setTimeout(() => { r.textContent = texto; }, 50);
}

/** Flechas izquierda/derecha para moverse entre pestañas (patrón ARIA). */
export function teclasPestanas(e) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const pestanas = [...e.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')];
  const i = pestanas.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const destino = e.key === "Home" ? 0
    : e.key === "End" ? pestanas.length - 1
      : (i + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length;
  pestanas[destino].focus();
  pestanas[destino].click();
}
