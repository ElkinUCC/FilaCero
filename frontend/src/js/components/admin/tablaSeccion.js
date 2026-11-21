/** Tabla estándar de todas las secciones del panel. */
import { html } from "../../utils/dom.js";
import { icono } from "../ui/icon.js";

export const COLUMNAS_SECCION = 6;
const ALINEAR = ["left", "left", "left", "left", "center", "right"];
const ANCHOS = [27, 17, 17, 17, 12, 10];

export function tablaSeccion({ columnas, filas, cargando, vacio, etiqueta, alinear = ALINEAR, anchos = ANCHOS }) {
  return html`
    <div class="table-responsive tabla-envoltura">
      <table class="table table-hover align-middle tabla tabla--seccion" aria-label="${etiqueta}">
        <colgroup>${anchos.map((a) => html`<col style="width: ${a}%" />`)}</colgroup>
        <thead>
          <tr>
            ${columnas.map(
              (c, i) => html`<th scope="col" class="al-${alinear[i]} ${i === columnas.length - 1 ? "acciones" : ""}">${i === columnas.length - 1 && !c ? html`<span class="visually-hidden">Acciones</span>` : c}</th>`,
            )}
          </tr>
        </thead>
        <tbody>
          ${filas.map(
            (f) => html`
              <tr class="${f.inactivo ? "inactivo" : ""}">
                ${f.celdas.map(
                  (celda, i) => html`<td data-label="${typeof columnas[i] === "string" ? columnas[i] : ""}"
                    class="al-${alinear[i]} ${i === 0 ? "principal" : ""} ${i === f.celdas.length - 1 ? "acciones" : ""}"
                    ${typeof celda === "string" || typeof celda === "number" ? html`title="${celda}"` : ""}>${celda}</td>`,
                )}
              </tr>`,
          )}
          ${!cargando && !filas.length ? html`<tr><td colspan="${COLUMNAS_SECCION}" class="vacio">${vacio}</td></tr>` : ""}
          ${cargando ? [1, 2, 3].map(() => html`<tr><td colspan="${COLUMNAS_SECCION}"><div class="esqueleto" style="height: 16px"></div></td></tr>`) : ""}
        </tbody>
      </table>
    </div>`;
}

/** Primera columna: el registro como enlace que abre su detalle. */
export const enlaceDetalle = ({ texto, id, avatar, mono }) => html`
  <button type="button" class="enlace-detalle ${mono ? "mono" : ""}" data-accion="detalle" data-id="${id}" title="Ver detalle">
    ${avatar ? html`<span class="adm__avatar adm__avatar--chico" aria-hidden="true">${avatar}</span>` : ""}
    <span class="enlace-detalle__texto">${texto}</span>
    ${icono("derecha", 15, { clase: "enlace-detalle__flecha" })}
  </button>`;

/** Insignia de estado de un solo dato. */
export const estadoInsignia = (tono, texto) => html`<span class="estado estado--${tono}">${texto}</span>`;

/** Botón de icono de una fila: data-accion + data-id. */
export const botonFila = ({ accion, id, ic, titulo, peligro = false, deshabilitado = false }) =>
  html`<button class="icono-btn ${peligro ? "icono-btn--peligro" : ""}" title="${titulo}" aria-label="${titulo}" data-accion="${accion}" data-id="${id}" ${deshabilitado ? "disabled" : ""}>${icono(ic, 17)}</button>`;

/** Paginador estándar. */
export function paginador({ pagina, totalPaginas, texto }) {
  if (!totalPaginas || totalPaginas <= 1) return "";
  return html`
    <footer class="paginador">
      <span class="tenue">${texto}</span>
      <div>
        <button class="icono-btn" data-accion="pagina" data-valor="-1" ${pagina <= 1 ? "disabled" : ""} aria-label="Página anterior">${icono("izquierda", 18)}</button>
        <button class="icono-btn" data-accion="pagina" data-valor="1" ${pagina >= totalPaginas ? "disabled" : ""} aria-label="Página siguiente">${icono("derecha", 18)}</button>
      </div>
    </footer>`;
}
