/**
 * Portal del ciudadano y pantalla de sala: rutas públicas (sin token).
 * El ciudadano no tiene cuenta: se identifica con su celular verificado por código.
 */
import { http, query } from "./http.js";

const publico = { sinToken: true };

export const obtenerHorario = () => http.get("/horario", publico);
export const listarSedes = () => http.get("/sedes/", publico);
export const listarTramites = () => http.get("/tramites/", publico);

/** Franjas de 30 min con cupo para una sede, trámite y fecha (cupo por sede). */
export const franjasDisponibles = ({ sedeId, tramiteId, fecha }) =>
  http.get(`/franjas/disponibles${query({ sede_id: sedeId, tramite_id: tramiteId, fecha })}`, publico);

/** Sin celular y con codigoTurno: el código llega al celular registrado en ese turno. */
export const solicitarCodigo = (celular, codigoTurno) =>
  http.post(
    "/turnos/publico/solicitar-codigo",
    { ...(celular ? { celular } : {}), ...(codigoTurno ? { codigo_turno: codigoTurno } : {}) },
    publico
  );

export const verificarCodigo = (celular, codigo, proposito = "reserva", codigoTurno) =>
  http.post(
    "/turnos/publico/verificar-codigo",
    { ...(celular ? { celular } : {}), codigo, proposito, ...(codigoTurno ? { codigo_turno: codigoTurno } : {}) },
    publico
  );

export const reservarTurno = (datos) => http.post("/turnos/publico", datos, publico);

export const consultarTurnosPorCelular = (celular, tokenVerificacion) =>
  http.post(
    "/turnos/publico/consultar-por-celular",
    { celular, token_verificacion: tokenVerificacion },
    publico
  );

export const consultarTurno = (codigo, celular, tokenVerificacion) =>
  http.post(
    "/turnos/publico/consultar",
    { codigo, ...(celular ? { celular } : {}), token_verificacion: tokenVerificacion },
    publico
  );

export const cancelarTurno = (codigo, celular, tokenVerificacion) =>
  http.post(
    "/turnos/publico/cancelar",
    { codigo, ...(celular ? { celular } : {}), token_verificacion: tokenVerificacion },
    publico
  );

/** Pantalla de la sala de espera (sin datos personales). */
export const pantallaSala = (sedeId) =>
  http.get(`/turnos/publico/sala${query({ sede_id: sedeId })}`, publico);

// ------------------------------------------------------- equipos y reclamos
// Requieren el token del celular verificado (OTP): el ciudadano no tiene cuenta.
const conToken = (celular, tokenVerificacion, extra = {}) => ({
  celular, token_verificacion: tokenVerificacion, ...extra,
});

/** Equipos registrados con ese celular y el nombre del cliente si ya existe. */
export const misEquipos = (celular, token) =>
  http.post("/equipos/publico/mios", conToken(celular, token), publico);

export const misReclamos = (celular, token, marcarLeidos = true) =>
  http.post("/reclamos/publico/mios", conToken(celular, token, { marcar_leidos: marcarLeidos }), publico);

/** Minichat: el ciudadano escribe sobre su reclamo o consulta. */
export const escribirReclamo = (celular, token, radicado, texto) =>
  http.post("/reclamos/publico/mensajes", conToken(celular, token, { radicado, texto }), publico);

/** datos: { nombre, categoria, descripcion, punto_id, equipo_id?, presencial } */
export const radicarReclamo = (celular, token, datos) =>
  http.post("/reclamos/publico", conToken(celular, token, datos), publico);

export const catalogoEquipos = () => http.get("/equipos/catalogo", publico);
export const catalogoReclamos = () => http.get("/reclamos/catalogo", publico);
