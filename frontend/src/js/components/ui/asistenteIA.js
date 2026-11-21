/** Asistente FilaCero IA: botón flotante + panel de conversación. */
import { preguntarAsistente, sugerenciasAsistente } from "../../api/asistente.api.js";
import { crudo, esc, html, pintar } from "../../utils/dom.js";
import { icono } from "./icon.js";

const ICONO_ACCION = { llamar: "megafono", preparar: "paquete", navegar: "externo", seccion: "mensaje" };
/** Conversaciones por asistente (sobreviven al cambiar de sección). */
const conversaciones = {};

/** Negrita (**texto**) y viñetas ("- "): todo el texto se escapa antes. */
function textoEnriquecido(texto) {
  const negritas = (linea) => esc(linea).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return String(texto || "")
    .split(/\n{2,}/)
    .map((bloque) => {
      const lineas = bloque.split("\n");
      const vinetas = lineas.filter((l) => l.trim().startsWith("- "));
      const normales = lineas.filter((l) => !l.trim().startsWith("- "));
      return crudo(
        `<div class="ia__bloque">${normales.length ? `<p>${normales.map(negritas).join(" ")}</p>` : ""}${
          vinetas.length ? `<ul>${vinetas.map((l) => `<li>${negritas(l.trim().slice(2))}</li>`).join("")}</ul>` : ""
        }</div>`,
      );
    });
}

