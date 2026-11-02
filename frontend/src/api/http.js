/**
 * Cliente HTTP único de FilaCero.
 *
 * - Base: VITE_API_URL (http://127.0.0.1:5000/api/v1 en desarrollo).
 * - Agrega "Authorization: Bearer <token>" si hay sesión.
 * - 401 con sesión: cierra la sesión en toda la app (evento global).
 * - 403: NO cierra la sesión; la pantalla muestra "sin permiso".
 * - Errores: lanza Error con el mensaje del backend y error.status.
 *
 * Ningún componente usa fetch directamente: todo pasa por aquí (ver *.api.js).
 */
import { clearSession, getToken } from "../auth/session.service";
import { formatApiError, MENSAJE_SIN_CONEXION } from "../utils/errorMessages";

export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api/v1").replace(/\/+$/, "");

export const EVENTO_SESION_EXPIRADA = "filacero:sesion-expirada";

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

  if (opcionesFetch.body != null && !(opcionesFetch.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !sinToken) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_URL}${ruta}`, { ...opcionesFetch, headers });
  } catch {
    const error = new Error(MENSAJE_SIN_CONEXION);
    error.status = 0;
    throw error;
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
