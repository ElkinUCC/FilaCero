/** Consola del asesor: /api/v1/agente (rol AGENTE). */
import { http } from "./http";

/** Panel completo: turno actual, cola de hoy, franja en curso y recomendación. */
export const obtenerPanel = () => http.get("/agente/panel");

export const llamarSiguiente = () => http.post("/agente/llamar-siguiente", {});

const accion = (nombre) => (turnoId) => http.post(`/agente/turnos/${turnoId}/${nombre}`, {});

export const llamar = accion("llamar");
export const iniciar = accion("iniciar");
export const finalizar = accion("finalizar");
export const noAsistio = accion("no-asistio");
export const devolver = accion("devolver");
