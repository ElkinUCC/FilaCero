/** Consola del asesor: /api/v1/agente (rol AGENTE). */
import { http, query } from "./http.js";

/** Panel completo: turno actual, cola de hoy, franja en curso y recomendación. */
export const obtenerPanel = () => http.get("/agente/panel");

export const llamarSiguiente = () => http.post("/agente/llamar-siguiente", {});

const accion = (nombre) => (turnoId) => http.post(`/agente/turnos/${turnoId}/${nombre}`, {});

export const llamar = accion("llamar");
export const iniciar = accion("iniciar");
export const finalizar = accion("finalizar");
export const noAsistio = accion("no-asistio");
export const devolver = accion("devolver");

/** Rotación: el asesor elige la sede donde atiende (se registra en la bitácora). */
export const cambiarSede = (puntoId) => http.put("/agente/sede", { punto_id: puntoId });

/** Preparación previa: estado = PENDIENTE | EN_PREPARACION | LISTO | NOVEDAD. */
export const preparar = (turnoId, estado, nota = "") =>
  http.post(`/agente/turnos/${turnoId}/preparacion`, { estado, nota });

/** Qué está haciendo el asesor: DISPONIBLE | PAUSA | ALMUERZO | AUSENTE. */
export const cambiarPresencia = (presencia) => http.put("/agente/presencia", { presencia });

// equipos de clientes
export const listarEquipos = (filtros = {}) => http.get(`/equipos/${query(filtros)}`);
/** datos: { cliente_nombre, cliente_celular, marca, modelo, serial, falla, origen, fecha_compra, nota } */
export const registrarEquipo = (datos) => http.post("/equipos/", datos);
/** documento: cédula del dueño, obligatoria para recibir en sede y para entregar. */
export const cambiarEstadoEquipo = (id, estado, nota, documento) =>
  http.put(`/equipos/${id}/estado`, {
    estado,
    ...(nota !== undefined ? { nota } : {}),
    ...(documento ? { documento } : {}),
  });

// reclamos
export const escribirReclamo = (id, texto) => http.post(`/reclamos/${id}/mensajes`, { texto });
export const leerReclamo = (id) => http.put(`/reclamos/${id}/leido`, {});
export const bandejaReclamos = (filtros = {}) => http.get(`/reclamos/${query(filtros)}`);
export const gestionarReclamo = (id, estado, respuesta) =>
  http.put(`/reclamos/${id}`, { estado, respuesta });
