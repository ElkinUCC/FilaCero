/**
 * Cambio de contraseña del personal.
 *   formularioClaveHTML(estado, obligatorio) -> formulario
 *   enlazarFormularioClave(contenedor, estado, { obligatorio, alListo, repintar })
 *   abrirCambiarMiClave({ alListo })  -> ventana desde el menú del usuario
 */
import { cambiarClave } from "../../api/auth.api.js";
import { getToken, saveSession } from "../../auth/session.service.js";
import { html, pintar } from "../../utils/dom.js";
import { icono } from "./icon.js";
import { abrirModal, mensajeError } from "./modal.js";

const REGLAS = [
  { texto: "8 caracteres o más", ok: (c) => c.length >= 8 },
  { texto: "Letras y números", ok: (c) => /[a-z]/i.test(c) && /\d/.test(c) },
];

export const estadoClaveInicial = () => ({ actual: "", nueva: "", confirmar: "", ver: false, guardando: false, error: "" });

const esValida = (e) => REGLAS.every((r) => r.ok(e.nueva)) && e.nueva === e.confirmar && e.actual;

export function formularioClaveHTML(e, obligatorio) {
  const tipo = e.ver ? "text" : "password";
  return html`
    <form id="form-clave" class="formulario">
      <label>
        <span class="etiqueta">${obligatorio ? "Contraseña temporal" : "Contraseña actual"}</span>
        <span class="campo">${icono("llave", 17)}<input id="clave-actual" data-clave="actual" type="${tipo}" value="${e.actual}" autocomplete="current-password" /></span>
      </label>
      <label>
        <span class="etiqueta">Nueva contraseña</span>
        <span class="campo campo--accion">
          ${icono("escudo", 17)}
          <input id="clave-nueva" data-clave="nueva" type="${tipo}" value="${e.nueva}" autocomplete="new-password" />
          <button type="button" class="campo__boton" data-ver-clave>${e.ver ? "Ocultar" : "Mostrar"}</button>
        </span>
      </label>
      <label>
        <span class="etiqueta">Repite la nueva contraseña</span>
        <span class="campo">${icono("escudo", 17)}<input id="clave-confirmar" data-clave="confirmar" type="${tipo}" value="${e.confirmar}" autocomplete="new-password" /></span>
      </label>
      <ul class="reglas">
        ${REGLAS.map((r) => html`<li class="${r.ok(e.nueva) ? "ok" : ""}">${icono("check", 14)} ${r.texto}</li>`)}
        <li class="${e.nueva && e.nueva === e.confirmar ? "ok" : ""}">${icono("check", 14)} Ambas coinciden</li>
      </ul>
      ${mensajeError(e.error)}
      ${obligatorio
        ? html`<button class="btn btn--primario btn--ancho" ${!esValida(e) || e.guardando ? "disabled" : ""}>${e.guardando ? "Guardando…" : "Guardar y continuar"}</button>`
        : ""}
    </form>`;
}

/** Enlaza el formulario. repintar() vuelve a dibujarlo con el estado actual. */
export function enlazarFormularioClave(contenedor, e, { alListo, repintar }) {
  contenedor.addEventListener("input", (ev) => {
    const campo = ev.target.dataset.clave;
    if (!campo) return;
    e[campo] = ev.target.value;
    repintar();
  });
  contenedor.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-ver-clave]")) {
      e.ver = !e.ver;
      repintar();
    }
  });
  contenedor.addEventListener("submit", async (ev) => {
    if (ev.target.id !== "form-clave") return;
    ev.preventDefault();
    if (!esValida(e) || e.guardando) return;
    e.guardando = true;
    e.error = "";
    repintar();
    try {
      const r = await cambiarClave(e.actual, e.nueva);
      // El servidor revoca las sesiones anteriores y entrega un token nuevo.
      saveSession(r.access_token || getToken(), r.usuario);
      alListo(r.usuario);
    } catch (err) {
      e.error = err.message;
      e.guardando = false;
      repintar();
    }
  });
}

/** Ventana "Cambiar mi contraseña" desde el menú del usuario. */
export function abrirCambiarMiClave({ alListo }) {
  const e = estadoClaveInicial();
  const v = abrirModal({
    titulo: "Cambiar mi contraseña",
    ancho: 440,
    pie: html`
      <button type="button" class="btn btn--suave" data-cerrar>Cancelar</button>
      <button type="submit" form="form-clave" class="btn btn--primario">Guardar contraseña</button>`,
  });
  const repintar = () => pintar(v.cuerpo, formularioClaveHTML(e, false));
  repintar();
  enlazarFormularioClave(v.caja, e, {
    repintar,
    alListo: (u) => {
      v.cerrar();
      alListo?.(u);
    },
  });
}
