/** Minichat de un reclamo o consulta. */
import { horaDe } from "../../utils/formatters.js";
import { html } from "../../utils/dom.js";
import { icono } from "./icon.js";

const ETIQUETA = { CLIENTE: "Cliente", ASESOR: "Asesor", ASISTENTE: "Asistente" };

export function chatHTML({ id, mensajes = [], inicial, yo, borrador = "", enviando = false, placeholder = "Escribe tu mensaje" }) {
  const lista = [...(inicial ? [{ id: "ini", ...inicial }] : []), ...mensajes];
  return html`
    <div class="chat">
      <ol class="chat__hilo" aria-live="polite">
        ${lista.map(
          (m) => html`
            <li class="chat__msg chat__msg--${m.autor === yo ? "yo" : String(m.autor).toLowerCase()}">
              <span class="chat__autor">
                ${m.autor === "ASISTENTE" ? icono("rayo", 12) : ""}
                ${m.autor_nombre || ETIQUETA[m.autor]}${m.fecha ? ` · ${horaDe(m.fecha)}` : ""}
              </span>
              <p>${m.texto}</p>
            </li>`,
        )}
      </ol>
      <form class="chat__form" data-chat="${id}">
        <input data-campo="chat-${id}" data-chat-texto="${id}" value="${borrador}" maxlength="600"
          placeholder="${placeholder}" aria-label="Mensaje" ${enviando ? "disabled" : ""} />
        <button type="submit" class="btn btn--primario btn--chico" aria-label="Enviar" ${enviando || borrador.trim().length < 2 ? "disabled" : ""}>
          ${icono("enviar", 16)}
        </button>
      </form>
    </div>`;
}

/** Lleva el hilo al último mensaje. */
export function bajarChat(contenedor) {
  contenedor.querySelectorAll(".chat__hilo").forEach((hilo) => {
    hilo.scrollTop = hilo.scrollHeight;
  });
}
