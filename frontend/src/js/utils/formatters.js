/** Formato de fechas, horas, duraciones y estados para mostrar en pantalla. */

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

/** Preparación previa del turno (lo que el asesor alista antes de la llegada). */
export const PREPARACION = {
  PENDIENTE: { texto: "Por preparar", tono: "espera", corto: "Por preparar" },
  EN_PREPARACION: { texto: "En preparación", tono: "llamado", corto: "Preparando" },
  LISTO: { texto: "Listo para entregar", tono: "ok", corto: "Listo" },
  NOVEDAD: { texto: "Con novedad", tono: "ausente", corto: "Novedad" },
};

/** Fecha y hora completas en Bogotá: "7 nov 2026, 13:05". */
export function fechaHora(isoUtc) {
  if (!isoUtc) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: ZONA,
  }).format(new Date(isoUtc)).replaceAll(".", "");
}

/** Valor de una respuesta del formulario del trámite, legible. */
export function valorRespuesta(valor) {
  if (valor === true) return "Sí";
  if (valor === false) return "No";
  return valor ?? "—";
}

/** Estados del equipo del cliente (orden de servicio). */
export const ESTADOS_EQUIPO = {
  POR_RECIBIR: { texto: "Por recibir", tono: "espera", paso: 0 },
  RECIBIDO: { texto: "Recibido", tono: "llamado", paso: 1 },
  EN_REPARACION: { texto: "En reparación", tono: "atencion", paso: 2 },
  LISTO: { texto: "Listo para entregar", tono: "ok", paso: 3 },
  ENTREGADO: { texto: "Entregado", tono: "cancelado", paso: 4 },
};

export const ESTADOS_RECLAMO = {
  RADICADO: { texto: "Radicado", tono: "espera" },
  EN_GESTION: { texto: "En gestión", tono: "llamado" },
  RESUELTO: { texto: "Resuelto", tono: "ok" },
};

/** Lo que hace el asesor cuando no está atendiendo. */
export const PRESENCIAS = {
  DISPONIBLE: { texto: "Disponible", tono: "ok", icono: "check" },
  PAUSA: { texto: "En pausa", tono: "espera", icono: "reloj" },
  ALMUERZO: { texto: "En almuerzo", tono: "llamado", icono: "cafe" },
  AUSENTE: { texto: "Fuera de turno", tono: "cancelado", icono: "salir" },
};

/** Tipos de atención de un trámite (cómo se reserva). */
export const FLUJOS = {
  GENERAL: { texto: "General", detalle: "Reserva sede, día y hora." },
  ENTREGA: { texto: "Entrega de equipo", detalle: "El cliente elige su equipo listo para recoger." },
  GARANTIA: { texto: "Garantía", detalle: "Marca, fecha de compra (máx. 1 año) y falla." },
  RECLAMO: { texto: "Reclamo", detalle: "Radica en línea o lo sigue en persona." },
};

/** "Hace 12 min" desde una fecha ISO con desfase (-05:00). */
export function haceTiempo(iso) {
  if (!iso) return "";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

/** Código visible y corto de un turno: "TU-13ACE4". */
export function codigoTurno(turno) {
  if (!turno) return "";
  if (turno.codigo_corto) return turno.codigo_corto;
  const c = typeof turno === "string" ? turno : turno.codigo;
  if (!c) return "";
  return c.startsWith("TU-") ? c : `TU-${c.slice(-6)}`;
}

/** Iniciales para el avatar: "Juliana Restrepo Arango" -> "JR". */
export function iniciales(nombre) {
  return String(nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Primer nombre: "Juliana Restrepo" -> "Juliana". */
export function primerNombre(nombre) {
  return String(nombre || "").trim().split(/\s+/)[0] || "";
}

/** Solo ENTREGA y GARANTIA se alistan antes de que llegue el cliente. */
export const FLUJOS_CON_PREPARACION = ["ENTREGA", "GARANTIA"];

/** Estados de preparación con palabras propias de cada tipo de atención. */
const PREP_POR_FLUJO = {
  ENTREGA: {
    PENDIENTE: "Equipo por alistar",
    EN_PREPARACION: "Alistando el equipo",
    LISTO: "Equipo listo para entregar",
    NOVEDAD: "Equipo con novedad",
  },
  GARANTIA: {
    PENDIENTE: "Garantía por revisar",
    EN_PREPARACION: "Revisando la garantía",
    LISTO: "Garantía revisada",
    NOVEDAD: "Garantía con novedad",
  },
};
export function textoPreparacion(flujo, estado) {
  return PREP_POR_FLUJO[flujo]?.[estado] || PREPARACION[estado]?.texto || "";
}

/** Lo que ve el ciudadano sobre lo que dejamos listo, según el tipo de atención. */
export const PREP_CLIENTE = {
  ENTREGA: {
    icono: "paquete",
    titulo: "Tu equipo te espera listo.",
    texto: "Lo probamos y empacamos antes de que llegues. Trae tu cédula: sin ella no podemos entregarlo.",
  },
  GARANTIA: {
    icono: "escudo2",
    titulo: "Revisamos tu garantía antes de que llegues.",
    texto: "Trae el televisor, la factura de compra y tu cédula.",
  },
};
