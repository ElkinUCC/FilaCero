
const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api/v1"
).replace(/\/+$/, "");

function normalizarRuta(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

async function leerRespuesta(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      throw new Error("El servidor devolvió una respuesta JSON inválida.");
    }
  }

  const texto = await response.text();

  return texto || null;
}

function extraerMensaje(data, status) {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    return (
      data.error ||
      data.mensaje ||
      data.message ||
      data.detail ||
      `La solicitud falló (HTTP ${status}).`
    );
  }

  return `La solicitud falló (HTTP ${status}).`;
}

export async function apiRequest(path, options = {}) {
  const ruta = normalizarRuta(path);
  const token = localStorage.getItem("filacero_token");

  const headers = new Headers(options.headers || {});

  headers.set("Accept", "application/json");

  const esFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  if (options.body != null && !esFormData) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response;

  try {
    response = await fetch(`${API_URL}${ruta}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Comprueba que Flask esté ejecutándose y que la URL de la API sea correcta."
    );
  }

  const data = await leerRespuesta(response);

  if (!response.ok) {
    throw new Error(extraerMensaje(data, response.status));
  }

  return data;
}

export function guardarSesion(token, usuario) {
  if (!token || !usuario) {
    throw new Error(
      "No se puede guardar la sesión: faltan el token o los datos del usuario."
    );
  }

  localStorage.setItem("filacero_token", token);
  localStorage.setItem("filacero_usuario", JSON.stringify(usuario));
}

export function cerrarSesion() {
  localStorage.removeItem("filacero_token");
  localStorage.removeItem("filacero_usuario");
}

export function obtenerUsuario() {
  try {
    const valor = localStorage.getItem("filacero_usuario");

    if (!valor) return null;

    const usuario = JSON.parse(valor);

    if (!usuario || typeof usuario !== "object") {
      cerrarSesion();
      return null;
    }

    return usuario;
  } catch {
    cerrarSesion();
    return null;
  }
}
