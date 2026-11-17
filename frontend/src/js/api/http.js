/**
 * Cliente HTTP único de FilaCero (fetch nativo del navegador).
 *
 * - Base: CONFIG.API_URL (http://127.0.0.1:5000/api/v1 en localhost).
 * - Agrega "Authorization: Bearer <token>" si hay sesión.
 * - Sin sesión envía "X-Organization-Slug" (organización de las reservas públicas).
 * - 401 con sesión: cierra la sesión en toda la app (evento global).
 * - 403: NO cierra la sesión; la pantalla muestra "sin permiso".
 * - Errores: lanza Error con el mensaje del backend y error.status.
 *
 * Ninguna página usa fetch directamente: todo pasa por aquí (ver *.api.js).
 */
import { CONFIG } from "../config.js";
import { clearSession, getToken } from "../auth/session.service.js";
import { formatApiError, MENSAJE_SIN_CONEXION } from "../utils/errorMessages.js";

export const API_URL = CONFIG.API_URL.replace(/\/+$/, "");
export const ORGANIZATION_SLUG = CONFIG.ORGANIZATION_SLUG.trim().toLowerCase();

export const EVENTO_SESION_EXPIRADA = "filacero:sesion-expirada";
export const EVENTO_SERVIDOR_LENTO = "filacero:servidor-lento";

let solicitudesLentas = 0;
function avisarLento(cambio) {
  const antes = solicitudesLentas > 0;
  solicitudesLentas += cambio;
  const ahora = solicitudesLentas > 0;
  if (antes !== ahora) window.dispatchEvent(new CustomEvent(EVENTO_SERVIDOR_LENTO, { detail: ahora }));
}

async function leerRespuesta(response) {
  if (response.status === 204) return null;
  const tipo = response.headers.get("content-type") || "";
  if (tipo.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      throw new Error("El servidor devolvió una respuesta inválida.");
    }
  }
  const texto = await response.text();
  return texto || null;
}

export async function request(path, options = {}) {
  const ruta = path.startsWith("/") ? path : `/${path}`;
  const { sinToken, ...opcionesFetch } = options;
  const token = getToken();
  const headers = new Headers(opcionesFetch.headers || {});
  headers.set("Accept", "application/json");
  if (opcionesFetch.body != null) headers.set("Content-Type", "application/json");
  if (token && !sinToken) headers.set("Authorization", `Bearer ${token}`);
  else if (ORGANIZATION_SLUG) headers.set("X-Organization-Slug", ORGANIZATION_SLUG);

  // Servidores gratuitos se "duermen": si la respuesta tarda, se avisa en pantalla.
  let lenta = false;
  const aviso = window.setTimeout(() => {
    lenta = true;
    avisarLento(1);
  }, 4000);

  let response;
  try {
    response = await fetch(`${API_URL}${ruta}`, { ...opcionesFetch, headers });
  } catch {
    const error = new Error(MENSAJE_SIN_CONEXION);
    error.status = 0;
    throw error;
  } finally {
    window.clearTimeout(aviso);
    if (lenta) avisarLento(-1);
  }

  const data = await leerRespuesta(response);
  if (!response.ok) {
    // Token vencido, revocado o usuario desactivado: se cierra la sesión.
    if (response.status === 401 && token && !sinToken && !ruta.includes("/usuarios/login")) {
      clearSession();
      window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
    }
    const error = new Error(formatApiError(data, response.status));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const conCuerpo = (metodo) => (ruta, cuerpo, opciones) =>
  request(ruta, { ...opciones, method: metodo, body: JSON.stringify(cuerpo ?? {}) });

export const http = {
  get: (ruta, opciones) => request(ruta, opciones),
  post: conCuerpo("POST"),
  put: conCuerpo("PUT"),
  del: (ruta, opciones) => request(ruta, { ...opciones, method: "DELETE" }),
};

/** Arma "?a=1&b=2" ignorando valores vacíos. */
export function query(parametros = {}) {
  const q = new URLSearchParams();
  Object.entries(parametros).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== "") q.set(clave, valor);
  });
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}
