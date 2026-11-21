/** Historial de turnos con filtros */
import * as adminApi from "../../api/admin.api.js";
import { listarSedes } from "../../api/catalogo.api.js";
import { html, pintarSiCambia } from "../../utils/dom.js";
import { duracion, ESTADOS, fechaCorta, fechaHora, fechaLarga, horaDe, PREPARACION, valorRespuesta } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { encabezado, marcarEnVivo } from "../layout/encabezado.js";
import { icono } from "../ui/icon.js";
import { abrirDetalle, datosDetalle } from "../ui/modal.js";
import { botonFila, enlaceDetalle, estadoInsignia, paginador, tablaSeccion } from "./tablaSeccion.js";

const POR_PAGINA = 15;

/** ¿La atención empezó dentro de la franja reservada? */
function puntual(t) {
  if (!t.fecha_inicio) return null;
  return horaDe(t.fecha_inicio) <= t.hora_fin;
}

function verDetalle(t) {
  const e = ESTADOS[t.estado] || {};
  const p = puntual(t);
  const seg = t.fecha_inicio && t.fecha_fin ? (new Date(t.fecha_fin) - new Date(t.fecha_inicio)) / 1000 : null;
  const prep = t.preparacion ? PREPARACION[t.preparacion.estado] : null;
  abrirDetalle({
    titulo: `Turno ${t.codigo}`,
    subtitulo: `${t.punto_nombre} · ${t.tramite_nombre}`,
    insignia: html`${estadoInsignia(e.tono, e.texto)}${prep ? estadoInsignia(prep.tono, prep.texto) : ""}`,
    cuerpo: html`
      ${datosDetalle("Ciudadano", [["Nombre", t.usuario_nombre], ["Celular", t.usuario_celular]])}
      ${datosDetalle("Cita", [
        ["Fecha", fechaLarga(t.fecha)],
        ["Franja reservada", `${t.hora_inicio}–${t.hora_fin}`],
        ["Sede", t.punto_nombre],
        ["Reservó", fechaHora(t.hora_solicitud)],
      ])}
      ${datosDetalle("Atención", [
        ["Atendió", t.agente_nombre],
        ["Módulo", t.agente_modulo],
        ["Llamado", t.fecha_llamado ? horaDe(t.fecha_llamado) : null],
        ["Inicio", t.fecha_inicio ? horaDe(t.fecha_inicio) : null],
        ["Fin", t.fecha_fin ? horaDe(t.fecha_fin) : null],
        ["Duración", seg != null ? html`<span class="${seg > 600 ? "texto-rojo" : ""}">${duracion(seg)}</span>` : null],
        ["Dentro de su franja", p == null ? null : p ? html`<span class="marca-ok">${icono("check", 14)} Cumplida</span>` : html`<span class="texto-rojo">Tarde</span>`],
      ])}
      ${t.respuestas_solicitud?.length || t.detalle_necesidad
        ? datosDetalle("Lo que pidió al reservar", [
            ...(t.respuestas_solicitud || []).map((r) => [r.etiqueta, valorRespuesta(r.valor)]),
            t.detalle_necesidad && ["Necesidad", t.detalle_necesidad],
          ])
        : ""}
      ${t.preparacion
        ? html`
            <section class="detalle__bloque">
              <h3>Preparación previa</h3>
              <p class="detalle__texto"><strong>${prep?.texto}</strong>${t.preparacion.preparado_por ? ` · ${t.preparacion.preparado_por}` : ""}${t.preparacion.fecha ? ` · ${fechaHora(t.preparacion.fecha)}` : ""}${t.preparacion.nota ? `\n${t.preparacion.nota}` : ""}</p>
            </section>`
        : ""}`,
  });
}

