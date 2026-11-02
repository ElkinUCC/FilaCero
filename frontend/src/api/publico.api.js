/**
 * Portal del ciudadano y pantalla de sala: rutas públicas (sin token).
 * El ciudadano no tiene cuenta: se identifica con su celular verificado por código.
 */
import { http, query } from "./http";

const publico = { sinToken: true };

export const obtenerHorario = () => http.get("/horario", publico);
export const listarSedes = () => http.get("/sedes/", publico);
export const listarTramites = () => http.get("/tramites/", publico);

/** Franjas de 30 min con cupo para una sede, trámite y fecha (cupo por sede). */
export const franjasDisponibles = ({ sedeId, tramiteId, fecha }) =>
  http.get(`/franjas/disponibles${query({ sede_id: sedeId, tramite_id: tramiteId, fecha })}`, publico);

export const solicitarCodigo = (celular) =>
  http.post("/turnos/publico/solicitar-codigo", { celular }, publico);

export const verificarCodigo = (celular, codigo) =>
  http.post("/turnos/publico/verificar-codigo", { celular, codigo }, publico);

export const reservarTurno = (datos) => http.post("/turnos/publico", datos, publico);

export const consultarTurno = (codigo, celular) =>
  http.post("/turnos/publico/consultar", { codigo, celular }, publico);

export const cancelarTurno = (codigo, celular) =>
  http.post("/turnos/publico/cancelar", { codigo, celular }, publico);

/** Pantalla de la sala de espera (sin datos personales). */
export const pantallaSala = (sedeId) =>
  http.get(`/turnos/publico/sala${query({ sede_id: sedeId })}`, publico);
