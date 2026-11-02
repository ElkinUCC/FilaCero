/**
 * Accesibilidad sin componentes: preferencias guardadas, anuncios al lector de
 * pantalla, voz (Web Speech API) y teclado en pestañas. Los componentes visuales
 * están en components/ui/Accesibilidad.jsx.
 */
import { useSyncExternalStore } from "react";
import { guardarLocal, leerLocal } from "../utils/storage";

/* ------------------------------------------------------------------
   Preferencias de accesibilidad (se recuerdan en este navegador)
   - texto: agranda toda la interfaz
   - contraste: colores de alto contraste
   - voz: lee en voz alta los avisos importantes
   ------------------------------------------------------------------ */

const CLAVE = "filacero_accesibilidad";
const PREDETERMINADAS = { texto: false, contraste: false, voz: false };
const oyentes = new Set();

function leer() {
  try {
    return { ...PREDETERMINADAS, ...JSON.parse(leerLocal(CLAVE) || "{}") };
  } catch {
    return { ...PREDETERMINADAS };
  }
}

let actuales = leer();

function aplicar(p) {
  const raiz = document.documentElement;
  raiz.dataset.texto = p.texto ? "grande" : "normal";
  raiz.dataset.contraste = p.contraste ? "alto" : "normal";
}
aplicar(actuales); // antes del primer render, sin saltos visuales

export function cambiarPreferencia(clave, valor) {
  actuales = { ...actuales, [clave]: valor };
  guardarLocal(CLAVE, JSON.stringify(actuales));
  aplicar(actuales);
  oyentes.forEach((f) => f());
}

export function usePreferencias() {
  return useSyncExternalStore(
    (f) => { oyentes.add(f); return () => oyentes.delete(f); },
    () => actuales,
  );
}

/* ------------------------------------------------------------------
   Anuncios: siempre al lector de pantalla; en voz alta si está activo
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

export function hablar(texto, { forzar = false } = {}) {
  if (!(forzar || actuales.voz) || !("speechSynthesis" in window)) return false;
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
  hablar(texto);
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
