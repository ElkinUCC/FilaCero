/**
 * Actividad (bitácora de auditoría, solo ADMIN): ingresos y cambios sensibles.
 *   montarActividad(contenedor, { titulo })
 */
import * as adminApi from "../../api/admin.api.js";
import { html, pintarSiCambia } from "../../utils/dom.js";
import { fechaHora } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { encabezado, marcarEnVivo } from "../layout/encabezado.js";
import { abrirDetalle, datosDetalle } from "../ui/modal.js";
import { botonFila, enlaceDetalle, estadoInsignia, paginador, tablaSeccion } from "./tablaSeccion.js";

const TONOS = {
  login_fallido: "ausente", login_bloqueado: "ausente", usuario_desactivado: "ausente", usuario_eliminado: "ausente",
  rol_cambiado: "llamado", clave_restablecida: "espera", clave_cambiada: "atencion", login: "ok", logout: "cancelado",
  turno_preparado: "ok", equipo_registrado: "atencion", equipo_actualizado: "ok", reclamo_gestionado: "llamado", presencia_cambiada: "espera",
};
/** Tipo de evento en una palabra (columna Tipo). */
const GRUPOS = {
  login: "Ingreso", logout: "Salida", login_fallido: "Seguridad", login_bloqueado: "Seguridad", clave_cambiada: "Seguridad",
  clave_restablecida: "Seguridad", rol_cambiado: "Permisos", usuario_creado: "Cuentas", usuario_editado: "Cuentas",
  usuario_desactivado: "Cuentas", usuario_activado: "Cuentas", usuario_eliminado: "Cuentas", sede_creada: "Catálogo",
  sede_editada: "Catálogo", sede_eliminada: "Catálogo", tramite_creado: "Catálogo", tramite_editado: "Catálogo",
  tramite_eliminado: "Catálogo", sede_cambiada: "Operación", turno_preparado: "Operación", equipo_registrado: "Taller",
  equipo_actualizado: "Taller", reclamo_gestionado: "Reclamos", presencia_cambiada: "Operación",
};
const tipo = (e) => estadoInsignia(TONOS[e.accion] || "cancelado", GRUPOS[e.accion] || "Cambio");

export function montarActividad(contenedor, { titulo }) {
  const s = { accion: "", pagina: 1 };
  let sondeo = null;
  const eventos = () => sondeo?.estado.datos?.eventos || [];

  function render() {
    const { datos, error, actualizado } = sondeo.estado;
    marcarEnVivo(contenedor, { actualizado, error });
    pintarSiCambia(
      contenedor.querySelector("[data-filtro]"),
      html`
        <span class="campo campo--select campo--compacto">
          <select data-campo="accion" aria-label="Filtrar por tipo de actividad">
            <option value="">Toda la actividad</option>
            ${Object.entries(datos?.acciones || {}).map(([k, v]) => html`<option value="${k}" ${s.accion === k ? "selected" : ""}>${v}</option>`)}
          </select>
        </span>
        <span class="tenue">${datos ? `${datos.total.toLocaleString("es-CO")} eventos` : ""}</span>`,
    );
    pintarSiCambia(
      contenedor.querySelector("[data-tabla]"),
      html`
        ${tablaSeccion({
          etiqueta: titulo,
          columnas: ["Evento", "Fecha y hora", "Usuario", "Dirección IP", "Tipo", ""],
          alinear: ["left", "left", "left", "center", "center", "right"],
          filas: eventos().map((e) => ({
            id: e.id,
            celdas: [
              enlaceDetalle({ texto: e.accion_texto, id: e.id }),
              fechaHora(e.fecha),
              e.usuario || html`<span class="tenue">Desconocido</span>`,
              e.ip || html`<span class="tenue">—</span>`,
              tipo(e),
              botonFila({ accion: "detalle", id: e.id, ic: "ver", titulo: `Ver detalle del evento ${e.id}` }),
            ],
          })),
          cargando: !datos,
          vacio: "Sin actividad registrada con ese filtro.",
        })}
        ${paginador({ pagina: s.pagina, totalPaginas: datos?.total_paginas, texto: datos ? `Página ${datos.pagina} de ${datos.total_paginas}` : "" })}`,
    );
  }

  const consultar = () => {
    sondeo.estado.datos = null;
    render();
    sondeo.refrescar();
  };

  contenedor.innerHTML = String(html`
    <section class="adm__seccion">
      ${encabezado({ titulo, detalle: "Registro de ingresos y cambios sensibles: quién hizo qué, cuándo y desde qué dirección." })}
      <article class="panel panel--tabla">
        <div class="barra-tabla barra-tabla--filtros" data-filtro></div>
        <div data-tabla></div>
      </article>
    </section>`);

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    if (b.dataset.accion === "pagina") {
      s.pagina += Number(b.dataset.valor);
      consultar();
    } else if (b.dataset.accion === "detalle") {
      const ev = eventos().find((x) => String(x.id) === b.dataset.id);
      abrirDetalle({
        titulo: ev.accion_texto,
        subtitulo: fechaHora(ev.fecha),
        insignia: tipo(ev),
        cuerpo: html`
          <section class="detalle__bloque"><h3>Detalle</h3><p class="detalle__texto">${ev.detalle || "Sin detalle adicional."}</p></section>
          ${datosDetalle("Origen", [["Usuario", ev.usuario || "Desconocido"], ["Correo", ev.usuario_correo], ["Dirección IP", ev.ip], ["Evento", `#${ev.id}`]])}`,
      });
    }
  });
  contenedor.addEventListener("change", (e) => {
    if (e.target.dataset.campo !== "accion") return;
    s.accion = e.target.value;
    s.pagina = 1;
    consultar();
  });

  sondeo = crearSondeo(() => adminApi.auditoria({ pagina: s.pagina, por_pagina: 20, accion: s.accion }), 15000, render);
  render();
  return () => sondeo.detener();
}
