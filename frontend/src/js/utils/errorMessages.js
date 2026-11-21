/** Convierte una respuesta de error de la API en un mensaje legible. */

const POR_ESTADO = {
  0: "No hay conexión con el servidor. Revisa que el backend esté encendido.",
  400: "Revisa los datos enviados.",
  401: "Debes iniciar sesión.",
  403: "No tienes permisos para esta acción.",
  404: "No encontramos lo que buscas.",
  409: "El registro ya existe o cambió mientras lo editabas.",
  429: "Demasiados intentos. Espera un momento e intenta de nuevo.",
  500: "Ocurrió un error en el servidor. Intenta de nuevo.",
};

/** Primer mensaje de validación de Marshmallow: {"campo": ["mensaje"]} -> "campo: mensaje". */
function primerDetalle(detalles) {
  if (!detalles || typeof detalles !== "object") return "";
  const [campo, mensajes] = Object.entries(detalles)[0] || [];
  if (!campo) return "";
  const texto = Array.isArray(mensajes) ? mensajes[0] : String(mensajes);
  return `${campo}: ${texto}`;
}

export function formatApiError(data, status) {
  if (data && typeof data === "object") {
    const base = data.error || data.mensaje || data.message;
    const detalle = primerDetalle(data.detalles);
    if (base && detalle) return `${base} (${detalle})`;
    if (base) return base;
  }
  return POR_ESTADO[status] || `La solicitud falló (HTTP ${status}).`;
}

export const MENSAJE_SIN_CONEXION = POR_ESTADO[0];
