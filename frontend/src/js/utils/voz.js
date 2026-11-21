/** Voz y accesibilidad sin librerías (Web Speech API del navegador). */
import { guardarLocal, leerLocal } from "./storage.js";

/* Avisos para lectores de pantalla */
let region = null;
function regionViva() {
  if (!region) {
    region = document.createElement("div");
    region.className = "visually-hidden";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    document.body.appendChild(region);
  }
  return region;
}

export function anunciar(texto) {
  const r = regionViva();
  r.textContent = "";
  window.setTimeout(() => {
    r.textContent = texto;
  }, 50);
}

export const vozDisponible = () => "speechSynthesis" in window;

/** Habla en español con la voz del navegador. */
export function hablar(texto) {
  if (!vozDisponible()) return false;
  window.speechSynthesis.cancel();
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = "es-CO";
  frase.rate = 0.95;
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith("es"));
  if (voz) frase.voice = voz;
  window.speechSynthesis.speak(frase);
  return true;
}

/* Llamado por voz desde la consola del asesor */
export const INTERVALO_LLAMADO_MS = 20000;
const MAX_REPETICIONES = 9; // 9 x 20 s = 3 min (tiempo máximo de llegada)
const CLAVE = "filacero_llamado_voz";
const FEMENINOS = ["taquilla", "ventanilla", "caja", "mesa", "oficina", "sala"];

/** Artículo para el módulo: "al" (Módulo 2) o "a la" (Taquilla 1). */
export function articuloModulo(modulo) {
  const primera = String(modulo || "").trim().split(/\s+/)[0].toLowerCase();
  return FEMENINOS.includes(primera) ? "a la" : "al";
}

/** "Módulo 2" -> "al Módulo 2" */
export function destinoHablado(modulo, asesor) {
  const texto = String(modulo || "").trim();
  if (!texto) return asesor ? `con el asesor ${asesor}` : "al punto de atención";
  return `${articuloModulo(texto)} ${texto}`;
}

/** Deletrea el código para que se entienda: "1 2 0 4 8 9". */
export const deletrear = (codigo) => String(codigo || "").split("").join(" ");

export function textoLlamado(turno, modulo, asesor) {
  const codigo = deletrear(String(turno?.codigo || "").slice(-6));
  return `Turno ${codigo}. ${turno?.usuario_nombre || ""}, por favor acercarse ${destinoHablado(modulo, asesor)}.`;
}

export function vozActivada() {
  return leerLocal(CLAVE) !== "no";
}

/** Controlador del llamado por voz. */
export function crearLlamadoPorVoz() {
  const estado = { activo: vozActivada(), llamadoId: null, texto: "", veces: 0, proxima: null };
  let intervalo = null;
  let inicio = null;

  function detener() {
    window.clearTimeout(inicio);
    window.clearInterval(intervalo);
    intervalo = null;
    estado.veces = 0;
    estado.proxima = null;
    if (vozDisponible()) window.speechSynthesis.cancel();
  }

  function decir() {
    hablar(estado.texto);
    estado.veces += 1;
    estado.proxima = estado.veces >= MAX_REPETICIONES ? null : Date.now() + INTERVALO_LLAMADO_MS;
    if (!estado.proxima) window.clearInterval(intervalo);
  }

  function arrancar() {
    detener();
    if (!estado.llamadoId || !estado.activo || !vozDisponible()) return;
    inicio = window.setTimeout(() => {
      decir();
      intervalo = window.setInterval(decir, INTERVALO_LLAMADO_MS);
    }, 120);
  }

  return {
    estado,
    soportado: vozDisponible(),
    actualizar(turno, modulo, asesor) {
      const id = turno?.estado === "LLAMADO" ? turno.id : null;
      estado.texto = id ? textoLlamado(turno, modulo, asesor) : "";
      if (id !== estado.llamadoId) {
        estado.llamadoId = id;
        arrancar();
      }
    },
    alternar() {
      estado.activo = !estado.activo;
      guardarLocal(CLAVE, estado.activo ? "si" : "no");
      arrancar();
    },
    repetir() {
      if (estado.texto) hablar(estado.texto);
    },
    restante() {
      return estado.proxima ? Math.max(0, Math.ceil((estado.proxima - Date.now()) / 1000)) : null;
    },
    destruir: detener,
  };
}

/** Flechas izquierda/derecha para moverse entre pestañas (patrón ARIA). */
export function teclasPestanas(e) {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  const pestanas = [...e.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')];
  const i = pestanas.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const destino =
    e.key === "Home" ? 0 : e.key === "End" ? pestanas.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + pestanas.length) % pestanas.length;
  pestanas[destino].focus();
  pestanas[destino].click();
}
