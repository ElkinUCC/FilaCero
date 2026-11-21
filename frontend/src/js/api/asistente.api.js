/** Asistente FilaCero IA (/api/v1/asistente). */
import { http } from "./http.js";

export const sugerenciasAsistente = () => http.get("/asistente/sugerencias");

/** historial: [{ rol: "usuario" | "asistente", texto }] (últimos turnos). */
export const preguntarAsistente = (pregunta, historial = [], extra = {}) =>
  http.post("/asistente/preguntar", { pregunta, historial, ...extra });
