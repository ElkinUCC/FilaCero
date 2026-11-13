/**
 * Bandeja de reclamos de la sede. Los que llegan "en línea" se responden aquí
 * (minichat) y la respuesta la ve el ciudadano al consultar con su celular;
 * los "presenciales" además tienen un turno reservado.
 *
 *   montarReclamos(contenedor, { onPendientes }) -> función de limpieza
 */
import * as agenteApi from "../../api/agente.api.js";
import { html, pintar } from "../../utils/dom.js";
import { ESTADOS_RECLAMO, fechaHora, haceTiempo } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { bajarChat, chatHTML } from "../ui/chat.js";
import { icono } from "../ui/icon.js";
import { avisar } from "../ui/toast.js";

const FILTROS = [
  { id: "pendientes", texto: "Pendientes" },
  { id: "RESUELTO", texto: "Resueltos" },
  { id: "", texto: "Todos" },
];

export function montarReclamos(contenedor, { onPendientes } = {}) {
  const s = { filtro: "pendientes", abierto: null, ocupado: null, borradores: {}, enviando: null };
  let sondeo = null;
  let yaPintado = false;

  const lista = () =>
    (sondeo?.estado.datos?.reclamos || []).filter((r) => (s.filtro === "pendientes" ? r.estado !== "RESUELTO" : !s.filtro || r.estado === s.filtro));
  /** Al resolver, la respuesta oficial es lo último que escribió el asesor en el chat. */
  const ultimaDelAsesor = (r) => [...(r.mensajes || [])].reverse().find((m) => m.autor === "ASESOR")?.texto;

  function item(r) {
    const est = ESTADOS_RECLAMO[r.estado] || {};
    const abierto = s.abierto === r.id;
    return html`
      <article class="bandeja__item ${abierto ? "abierto" : ""}">
        <button type="button" class="bandeja__cabeza" data-accion="abrir" data-id="${r.id}" aria-expanded="${abierto}">
          <span class="bandeja__icono bandeja__icono--${est.tono}">${icono("mensaje", 18)}</span>
          <span class="bandeja__texto"><strong>${r.categoria_texto}</strong><small>${r.radicado} · ${r.cliente_nombre} · ${haceTiempo(r.fecha)}</small></span>
          ${r.sin_leer > 0 ? html`<span class="punto-nuevo" title="Mensajes nuevos del cliente">${r.sin_leer}</span>` : ""}
          ${r.presencial ? html`<span class="prep prep--llamado">En persona</span>` : ""}
          <span class="estado estado--${est.tono}">${est.texto}</span>
          ${icono("abajo", 16, { clase: abierto ? "girado" : "" })}
        </button>
        ${abierto
          ? html`
              <div class="bandeja__cuerpo">
                <dl class="detalle__datos">
                  <div><dt>Cliente</dt><dd>${r.cliente_nombre}</dd></div>
                  <div><dt>Celular</dt><dd>${r.cliente_celular}</dd></div>
                  <div><dt>Equipo</dt><dd>${r.equipo || "—"}</dd></div>
                  <div><dt>Radicado</dt><dd>${fechaHora(r.fecha)}</dd></div>
                </dl>
                ${chatHTML({
                  id: r.id,
                  yo: "ASESOR",
                  inicial: { autor: "CLIENTE", autor_nombre: r.cliente_nombre, texto: r.descripcion, fecha: r.fecha },
                  mensajes: r.mensajes || [],
                  borrador: s.borradores[r.id] || "",
                  enviando: s.enviando === r.id,
                  placeholder: "Responde al cliente (precio, fecha, qué traer)…",
                })}
                ${r.estado !== "RESUELTO"
                  ? html`
                      <div class="bandeja__acciones">
                        <button type="button" class="btn btn--suave" data-accion="gestion" data-id="${r.id}" ${s.ocupado === r.id ? "disabled" : ""}>Marcar en gestión</button>
                        <button type="button" class="btn btn--primario" data-accion="resolver" data-id="${r.id}" ${s.ocupado === r.id ? "disabled" : ""}>${icono("enviar", 15)} Marcar resuelto</button>
                      </div>`
                  : html`<p class="tenue">Resuelto por ${r.gestionado_por || "un asesor"} · ${fechaHora(r.fecha_respuesta)}</p>`}
              </div>`
          : ""}
      </article>`;
  }

  function render() {
    const datos = sondeo?.estado.datos;
    const error = sondeo?.estado.error;
    const items = lista();
    pintar(
      contenedor,
      html`
        <section class="taller ${yaPintado ? "repintado" : ""}" aria-label="Reclamos">
          <header class="taller__cabeza">
            <div>
              <h2>Reclamos de la sede</h2>
              <p>Reclamos y consultas de clientes. Tu última respuesta es la que el cliente ve en “Consultar mi turno”.</p>
            </div>
            <div class="segmentos" role="tablist" aria-label="Filtrar reclamos">
              ${FILTROS.map(
                (f) => html`<button role="tab" aria-selected="${s.filtro === f.id}" class="${s.filtro === f.id ? "activo" : ""}" data-accion="filtro" data-valor="${f.id}">
                  ${f.texto}${f.id === "pendientes" && datos ? html`<small>${datos.pendientes}</small>` : ""}</button>`,
              )}
            </div>
          </header>
          ${error ? html`<p class="ag__aviso">${icono("alerta", 16)} ${error}</p>` : ""}
          <div class="bandeja">
            ${datos ? "" : [1, 2, 3].map(() => html`<div class="esqueleto" style="height: 64px"></div>`)}
            ${datos && !items.length ? html`<p class="taller__vacio">No hay reclamos en esta vista.</p>` : ""}
            ${items.map(item)}
          </div>
        </section>`,
    );
    yaPintado = true;
    bajarChat(contenedor);
  }

  async function gestionar(id, estado) {
    const r = sondeo.estado.datos.reclamos.find((x) => x.id === id);
    s.ocupado = id;
    render();
    try {
      const res = await agenteApi.gestionarReclamo(id, estado, estado === "RESUELTO" ? ultimaDelAsesor(r) || r.respuesta || "Caso resuelto por el chat." : undefined);
      avisar(res.mensaje);
      if (estado === "RESUELTO") s.abierto = null;
    } catch (e) {
      avisar(e.message, "error");
    }
    s.ocupado = null;
    sondeo.refrescar();
  }

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    const id = Number(b.dataset.id);
    if (b.dataset.accion === "filtro") s.filtro = b.dataset.valor;
    else if (b.dataset.accion === "abrir") {
      const abrir = s.abierto !== id;
      s.abierto = abrir ? id : null;
      const r = sondeo.estado.datos.reclamos.find((x) => x.id === id);
      if (abrir && r?.sin_leer) agenteApi.leerReclamo(id).then(sondeo.refrescar).catch(() => {});
    } else if (b.dataset.accion === "gestion") return gestionar(id, "EN_GESTION");
    else if (b.dataset.accion === "resolver") return gestionar(id, "RESUELTO");
    render();
  });
  contenedor.addEventListener("input", (e) => {
    const id = e.target.dataset.chatTexto;
    if (!id) return;
    s.borradores[id] = e.target.value;
    render();
  });
  contenedor.addEventListener("submit", async (e) => {
    const id = e.target.dataset.chat;
    if (!id) return;
    e.preventDefault();
    const texto = (s.borradores[id] || "").trim();
    if (texto.length < 2 || s.enviando) return;
    s.enviando = Number(id);
    render();
    try {
      await agenteApi.escribirReclamo(id, texto);
      s.borradores[id] = "";
    } catch (err) {
      avisar(err.message, "error");
    }
    s.enviando = null;
    await sondeo.refrescar();
    contenedor.querySelector(`[data-chat-texto="${id}"]`)?.focus();
  });

  sondeo = crearSondeo(async () => {
    const r = await agenteApi.bandejaReclamos();
    onPendientes?.(r.pendientes);
    return r;
  }, 15000, render);
  render();
  return () => sondeo.detener();
}
