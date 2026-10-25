
const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000/api/v1";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("filacero_token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      data?.error ||
      data?.mensaje ||
      `Error HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export function guardarSesion(token, usuario) {
  localStorage.setItem("filacero_token", token);
  localStorage.setItem(
    "filacero_usuario",
    JSON.stringify(usuario)
  );
}

export function cerrarSesion() {
  localStorage.removeItem("filacero_token");
  localStorage.removeItem("filacero_usuario");
}

export function obtenerUsuario() {
  try {
    return JSON.parse(
      localStorage.getItem("filacero_usuario") || "null"
    );
  } catch {
    return null;
  }
}
