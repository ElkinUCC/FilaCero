import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { guardarLocal, leerLocal } from "../util";
import Icon from "./Icon";

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

/* ------------------------------------------------------------------
   Menú de accesibilidad
   ------------------------------------------------------------------ */

const OPCIONES = [
  { clave: "texto", titulo: "Texto grande", detalle: "Agranda toda la pantalla un 15%" },
  { clave: "contraste", titulo: "Alto contraste", detalle: "Colores más marcados y bordes visibles" },
  { clave: "voz", titulo: "Leer avisos en voz alta", detalle: "Turnos llamados y cambios importantes" },
];

export function MenuAccesibilidad({ className = "", arriba = false }) {
  const prefs = usePreferencias();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => raiz.current && !raiz.current.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const activas = OPCIONES.filter((o) => prefs[o.clave]).length;

  return (
    <div className={`acc ${arriba ? "acc--arriba" : ""} ${className}`} ref={raiz}>
      <button
        type="button"
        className="acc__boton"
        aria-expanded={abierto}
        aria-controls="menu-accesibilidad"
        onClick={() => setAbierto((a) => !a)}
        title="Opciones de accesibilidad"
      >
        <Icon name="accesibilidad" size={18} />
        <span className="acc__texto">Accesibilidad</span>
        {activas > 0 && <span className="acc__cuenta" aria-label={`${activas} activas`}>{activas}</span>}
      </button>
      {abierto && (
        <div className="acc__panel" id="menu-accesibilidad" role="group" aria-label="Opciones de accesibilidad">
          {OPCIONES.map((o) => (
            <label key={o.clave} className="acc__opcion">
              <span>
                <strong>{o.titulo}</strong>
                <small>{o.detalle}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs[o.clave]}
                onChange={(e) => {
                  cambiarPreferencia(o.clave, e.target.checked);
                  if (o.clave === "voz" && e.target.checked) hablar("Avisos por voz activados.", { forzar: true });
                }}
              />
            </label>
          ))}
          {!("speechSynthesis" in window) && <p className="acc__nota">Este navegador no permite lectura en voz alta.</p>}
        </div>
      )}
    </div>
  );
}

/** Enlace para saltar la navegación con teclado o lector de pantalla. */
export function SaltarAlContenido({ destino = "contenido" }) {
  return <a className="saltar" href={`#${destino}`}>Saltar al contenido</a>;
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
