/** Acceso del personal (asesores, supervisores y administradores). */
import { login } from "../../api/auth.api.js";
import { isPersonal } from "../../auth/permissions.js";
import { saveSession } from "../../auth/session.service.js";
import { atraparFoco, crearElemento, html, pintar } from "../../utils/dom.js";
import { icono } from "../ui/icon.js";
import { mensajeError } from "../ui/modal.js";
import { cargando } from "../ui/cargando.js";

export function abrirLogin({ onIngresar, alCerrar }) {
  const e = { correo: "", password: "", ver: false, cargando: false, error: "" };
  const velo = crearElemento(html`<div class="velo" role="dialog" aria-modal="true" aria-labelledby="login-titulo"></div>`);

  const vista = () => html`
    <form class="login" novalidate>
      <button type="button" class="login__cerrar" data-cerrar aria-label="Cerrar">${icono("cerrar", 18)}</button>
      <span class="marca__logo" aria-hidden="true">F0</span>
      <h2 id="login-titulo">Acceso del personal</h2>
      <p>Para asesores, supervisores y administradores.</p>
      <label class="campo">
        ${icono("usuario", 17)}
        <input id="login-correo" type="email" value="${e.correo}" placeholder="Correo" autocomplete="username" aria-label="Correo" required />
      </label>
      <label class="campo campo--accion">
        ${icono("llave", 17)}
        <input id="login-clave" type="${e.ver ? "text" : "password"}" value="${e.password}" placeholder="Contraseña" autocomplete="current-password" aria-label="Contraseña" required />
        <button type="button" class="campo__boton" data-ver>${e.ver ? "Ocultar" : "Mostrar"}</button>
      </label>
      ${mensajeError(e.error)}
      <button class="btn btn--primario btn--ancho" ${e.cargando || !e.correo || !e.password ? "disabled" : ""}>
        ${e.cargando ? cargando("Ingresando…") : "Ingresar"}
      </button>
    </form>`;
  const repintar = () => pintar(velo, vista());

  function cerrar() {
    window.removeEventListener("keydown", tecla);
    velo.remove();
    alCerrar?.();
  }
  function tecla(ev) {
    if (ev.key === "Escape") cerrar();
    atraparFoco(velo, ev);
  }

  velo.addEventListener("pointerdown", (ev) => {
    if (ev.target === velo) cerrar();
  });
  velo.addEventListener("input", (ev) => {
    if (ev.target.id === "login-correo") e.correo = ev.target.value;
    if (ev.target.id === "login-clave") e.password = ev.target.value;
    repintar();
  });
  velo.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-cerrar]")) cerrar();
    if (ev.target.closest("[data-ver]")) {
      e.ver = !e.ver;
      repintar();
    }
  });
  velo.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (e.cargando || !e.correo || !e.password) return;
    e.cargando = true;
    e.error = "";
    repintar();
    try {
      const r = await login(e.correo.trim(), e.password);
      if (!isPersonal(r.usuario)) throw new Error("Este acceso es solo para el personal de FilaCero.");
      saveSession(r.access_token, r.usuario);
      cerrar();
      onIngresar(r.usuario);
    } catch (err) {
      e.error = err.message;
      e.password = "";
      e.cargando = false;
      repintar();
      velo.querySelector("#login-clave")?.focus();
    }
  });

  window.addEventListener("keydown", tecla);
  document.body.appendChild(velo);
  repintar();
  velo.querySelector("#login-correo").focus();
  return cerrar;
}
