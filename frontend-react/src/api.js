import { guardarLocal, leerLocal } from "./util";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api/v1").replace(/\/+$/, "");

const CLAVE_TOKEN = "filacero_token";
const CLAVE_USUARIO = "filacero_usuario";

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

function extraerMensaje(data, status) {
  if (data && typeof data === "object") {
    return data.error || data.mensaje || data.message || `La solicitud falló (HTTP ${status}).`;
  }
  if (status === 429) return "Demasiados intentos. Espera un momento e intenta de nuevo.";
  return `La solicitud falló (HTTP ${status}).`;
}

export async function apiRequest(path, options = {}) {
  const ruta = path.startsWith("/") ? path : `/${path}`;
  const token = leerLocal(CLAVE_TOKEN);
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body != null && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !options.sinToken) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${ruta}`, { ...options, headers });
  } catch {
    throw new Error("No hay conexión con el servidor. Revisa que el backend esté encendido.");
  }

  const data = await leerRespuesta(response);

  if (!response.ok) {
    // Token vencido o inválido: se cierra la sesión en toda la app.
    if (response.status === 401 && token && !options.sinToken && !ruta.includes("/usuarios/login")) {
      cerrarSesion();
      window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
    }
    const error = new Error(extraerMensaje(data, response.status));
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (ruta, opciones) => apiRequest(ruta, opciones),
  post: (ruta, cuerpo, opciones) =>
    apiRequest(ruta, { ...opciones, method: "POST", body: JSON.stringify(cuerpo ?? {}) }),
  put: (ruta, cuerpo) => apiRequest(ruta, { method: "PUT", body: JSON.stringify(cuerpo ?? {}) }),
  del: (ruta) => apiRequest(ruta, { method: "DELETE" }),
};

export function guardarSesion(token, usuario) {
  if (!token || !usuario) throw new Error("Faltan el token o los datos del usuario.");
  guardarLocal(CLAVE_TOKEN, token);
  guardarLocal(CLAVE_USUARIO, JSON.stringify(usuario));
}

export function cerrarSesion() {
  guardarLocal(CLAVE_TOKEN, null);
  guardarLocal(CLAVE_USUARIO, null);
}

export function obtenerUsuario() {
  try {
    const valor = leerLocal(CLAVE_USUARIO);
    if (!valor || !leerLocal(CLAVE_TOKEN)) return null;
    const usuario = JSON.parse(valor);
    return usuario && typeof usuario === "object" ? usuario : null;
  } catch {
    cerrarSesion();
    return null;
  }
}
