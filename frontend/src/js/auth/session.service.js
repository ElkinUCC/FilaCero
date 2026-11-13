/**
 * Sesión del personal (token JWT + datos básicos del usuario).
 *
 * Única puerta para leer o escribir la sesión: ningún componente toca
 * localStorage directamente. El ciudadano no tiene sesión (reserva sin cuenta).
 */
import { guardarLocal, leerLocal } from "../utils/storage.js";

const CLAVE_TOKEN = "filacero_token";
const CLAVE_USUARIO = "filacero_usuario";

export function saveSession(token, usuario) {
  if (!token || !usuario) throw new Error("Faltan el token o los datos del usuario.");
  guardarLocal(CLAVE_TOKEN, token);
  guardarLocal(CLAVE_USUARIO, JSON.stringify(usuario));
}

export function getToken() {
  return leerLocal(CLAVE_TOKEN);
}

export function getUsuario() {
  try {
    const valor = leerLocal(CLAVE_USUARIO);
    if (!valor || !getToken()) return null;
    const usuario = JSON.parse(valor);
    return usuario && typeof usuario === "object" ? usuario : null;
  } catch {
    clearSession();
    return null;
  }
}

/** Actualiza solo los datos del usuario (p. ej. tras cambiar su contraseña). */
export function updateUsuario(usuario, token = getToken()) {
  saveSession(token, usuario);
}

export function clearSession() {
  guardarLocal(CLAVE_TOKEN, null);
  guardarLocal(CLAVE_USUARIO, null);
}

export function hasSession() {
  return Boolean(getToken() && getUsuario());
}