export function montarHistorial(contenedor, { titulo }) {
  const s = { filtros: { estado: "", punto_id: "", desde: "", hasta: "" }, buscar: "", pagina: 1, sedes: [] };
  let sondeo = null;
  let espera = null;

  const turnos = () => sondeo?.estado.datos?.turnos || [];
  const hayFiltros = () => s.buscar || Object.values(s.filtros).some(Boolean);

  function selectores() {
    return html`
      <span class="campo campo--select campo--compacto">
        <select data-filtro="estado" aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          ${Object.entries(ESTADOS).map(([k, v]) => html`<option value="${k}" ${s.filtros.estado === k ? "selected" : ""}>${v.texto}</option>`)}
        </select>
      </span>
      <span class="campo campo--select campo--compacto">
        <select data-filtro="punto_id" aria-label="Filtrar por sede">
          <option value="">Todas las sedes</option>
          ${s.sedes.map((x) => html`<option value="${x.id}" ${String(s.filtros.punto_id) === String(x.id) ? "selected" : ""}>${x.nombre}</option>`)}
        </select>
      </span>
      <label class="campo campo--fecha" title="Desde"><input type="date" data-filtro="desde" value="${s.filtros.desde}" aria-label="Desde" /></label>
      <label class="campo campo--fecha" title="Hasta"><input type="date" data-filtro="hasta" value="${s.filtros.hasta}" aria-label="Hasta" /></label>
      ${hayFiltros() ? html`<button class="btn btn--suave btn--chico" data-accion="limpiar">Limpiar</button>` : ""}`;
  }

  function render() {
    const { datos, error, actualizado } = sondeo.estado;
    marcarEnVivo(contenedor, { actualizado, error });
    pintarSiCambia(contenedor.querySelector("[data-selectores]"), selectores());
    const filas = turnos().map((t) => {
      const e = ESTADOS[t.estado] || {};
      return {
        id: t.id,
        celdas: [
          enlaceDetalle({ texto: t.codigo.slice(-6), id: t.id, mono: true }),
          t.usuario_nombre,
          t.tramite_nombre,
          `${fechaCorta(t.fecha)} · ${t.hora_inicio}`,
          estadoInsignia(e.tono, e.texto),
          botonFila({ accion: "detalle", id: t.id, ic: "ver", titulo: `Ver detalle del turno ${t.codigo}` }),
        ],
      };
    });
    pintarSiCambia(
      contenedor.querySelector("[data-tabla]"),
      html`
        ${tablaSeccion({
          etiqueta: titulo,
          columnas: ["Turno", "Ciudadano", "Trámite", "Cita", "Estado", ""],
          anchos: [14, 26, 22, 16, 12, 10],
          filas,
          cargando: !datos,
          vacio: hayFiltros() ? "No hay turnos con esos filtros." : "Aún no hay turnos registrados.",
        })}
        ${paginador({
          pagina: s.pagina,
          totalPaginas: datos?.total_paginas,
          texto: datos ? `${datos.total.toLocaleString("es-CO")} turnos · página ${datos.pagina} de ${datos.total_paginas}` : "",
        })}`,
    );
  }

  const consultar = () => {
    sondeo.estado.datos = null;
    render();
    sondeo.refrescar();
  };

  contenedor.innerHTML = String(html`
    <section class="adm__seccion">
      ${encabezado({ titulo, detalle: "Turnos de hoy y días anteriores. Para consultar reservas futuras, usa los filtros de fecha." })}
      <article class="panel panel--tabla">
        <div class="barra-tabla barra-tabla--filtros">
          <label class="campo campo--buscar">${icono("buscar", 16)}<input id="hi-buscar" placeholder="Código, nombre o celular" aria-label="Buscar turno" /></label>
          <span data-selectores style="display: contents"></span>
        </div>
        <div data-tabla></div>
      </article>
    </section>`);

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    if (b.dataset.accion === "detalle") verDetalle(turnos().find((t) => String(t.id) === b.dataset.id));
    else if (b.dataset.accion === "pagina") {
      s.pagina += Number(b.dataset.valor);
      consultar();
    } else if (b.dataset.accion === "limpiar") {
      s.filtros = { estado: "", punto_id: "", desde: "", hasta: "" };
      s.buscar = "";
      s.pagina = 1;
      contenedor.querySelector("#hi-buscar").value = "";
      consultar();
    }
  });
  contenedor.addEventListener("change", (e) => {
    const campo = e.target.dataset.filtro;
    if (!campo) return;
    s.filtros[campo] = e.target.value;
    s.pagina = 1;
    consultar();
  });
  // Búsqueda con espera corta para no consultar en cada tecla.
  contenedor.addEventListener("input", (e) => {
    if (e.target.id !== "hi-buscar") return;
    window.clearTimeout(espera);
    espera = window.setTimeout(() => {
      s.buscar = e.target.value;
      s.pagina = 1;
      consultar();
    }, 350);
  });

  listarSedes({ todos: true })
    .then((lista) => {
      s.sedes = lista;
      render();
    })
    .catch(() => {});
  sondeo = crearSondeo(() => adminApi.historial({ pagina: s.pagina, por_pagina: POR_PAGINA, ...s.filtros, buscar: s.buscar }), 20000, render);
  render();
  return () => {
    sondeo.detener();
    window.clearTimeout(espera);
  };
}
