/** Selector de lo que está haciendo el asesor: Disponible, En pausa, En almuerzo o Fuera de turno. */
import { html } from "../../utils/dom.js";
import { horaDe, PRESENCIAS } from "../../utils/formatters.js";
import { icono } from "../ui/icon.js";

export function presenciaHTML({ valor = "DISPONIBLE", desde, bloqueado, abierto }) {
  const actual = PRESENCIAS[valor] || PRESENCIAS.DISPONIBLE;
  return html`
    <div class="presencia" data-presencia>
      <button type="button" class="presencia__boton presencia--${actual.tono}" aria-expanded="${Boolean(abierto)}" data-accion="presencia-menu"
        title="${desde ? `Desde las ${horaDe(desde)}` : "Tu estado"}">
        <i aria-hidden="true"></i><span>${actual.texto}</span>${icono("abajo", 14)}
      </button>
      ${abierto
        ? html`
            <div class="presencia__menu" role="menu">
              ${Object.entries(PRESENCIAS).map(
                ([clave, p]) => html`
                  <button type="button" role="menuitemradio" aria-checked="${clave === valor}" data-accion="presencia" data-valor="${clave}"
                    class="presencia__op presencia--${p.tono} ${clave === valor ? "activo" : ""}" ${bloqueado && clave !== "DISPONIBLE" ? "disabled" : ""}>
                    <i aria-hidden="true"></i>${icono(p.icono, 16)}<span>${p.texto}</span>
                    ${clave === valor ? icono("check", 15, { clase: "presencia__check" }) : ""}
                  </button>`,
              )}
              ${bloqueado ? html`<p class="presencia__nota">Termina el turno en curso para salir a pausa.</p>` : ""}
            </div>`
        : ""}
    </div>`;
}
