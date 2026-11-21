/** Pide la cédula del dueño antes de entregar un equipo */
import * as agenteApi from "../../api/agente.api.js";
import { html, pintar } from "../../utils/dom.js";
import { soloDigitos } from "../../utils/formatters.js";
import { icono } from "../ui/icon.js";
import { abrirModal, mensajeError } from "../ui/modal.js";
import { cargando } from "../ui/cargando.js";

export function abrirVerificarCedula({ equipo, estado, nombre, alListo }) {
  const entrega = estado === "ENTREGADO";
  const registrada = equipo.cliente_documento;
  const dueno = nombre || equipo.cliente_nombre || "el cliente";
  const s = { cedula: "", ocupado: false, error: "" };

  const pie = () => html`
    <button type="button" class="btn btn--suave" data-cerrar>Cancelar</button>
    <button type="submit" form="form-cedula" class="btn ${entrega ? "btn--exito" : "btn--primario"}" ${s.ocupado || s.cedula.length < 6 ? "disabled" : ""}>
      ${icono(entrega ? "check" : "paquete", 16)} ${s.ocupado ? cargando("Verificando…") : entrega ? "Verificar y entregar" : "Verificar y recibir"}
    </button>`;
  const cuerpo = () => html`
    <form id="form-cedula" class="formulario cedula">
      <p class="cedula__ayuda">
        ${icono("escudo2", 18)}
        <span>
          ${entrega ? "Pide la cédula original y escribe el número. Solo el titular puede recibir el equipo." : "Registra la cédula del titular: será la que se pida al entregarlo."}
          ${registrada ? html` Registrada: termina en <strong>${registrada.replace(/^·+/, "")}</strong>.` : ""}
        </span>
      </p>
      <label>
        <span class="etiqueta">Cédula del titular</span>
        <span class="campo campo--grande ${s.error ? "is-invalid" : ""}">
          ${icono("ficha", 18)}
          <input id="cedula-numero" inputmode="numeric" autocomplete="off" value="${s.cedula}" placeholder="Ej. 1037654321" aria-label="Número de cédula" />
        </span>
      </label>
      ${mensajeError(s.error)}
    </form>`;

  const v = abrirModal({
    titulo: entrega ? `Entregar a ${dueno}` : `Recibir el equipo de ${dueno}`,
    descripcion: `${equipo.marca} ${equipo.modelo || ""} · ${equipo.codigo}`,
    ancho: 460,
    cuerpo: cuerpo(),
    pie: pie(),
  });
  const repintar = () => {
    pintar(v.cuerpo, cuerpo());
    pintar(v.pie, pie());
  };
  v.caja.querySelector("#cedula-numero").focus();

  v.caja.addEventListener("input", (e) => {
    if (e.target.id !== "cedula-numero") return;
    s.cedula = soloDigitos(e.target.value, 12);
    s.error = "";
    repintar();
  });
  v.caja.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (s.cedula.length < 6) {
      s.error = "La cédula tiene entre 6 y 12 dígitos.";
      repintar();
      return;
    }
    s.ocupado = true;
    s.error = "";
    repintar();
    try {
      const r = await agenteApi.cambiarEstadoEquipo(equipo.id, estado, undefined, s.cedula);
      v.cerrar();
      alListo(r);
    } catch (err) {
      s.error = err.message;
      s.ocupado = false;
      repintar();
    }
  });
}
