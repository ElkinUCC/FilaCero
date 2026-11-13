/** Cambio obligatorio de la contraseña temporal. Ruta: #/cambiar-clave */
import { enlazarFormularioClave, estadoClaveInicial, formularioClaveHTML } from "../components/ui/cambiarClave.js";
import { html, pintar } from "../utils/dom.js";

export function CambioClavePage({ usuario }) {
  return html`
    <div class="clave-obligatoria">
      <div class="login">
        <span class="marca__logo" aria-hidden="true">F0</span>
        <h2>Crea tu contraseña</h2>
        <p>Hola ${usuario.nombre?.split(" ")[0]}. Ingresaste con una contraseña temporal; por seguridad debes cambiarla antes de continuar.</p>
        <div data-formulario></div>
        <button type="button" class="btn btn--fantasma-oscuro" data-salir>Salir</button>
      </div>
    </div>`;
}

export function mountCambioClavePage({ onUsuario, onSalir }) {
  const caja = document.querySelector("[data-formulario]");
  const estado = estadoClaveInicial();
  const repintar = () => pintar(caja, formularioClaveHTML(estado, true));
  repintar();
  enlazarFormularioClave(caja, estado, { repintar, alListo: onUsuario });
  document.querySelector("[data-salir]").addEventListener("click", onSalir);
}
