export const ZONA = "America/Bogota";

/** Fecha YYYY-MM-DD de "hoy" en Bogotá, sin importar la zona del navegador. */
export function hoyISO(desplazamientoDias = 0) {
  const base = new Date(Date.now() + desplazamientoDias * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(base);
}

/** Crea un Date a mediodía para formatear una fecha ISO sin saltos de zona. */
function fechaSegura(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

export function fechaCorta(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  }).format(fechaSegura(iso)).replaceAll(".", "");
}

export function fechaLarga(iso) {
  if (!iso) return "";
  const texto = new Intl.DateTimeFormat("es-CO", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(fechaSegura(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function diaSemana(iso) {
  return new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "UTC" })
    .format(fechaSegura(iso)).replace(".", "");
}

export function diaMes(iso) {
  return fechaSegura(iso).getUTCDate();
}

export function horaDe(isoUtc) {
  if (!isoUtc) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA,
  }).format(new Date(isoUtc));
}

export function duracion(segundos) {
  if (segundos == null || !Number.isFinite(Number(segundos))) return "—";
  const s = Math.max(0, Math.round(Number(segundos)));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const ESTADOS = {
  ESPERANDO: { texto: "En espera", tono: "espera" },
  LLAMADO: { texto: "Llamado", tono: "llamado" },
  EN_ATENCION: { texto: "En atención", tono: "atencion" },
  ATENDIDO: { texto: "Atendido", tono: "ok" },
  CANCELADO: { texto: "Cancelado", tono: "cancelado" },
  NO_ASISTIO: { texto: "No asistió", tono: "ausente" },
};

export function soloDigitos(valor, max = 10) {
  return String(valor || "").replace(/\D/g, "").slice(0, max);
}

export function leerLocal(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

export function guardarLocal(clave, valor) {
  try {
    if (valor == null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch { /* almacenamiento no disponible */ }
}
