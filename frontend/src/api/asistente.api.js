/**
 * Asistente FilaCero IA (/api/v1/asistente). El rol sale del token: el
 * administrador recibe el asistente gerencial y el asesor su copiloto.
 */
import { http } from "./http";

export const sugerenciasAsistente = () => http.get("/asistente/sugerencias");

/** historial: [{ rol: "usuario" | "asistente", texto }] (últimos turnos). */
export const preguntarAsistente = (pregunta, historial = [], extra = {}) =>
  http.post("/asistente/preguntar", { pregunta, historial, ...extra });
