/**
 * Catálogo: sedes (/api/v1/sedes) y trámites (/api/v1/tramites).
 * Lectura pública; crear, editar y eliminar solo ADMIN.
 */
import { http, query } from "./http";

export const RECURSOS = {
  sedes: { ruta: "/sedes/", lista: "puntos", item: "punto" },
  tramites: { ruta: "/tramites/", lista: "tramites", item: "tramite" },
};

/** todos=true incluye los inactivos (solo personal del panel). */
export async function listar(tipo, { todos = false } = {}) {
  const { ruta, lista } = RECURSOS[tipo];
  const r = await http.get(`${ruta}${query({ todos: todos ? 1 : undefined })}`);
  return r?.[lista] || [];
}

export async function crear(tipo, datos) {
  const { ruta, item } = RECURSOS[tipo];
  const r = await http.post(ruta, datos);
  return { registro: r[item], mensaje: r.mensaje };
}

export async function actualizar(tipo, id, datos) {
  const { ruta, item } = RECURSOS[tipo];
  const r = await http.put(`${ruta}${id}`, datos);
  return { registro: r[item], mensaje: r.mensaje };
}

export const eliminar = (tipo, id) => http.del(`${RECURSOS[tipo].ruta}${id}`);

export const listarSedes = (opciones) => listar("sedes", opciones);
