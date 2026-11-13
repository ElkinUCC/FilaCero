/**
 * Taller de la sede: los equipos de los clientes avanzan por columnas. Cuando
 * un equipo queda "Listo", el cliente lo ve al consultar con su celular y puede
 * reservar la entrega eligiendo ese equipo.
 *
 *   montarEquipos(contenedor) -> función de limpieza
 */
import * as agenteApi from "../../api/agente.api.js";
import { html, pintar } from "../../utils/dom.js";
import { ESTADOS_EQUIPO, fechaHora, haceTiempo } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { icono } from "../ui/icon.js";
import { abrirModal } from "../ui/modal.js";
import { avisar } from "../ui/toast.js";
import { abrirFormularioEquipo } from "./formularioEquipo.js";
import { abrirVerificarCedula } from "./verificarCedula.js";

/** Pasos que exigen la cédula del titular (entregar o recibir en sede). */
const CON_CEDULA = ["ENTREGADO", "RECIBIDO"];
/** Columnas del tablero del taller (de izquierda a derecha avanza el equipo). */
const COLUMNAS = [
  { id: "RECIBIR", titulo: "Por revisar", estados: ["POR_RECIBIR", "RECIBIDO"] },
  { id: "EN_REPARACION", titulo: "En reparación", estados: ["EN_REPARACION"] },
  { id: "LISTO", titulo: "Listos para entregar", estados: ["LISTO"] },
  { id: "ENTREGADO", titulo: "Entregados", estados: ["ENTREGADO"] },
];
const SIGUIENTE = {
  POR_RECIBIR: ["RECIBIDO", "Recibir"],
  RECIBIDO: ["EN_REPARACION", "A reparación"],
  EN_REPARACION: ["LISTO", "Marcar listo"],
  LISTO: ["ENTREGADO", "Entregar"],
};

