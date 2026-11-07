/**
 * Panel de administración (ADMIN y SUPERVISOR; el backend valida el rol).
 *   /api/v1/admin/agentes   -> asesores, métricas, historial, en vivo
 *   /api/v1/admin/usuarios  -> cuentas, permisos y bitácora (solo ADMIN)
 */
import { http, query } from "./http";

// ---------------------------------------------------------------- métricas
export const metricas = (rango) => http.get(`/admin/agentes/metricas${query(rango)}`);
export const metricasPorSede = (rango) => http.get(`/admin/agentes/metricas/sedes${query(rango)}`);
export const metricasPorTramite = (rango) =>
  http.get(`/admin/agentes/metricas/tramites${query(rango)}`);
/** Tablero ejecutivo: { dias } o { desde, hasta } y punto_id opcional. */
export const tablero = (filtros) => http.get(`/admin/agentes/tablero${query(filtros)}`);
export const enVivo = () => http.get("/admin/agentes/en-vivo");

/** filtros: { pagina, por_pagina, estado, punto_id, desde, hasta, buscar } */
export const historial = (filtros) => http.get(`/admin/agentes/historial${query(filtros)}`);

// ---------------------------------------------------------------- asesores
export const listarAgentes = () => http.get("/admin/agentes/");
export const crearAgente = (datos) => http.post("/admin/agentes/", datos);
export const actualizarAgente = (id, datos) => http.put(`/admin/agentes/${id}`, datos);
/** Baja definitiva: la cuenta desaparece y su historial se conserva. */
export const eliminarAgente = (id) => http.del(`/admin/agentes/${id}`);

// ---------------------------------------------------------------- usuarios
export const listarUsuarios = () => http.get("/admin/usuarios/");
export const crearUsuario = (datos) => http.post("/admin/usuarios/", datos);
export const actualizarUsuario = (id, datos) => http.put(`/admin/usuarios/${id}`, datos);
export const restablecerClave = (id) => http.post(`/admin/usuarios/${id}/restablecer-clave`, {});
export const eliminarUsuario = (id) => http.del(`/admin/usuarios/${id}`);

/** filtros: { pagina, por_pagina, accion } */
export const auditoria = (filtros) => http.get(`/admin/usuarios/auditoria${query(filtros)}`);
