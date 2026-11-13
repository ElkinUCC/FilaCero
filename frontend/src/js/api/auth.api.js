/** Autenticación del personal: /api/v1/usuarios */
import { http } from "./http.js";

export const login = (correo, password) =>
  http.post("/usuarios/login", { correo, password }, { sinToken: true });

/** Revoca el token en el servidor (si falla, igual se cierra la sesión local). */
export const logout = () => http.post("/usuarios/logout", {});

export const miCuenta = () => http.get("/usuarios/me");

/** Devuelve { usuario, access_token } nuevos: las sesiones anteriores quedan revocadas. */
export const cambiarClave = (actual, nueva) => http.post("/usuarios/me/clave", { actual, nueva });