export function montarEquipos(contenedor) {
  const s = { buscar: "", moviendo: null, movidos: new Set() };
  let sondeo = null;

  function filtrados() {
    const f = s.buscar.trim().toLowerCase();
    const digitos = f.replace(/\D/g, "");
    return (sondeo?.estado.datos?.equipos || []).filter(
      (e) =>
        !f ||
        `${e.codigo} ${e.marca} ${e.modelo || ""} ${e.cliente_nombre} ${e.cliente_celular} ${e.serial || ""}`.toLowerCase().includes(f) ||
        (digitos.length >= 4 && (e.cliente_documento || "").endsWith(digitos.slice(-4))),
    );
  }

  function tablero() {
    const datos = sondeo?.estado.datos;
    const equipos = filtrados();
    return COLUMNAS.map((c) => {
      const items = equipos.filter((e) => c.estados.includes(e.estado));
      const visibles = c.id === "ENTREGADO" ? items.slice(0, 8) : items;
      return html`
        <div class="taller__col taller__col--${c.id.toLowerCase()}">
          <h3>${c.titulo}<small>${items.length}</small></h3>
          <div class="taller__lista">
            ${datos ? "" : [1, 2].map(() => html`<div class="esqueleto" style="height: 96px"></div>`)}
            ${visibles.map((e) => {
              const sig = SIGUIENTE[e.estado];
              return html`
                <article class="taller__tarjeta ${s.movidos.has(e.id) ? "taller__tarjeta--movida" : ""}">
                  <button type="button" class="taller__abrir" data-accion="detalle" data-id="${e.id}">
                    <span class="taller__marca">${icono("tv", 15)} ${e.marca} ${e.modelo}</span>
                    <strong>${e.cliente_nombre}</strong>
                    <small><span class="mono">${e.codigo}</span> · ${haceTiempo(e.fecha_actualizacion)}</small>
                    ${e.falla ? html`<small class="taller__falla">${e.falla}</small>` : ""}
                    ${e.origen === "GARANTIA" ? html`<span class="prep prep--llamado">Garantía</span>` : ""}
                    ${e.estado === "POR_RECIBIR" ? html`<span class="prep prep--espera">El cliente lo trae</span>` : ""}
                  </button>
                  ${sig
                    ? html`<button type="button" class="taller__avanzar" data-accion="avanzar" data-id="${e.id}" ${s.moviendo === e.id ? "disabled" : ""}>${sig[1]} ${icono("derecha", 14)}</button>`
                    : ""}
                </article>`;
            })}
            ${datos && !items.length ? html`<p class="taller__vacio">Sin equipos</p>` : ""}
          </div>
        </div>`;
    });
  }

  function render() {
    const error = sondeo?.estado.error;
    pintar(contenedor.querySelector("[data-tablero]"), html`${tablero()}`);
    pintar(contenedor.querySelector("[data-error]"), error ? html`<p class="ag__aviso">${icono("alerta", 16)} ${error}</p>` : "");
    s.movidos.clear();
  }

  /** Mueve un equipo a otro estado (optimista: la tarjeta salta de columna de inmediato). */
  async function mover(equipo, estado, nota, alTerminar) {
    if (CON_CEDULA.includes(estado) && equipo.estado !== estado) {
      abrirVerificarCedula({
        equipo,
        estado,
        alListo: (r) => {
          avisar(r.mensaje);
          alTerminar?.();
          sondeo.refrescar();
        },
      });
      return;
    }
    s.moviendo = equipo.id;
    s.movidos.add(equipo.id);
    const d = sondeo.estado.datos;
    sondeo.poner({ ...d, equipos: d.equipos.map((x) => (x.id === equipo.id ? { ...x, estado } : x)) });
    try {
      const r = await agenteApi.cambiarEstadoEquipo(equipo.id, estado, nota);
      avisar(r.mensaje);
      alTerminar?.();
    } catch (e) {
      avisar(e.message, "error");
    }
    s.moviendo = null;
    sondeo.refrescar();
  }

  function abrirDetalle(e) {
    const est = ESTADOS_EQUIPO[e.estado] || {};
    const sig = SIGUIENTE[e.estado];
    let nota = e.nota || "";
    const v = abrirModal({
      titulo: `${e.cliente_nombre} · ${e.marca} ${e.modelo || ""}`,
      descripcion: `Equipo ${e.codigo} · celular ${e.cliente_celular}${e.cliente_documento ? ` · cédula ${e.cliente_documento}` : ""}`,
      ancho: 560,
      cuerpo: html`
        <div class="formulario">
          <ol class="etapas etapas--equipo">
            ${["Recibido", "En reparación", "Listo", "Entregado"].map(
              (p, i) => html`
                <li class="etapas__paso ${est.paso > i + 1 ? "etapas__paso--hecho" : ""} ${est.paso === i + 1 ? "etapas__paso--actual" : ""}">
                  <span class="etapas__icono">${icono(est.paso > i + 1 ? "check" : "tv", 14)}</span>
                  <span class="etapas__texto">${p}</span>
                </li>`,
            )}
          </ol>
          <dl class="detalle__datos">
            <div><dt>Falla</dt><dd>${e.falla || "—"}</dd></div>
            <div><dt>Serial</dt><dd>${e.serial || "—"}</dd></div>
            <div><dt>Ingreso</dt><dd>${e.origen_texto}${e.fecha_compra ? ` · compra ${e.fecha_compra}` : ""}</dd></div>
            <div><dt>Recibió</dt><dd>${e.registrado_por || "Registro del cliente"}</dd></div>
            <div><dt>Registrado</dt><dd>${fechaHora(e.fecha_registro)}</dd></div>
            <div><dt>Última novedad</dt><dd>${fechaHora(e.fecha_actualizacion)}</dd></div>
          </dl>
          <label>
            <span class="etiqueta">Nota para el cliente</span>
            <span class="campo"><textarea id="eq-nota-detalle" rows="2" maxlength="300" placeholder="Ej. Se cambia la fuente de poder; queda listo mañana.">${nota}</textarea></span>
            <small class="formulario__ayuda">El cliente la ve al consultar con su celular.</small>
          </label>
        </div>`,
      pie: html`
        <button type="button" class="btn btn--suave" data-guardar-nota>Guardar nota</button>
        ${sig ? html`<button type="button" class="btn btn--primario" data-avanzar>${CON_CEDULA.includes(sig[0]) ? icono("escudo2", 15) : ""} ${sig[1]}</button>` : ""}`,
    });
    v.caja.addEventListener("input", (ev) => {
      if (ev.target.id === "eq-nota-detalle") nota = ev.target.value;
    });
    v.caja.addEventListener("click", (ev) => {
      if (ev.target.closest("[data-guardar-nota]")) mover(e, e.estado, nota, v.cerrar);
      if (ev.target.closest("[data-avanzar]")) mover(e, sig[0], nota, v.cerrar);
    });
  }

  pintar(
    contenedor,
    html`
      <section class="taller" aria-label="Equipos de clientes">
        <header class="taller__cabeza">
          <div>
            <h2>Equipos de clientes</h2>
            <p>Lo que los clientes dejan en la sede. Al marcarlo listo, el cliente puede reservar su entrega.</p>
          </div>
          <div class="taller__acciones">
            <label class="campo campo--buscar">
              ${icono("buscar", 16)}
              <input id="eq-buscar" placeholder="Cliente, celular, cédula, marca o EQ-" aria-label="Buscar equipo" />
            </label>
            <button type="button" class="btn btn--primario" data-accion="nuevo">${icono("mas", 17)} Recibir equipo</button>
          </div>
        </header>
        <div data-error></div>
        <div class="taller__tablero" data-tablero></div>
      </section>`,
  );

  const buscarEquipo = (id) => sondeo.estado.datos?.equipos.find((x) => String(x.id) === String(id));
  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    if (b.dataset.accion === "nuevo") {
      abrirFormularioEquipo({
        alGuardado: (r) => {
          avisar(r.mensaje);
          sondeo.refrescar();
        },
      });
    } else if (b.dataset.accion === "detalle") abrirDetalle(buscarEquipo(b.dataset.id));
    else if (b.dataset.accion === "avanzar") {
      const eq = buscarEquipo(b.dataset.id);
      mover(eq, SIGUIENTE[eq.estado][0]);
    }
  });
  contenedor.addEventListener("input", (e) => {
    if (e.target.id !== "eq-buscar") return;
    s.buscar = e.target.value;
    render();
  });

  sondeo = crearSondeo(() => agenteApi.listarEquipos(), 15000, render);
  render();
  return () => sondeo.detener();
}
