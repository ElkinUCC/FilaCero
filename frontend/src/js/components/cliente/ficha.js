/** Ficha de turno que se llena en vivo mientras se reserva y "se imprime" al confirmar. */
import { html } from "../../utils/dom.js";
import { codigoTurno, fechaLarga } from "../../utils/formatters.js";

export function fichaHTML({ resumen = {}, turno = null } = {}) {
  const datos = turno
    ? { sede: turno.sede, tramite: turno.tramite, fecha: turno.fecha, hora: `${turno.hora_inicio} – ${turno.hora_fin}`, nombre: turno.nombre }
    : resumen;
  const filas = [
    ["Sede", datos.sede],
    ["Servicio", datos.tramite],
    ["Fecha", datos.fecha ? fechaLarga(datos.fecha) : null],
    ["Hora", datos.hora],
    ["A nombre de", datos.nombre],
  ];
  const completas = filas.filter(([, v]) => v).length;
  const avance = turno ? 100 : (completas / filas.length) * 100;
  return html`
    <div class="ficha ${turno ? "ficha--impresa" : ""}">
      <div class="ficha__cabeza">
        <span class="ficha__marca">FilaCero</span>
        <span class="ficha__tipo">${turno ? "Turno confirmado" : "Tu turno"}</span>
      </div>
      <div class="ficha__codigo ${turno ? "" : "ficha__codigo--vacio"}">${turno ? codigoTurno(turno) : "TU-······"}</div>
      <div class="ficha__corte" aria-hidden="true"></div>
      <dl class="ficha__datos">
        ${filas.map(([etiqueta, valor]) => html`<div class="${valor ? "" : "ficha__vacio"}"><dt>${etiqueta}</dt><dd>${valor || "—"}</dd></div>`)}
      </dl>
      <div class="ficha__progreso" aria-hidden="true"><span style="width: ${avance}%"></span></div>
    </div>`;
}