export function montarAsistenteIA(contenedor, { titulo = "FilaCero IA", subtitulo = "", onAccion } = {}) {
  const s = (conversaciones[titulo] ||= { mensajes: [], iniciales: [], modo: "local" });
  const vista = { abierto: false, texto: "", pensando: false, escuchando: false, subtitulo, vistos: s.mensajes.length };
  const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;
  let reconocimiento = null;

  contenedor.innerHTML = String(html`
    <button type="button" class="ia-fab" data-ia="abrir" aria-haspopup="dialog" aria-expanded="false" title="Abrir ${titulo}">
      <span class="ia-fab__icono">${icono("chispa", 20)}</span>
      <span class="ia-fab__texto">${titulo}</span>
    </button>
    <div class="ia-sombra" data-ia="cerrar" aria-hidden="true" hidden></div>
    <section class="ia" role="dialog" aria-modal="false" aria-label="${titulo}" aria-hidden="true" inert>
      <header class="ia__cabeza" data-cabeza></header>
      <div class="ia__hilo" data-hilo aria-live="polite"></div>
      <div data-sugerencias></div>
      <form class="ia__form" data-form></form>
    </section>`);
  const fab = contenedor.querySelector(".ia-fab");
  const sombra = contenedor.querySelector(".ia-sombra");
  const panel = contenedor.querySelector(".ia");
  const hilo = panel.querySelector("[data-hilo]");

  function cabeza() {
    return html`
      <span class="ia__avatar">${icono("chispa", 20)}</span>
      <div class="ia__titulo">
        <strong>${titulo}</strong>
        <small>
          <i class="ia__punto ${vista.pensando ? "ia__punto--activo" : ""}"></i>
          ${vista.pensando ? "Analizando tus datos…" : vista.subtitulo || (s.modo === "ia" ? "Conectado a Claude · datos en tiempo real" : "Datos en tiempo real de tu operación")}
        </small>
      </div>
      ${s.mensajes.length ? html`<button type="button" class="ia__icono" data-ia="nueva" title="Nueva conversación" aria-label="Nueva conversación">${icono("borrar", 17)}</button>` : ""}
      <button type="button" class="ia__icono" data-ia="cerrar" aria-label="Cerrar asistente">${icono("cerrar", 18)}</button>`;
  }

  function mensajes() {
    return html`
      ${s.mensajes.length
        ? ""
        : html`
            <div class="ia__bienvenida">
              <span class="ia__bienvenida-icono">${icono("chispa", 26)}</span>
              <h2>¿En qué te ayudo?</h2>
              <p>Pregúntame en tus palabras. Respondo con los datos reales de turnos, sedes, equipos y reclamos, y te sugiero qué hacer.</p>
            </div>`}
      ${s.mensajes.map(
        (m, i) => html`
          <article class="ia__msg ia__msg--${m.rol} ${m.error ? "ia__msg--error" : ""} ${i < vista.vistos ? "ia__msg--visto" : ""}">
            ${m.rol === "asistente" ? html`<span class="ia__msg-avatar" aria-hidden="true">${icono("chispa", 13)}</span>` : ""}
            <div class="ia__burbuja">
              ${m.rol === "asistente" ? textoEnriquecido(m.texto) : html`<p>${m.texto}</p>`}
              ${m.tarjetas?.length
                ? html`<div class="ia__tarjetas">${m.tarjetas.map((t) => html`<div class="ia__tarjeta ia__tarjeta--${t.tono}"><small>${t.etiqueta}</small><strong>${t.valor}</strong></div>`)}</div>`
                : ""}
              ${m.acciones?.length && onAccion
                ? html`<div class="ia__acciones">${m.acciones.map(
                    (a, k) => html`<button type="button" class="btn btn--primario btn--chico" data-ia="accion" data-msg="${i}" data-indice="${k}">${icono(ICONO_ACCION[a.tipo] || "derecha", 15)} ${a.texto}</button>`,
                  )}</div>`
                : ""}
              ${m.fuente ? html`<span class="ia__fuente">${m.fuente === "ia" ? "Redactado por Claude con tus datos" : "Calculado con tus datos en tiempo real"}</span>` : ""}
            </div>
          </article>`,
      )}
      ${vista.pensando
        ? html`
            <article class="ia__msg ia__msg--asistente">
              <span class="ia__msg-avatar" aria-hidden="true">${icono("chispa", 13)}</span>
              <div class="ia__burbuja ia__escribiendo" aria-label="El asistente está escribiendo"><i></i><i></i><i></i></div>
            </article>`
        : ""}`;
  }

  function sugerencias() {
    const ultimo = [...s.mensajes].reverse().find((m) => m.rol === "asistente" && !m.error);
    const lista = ultimo?.sugerencias?.length ? ultimo.sugerencias : s.iniciales;
    if (!lista.length || vista.pensando) return "";
    return html`<div class="ia__sugerencias" aria-label="Preguntas sugeridas">${lista.slice(0, 4).map((q) => html`<button type="button" data-ia="sugerencia" data-texto="${q}">${q}</button>`)}</div>`;
  }

  function formulario() {
    return html`
      <input id="ia-pregunta-${titulo.replace(/\W/g, "")}" data-ia-texto value="${vista.texto}" maxlength="500"
        placeholder="${vista.escuchando ? "Te escucho…" : "Escribe tu pregunta…"}" aria-label="Pregunta para el asistente" ${vista.pensando ? "disabled" : ""} />
      ${Reconocedor
        ? html`<button type="button" class="ia__icono ia__mic ${vista.escuchando ? "ia__mic--on" : ""}" data-ia="dictar" aria-pressed="${vista.escuchando}"
            aria-label="${vista.escuchando ? "Detener dictado" : "Dictar pregunta"}" title="Dictar por voz">${icono("microfono", 18)}</button>`
        : ""}
      <button type="submit" class="ia__enviar" ${vista.pensando || vista.texto.trim().length < 2 ? "disabled" : ""} aria-label="Enviar pregunta">${icono("enviar", 17)}</button>`;
  }

  function render({ hiloTambien = true } = {}) {
    fab.classList.toggle("ia-fab--oculto", vista.abierto);
    fab.setAttribute("aria-expanded", vista.abierto);
    sombra.hidden = !vista.abierto;
    panel.classList.toggle("ia--abierto", vista.abierto);
    panel.setAttribute("aria-hidden", !vista.abierto);
    panel.inert = !vista.abierto;
    pintar(panel.querySelector("[data-cabeza]"), cabeza());
    if (hiloTambien) {
      pintar(hilo, mensajes());
      vista.vistos = s.mensajes.length;
      hilo.scrollTo({ top: hilo.scrollHeight, behavior: "smooth" });
    }
    pintar(panel.querySelector("[data-sugerencias]"), sugerencias());
    pintar(panel.querySelector("[data-form]"), formulario());
  }

  async function preguntar(pregunta) {
    const q = String(pregunta || "").trim();
    if (q.length < 2 || vista.pensando) return;
    vista.texto = "";
    const historial = s.mensajes.slice(-6).map((m) => ({ rol: m.rol, texto: m.texto }));
    s.mensajes.push({ rol: "usuario", texto: q });
    vista.pensando = true;
    render();
    try {
      const r = await preguntarAsistente(q, historial);
      s.mensajes.push({ rol: "asistente", ...r, texto: r.respuesta });
      if (r.fuente === "ia") s.modo = "ia";
    } catch (e) {
      s.mensajes.push({ rol: "asistente", error: true, texto: e.message || "No pude responder ahora. Intenta de nuevo." });
    }
    vista.pensando = false;
    render();
    panel.querySelector("[data-ia-texto]")?.focus();
  }

  function abrir() {
    vista.abierto = true;
    render();
    window.setTimeout(() => panel.querySelector("[data-ia-texto]")?.focus(), 120);
    if (!s.iniciales.length) {
      sugerenciasAsistente()
        .then((r) => {
          s.iniciales = r.sugerencias || [];
          s.modo = r.modo || "local";
          render({ hiloTambien: false });
        })
        .catch(() => {});
    }
  }
  function cerrar() {
    vista.abierto = false;
    render({ hiloTambien: false });
    fab.focus();
  }

  function dictar() {
    if (!Reconocedor) return;
    if (vista.escuchando) {
      reconocimiento?.stop();
      return;
    }
    reconocimiento = new Reconocedor();
    reconocimiento.lang = "es-CO";
    reconocimiento.interimResults = false;
    reconocimiento.onresult = (e) => {
      const dicho = e.results?.[0]?.[0]?.transcript || "";
      if (dicho) preguntar(dicho);
    };
    reconocimiento.onend = reconocimiento.onerror = () => {
      vista.escuchando = false;
      render({ hiloTambien: false });
    };
    vista.escuchando = true;
    render({ hiloTambien: false });
    reconocimiento.start();
  }

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ia]");
    if (!b) return;
    const accion = b.dataset.ia;
    if (accion === "abrir") abrir();
    else if (accion === "cerrar") cerrar();
    else if (accion === "nueva") {
      s.mensajes = [];
      render();
    } else if (accion === "sugerencia") preguntar(b.dataset.texto);
    else if (accion === "dictar") dictar();
    else if (accion === "accion") {
      const a = s.mensajes[Number(b.dataset.msg)].acciones[Number(b.dataset.indice)];
      onAccion?.(a);
      if (a.tipo !== "llamar") cerrar();
    }
  });
  contenedor.addEventListener("input", (e) => {
    if (!e.target.matches("[data-ia-texto]")) return;
    vista.texto = e.target.value;
    pintar(panel.querySelector("[data-form]"), formulario());
  });
  contenedor.addEventListener("submit", (e) => {
    e.preventDefault();
    preguntar(vista.texto);
  });
  const tecla = (e) => {
    if (e.key === "Escape" && vista.abierto) cerrar();
  };
  window.addEventListener("keydown", tecla);

  render();
  return {
    /** Cambia el subtítulo (p. ej. la sede del asesor) sin cerrar el panel. */
    subtitulo(texto) {
      if (vista.subtitulo === texto) return;
      vista.subtitulo = texto;
      pintar(panel.querySelector("[data-cabeza]"), cabeza());
    },
    destruir() {
      window.removeEventListener("keydown", tecla);
      reconocimiento?.stop();
    },
  };
}
