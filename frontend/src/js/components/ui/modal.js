/** Ventanas emergentes accesibles (Esc cierra, foco atrapado, fondo bloqueado). */
import { atraparFoco, crearElemento, html, pintar } from "../../utils/dom.js";
import { icono } from "./icon.js";
import { cargando } from "./cargando.js";

let abiertas = 0;

function montarVentana(elemento, caja, alCerrar, enfocarPrimero) {
  const anterior = document.activeElement;
  document.body.appendChild(elemento);
  abiertas += 1;
  document.body.style.overflow = "hidden";

  let cerrada = false;
  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    window.removeEventListener("keydown", tecla);
    elemento.remove();
    abiertas -= 1;
    if (!abiertas) document.body.style.overflow = "";
    anterior?.focus?.();
    alCerrar?.();
  }
  function tecla(e) {
    // Solo la ventana de más arriba responde.
    if (elemento !== document.body.lastElementChild && document.body.lastElementChild?.matches(".velo, .detalle-velo")) return;
    if (e.key === "Escape") cerrar();
    atraparFoco(caja, e);
  }
  window.addEventListener("keydown", tecla);
  elemento.addEventListener("pointerdown", (e) => {
    if (e.target === elemento) cerrar();
  });
  enfocarPrimero?.();
  return cerrar;
}

export function abrirModal({ titulo, descripcion = "", cuerpo = "", pie = "", ancho = 480, alCerrar }) {
  const velo = crearElemento(html`
    <div class="velo">
      <div class="ventana" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" style="width: min(${ancho}px, 100%)">
        <header class="modal__cabeza">
          <div>
            <h2 id="modal-titulo">${titulo}</h2>
            ${descripcion ? html`<p>${descripcion}</p>` : ""}
          </div>
          <button type="button" class="icono-btn modal__cerrar" data-cerrar aria-label="Cerrar">${icono("cerrar", 18)}</button>
        </header>
        <div class="modal__cuerpo"></div>
        <footer class="modal__pie"></footer>
      </div>
    </div>`);
  const caja = velo.querySelector(".ventana");
  const contenedorCuerpo = velo.querySelector(".modal__cuerpo");
  const contenedorPie = velo.querySelector(".modal__pie");
  pintar(contenedorCuerpo, cuerpo);
  if (pie) pintar(contenedorPie, pie);
  else contenedorPie.remove();

  const cerrar = montarVentana(velo, caja, alCerrar, () => {
    caja.querySelector("input, select, textarea, button:not(.modal__cerrar)")?.focus();
  });
  caja.addEventListener("click", (e) => {
    if (e.target.closest("[data-cerrar]")) cerrar();
  });
  return { caja, cuerpo: contenedorCuerpo, pie: contenedorPie, cerrar };
}

/** Confirmación para acciones importantes (eliminar, retirar, restablecer...). */
export function confirmar({ titulo, mensaje, textoConfirmar = "Confirmar", peligro = true, extra = "", alConfirmar }) {
  const pie = (ocupado) => html`
    ${extra}
    <button type="button" class="btn btn--suave" data-cerrar ${ocupado ? "disabled" : ""}>Cancelar</button>
    <button type="button" class="btn ${peligro ? "btn--peligro" : "btn--primario"}" data-confirmar ${ocupado ? "disabled" : ""}>
      ${ocupado ? cargando("Procesando…") : textoConfirmar}
    </button>`;
  const v = abrirModal({
    titulo,
    cuerpo: html`<p class="modal__texto">${mensaje}</p><div data-error></div>`,
    pie: pie(false),
  });
  v.pie.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-confirmar]")) return;
    pintar(v.pie, pie(true));
    try {
      await alConfirmar();
      v.cerrar();
    } catch (err) {
      pintar(v.pie, pie(false));
      pintar(v.cuerpo.querySelector("[data-error]"), html`<p class="alert alert-danger rv__error" role="alert">${icono("alerta", 16)} ${err.message}</p>`);
    }
  });
  return v;
}

/** Panel lateral de detalle: las tablas muestran lo esencial y aquí va todo. */
export function abrirDetalle({ titulo, subtitulo = "", insignia = "", cuerpo = "", acciones = "", alCerrar }) {
  const velo = crearElemento(html`
    <div class="detalle-velo">
      <aside class="detalle" role="dialog" aria-modal="true" aria-labelledby="detalle-titulo">
        <header class="detalle__cabeza">
          <div>
            <h2 id="detalle-titulo">${titulo}</h2>
            ${subtitulo ? html`<p>${subtitulo}</p>` : ""}
            ${insignia ? html`<div class="detalle__insignia">${insignia}</div>` : ""}
          </div>
          <button type="button" class="icono-btn detalle__cerrar" data-cerrar aria-label="Cerrar detalle">${icono("cerrar", 18)}</button>
        </header>
        <div class="detalle__cuerpo"></div>
        <footer class="detalle__pie"></footer>
      </aside>
    </div>`);
  const caja = velo.querySelector(".detalle");
  pintar(velo.querySelector(".detalle__cuerpo"), cuerpo);
  const pieDetalle = velo.querySelector(".detalle__pie");
  if (String(acciones).trim()) pintar(pieDetalle, acciones);
  else pieDetalle.remove();
  const cerrar = montarVentana(velo, caja, alCerrar, () => caja.querySelector(".detalle__cerrar")?.focus());
  caja.addEventListener("click", (e) => {
    if (e.target.closest("[data-cerrar]")) cerrar();
  });
  return { caja, cerrar };
}

/** Bloque de datos del detalle: [["Etiqueta", valor], ...]. */
export function datosDetalle(titulo, filas) {
  return html`
    <section class="detalle__bloque">
      ${titulo ? html`<h3>${titulo}</h3>` : ""}
      <dl class="detalle__datos">
        ${filas
          .filter(Boolean)
          .map(
            ([etiqueta, valor]) => html`<div><dt>${etiqueta}</dt><dd>${valor === null || valor === undefined || valor === "" ? html`<span class="tenue">—</span>` : valor}</dd></div>`,
          )}
      </dl>
    </section>`;
}

/** Mensaje de error estándar dentro de formularios. */
export const mensajeError = (texto) => (texto ? html`<p class="alert alert-danger rv__error" role="alert">${icono("alerta", 16)} ${texto}</p>` : "");
