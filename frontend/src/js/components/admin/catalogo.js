/**
 * Catálogo del panel: sedes y trámites (crear, editar, activar/desactivar, eliminar).
 *   montarCatalogo(contenedor, { tipo: "sedes" | "tramites", titulo, soloLectura })
 */
import * as catalogoApi from "../../api/catalogo.api.js";
import { html, pintar, pintarSiCambia } from "../../utils/dom.js";
import { FLUJOS } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { encabezado, marcarEnVivo } from "../layout/encabezado.js";
import { icono } from "../ui/icon.js";
import { abrirDetalle, abrirModal, confirmar, datosDetalle, mensajeError } from "../ui/modal.js";
import { avisar } from "../ui/toast.js";
import { botonFila, enlaceDetalle, estadoInsignia, tablaSeccion } from "./tablaSeccion.js";

const CONFIG = {
  sedes: {
    singular: "sede",
    nuevo: "Nueva sede",
    detalle: "Puntos de atención donde el ciudadano puede reservar.",
    vacio: { nombre: "", direccion: "" },
  },
  tramites: {
    singular: "trámite",
    nuevo: "Nuevo trámite",
    detalle: "Servicios que se pueden reservar. La atención se limita a 10 minutos.",
    vacio: { nombre: "", descripcion: "", tipo_flujo: "GENERAL", tiempo_estimado: 10 },
  },
};
const CON_PREPARACION = ["ENTREGA", "GARANTIA"];

/** Formulario de crear/editar en una ventana. */
function abrirFormulario(tipo, inicial, alGuardado) {
  const c = CONFIG[tipo];
  const editando = Boolean(inicial?.id);
  const form = { ...c.vacio, ...inicial };
  const s = { guardando: false, error: "" };

  const cuerpo = () => html`
    <form id="form-catalogo" class="formulario">
      <label><span class="etiqueta">Nombre</span>
        <span class="campo"><input id="cat-nombre" data-cat="nombre" required value="${form.nombre}" maxlength="100" placeholder="${tipo === "sedes" ? "Ej. Sede Centro" : "Ej. Soporte técnico"}" /></span>
      </label>
      ${tipo === "sedes"
        ? html`
            <label><span class="etiqueta">Dirección</span>
              <span class="campo">${icono("pin", 17)}<input id="cat-direccion" data-cat="direccion" value="${form.direccion || ""}" maxlength="200" placeholder="Calle, barrio, ciudad" /></span>
              <small class="formulario__ayuda">${(form.direccion || "").length}/200 · Se mostrará al elegir la sede.</small>
            </label>`
        : html`
            <label><span class="etiqueta">Descripción</span>
              <span class="campo"><textarea id="cat-descripcion" data-cat="descripcion" maxlength="1000" rows="3" placeholder="Qué incluye el servicio">${form.descripcion || ""}</textarea></span>
              <small class="formulario__ayuda">${(form.descripcion || "").length}/1000 · Describe brevemente qué debe esperar el ciudadano.</small>
            </label>
            <div>
              <span class="etiqueta">Tipo de atención</span>
              <div class="flujos">
                ${Object.entries(FLUJOS).map(
                  ([clave, f]) => html`<button type="button" class="flujo ${form.tipo_flujo === clave ? "activo" : ""}" data-flujo="${clave}"><strong>${f.texto}</strong><small>${f.detalle}</small></button>`,
                )}
              </div>
            </div>
            <label><span class="etiqueta">Duración estimada (minutos)</span>
              <span class="campo">${icono("reloj", 17)}<input id="cat-tiempo" data-cat="tiempo_estimado" type="number" min="1" max="10" value="${form.tiempo_estimado}" /></span>
              <small class="formulario__ayuda">La operación reserva franjas de 30 minutos y limita cada atención a 10 minutos.</small>
            </label>
            <p class="opcion-preparacion ${CON_PREPARACION.includes(form.tipo_flujo) ? "" : "opcion-preparacion--no"}" role="note">
              ${icono(CON_PREPARACION.includes(form.tipo_flujo) ? "paquete" : "alerta", 18)}
              <span>
                <strong>${CON_PREPARACION.includes(form.tipo_flujo) ? "Se alista antes de que llegue el cliente" : "Sin preparación previa"}</strong>
                <small>${form.tipo_flujo === "ENTREGA"
                  ? "El asesor prueba y empaca el equipo; el cliente lo recibe presentando su cédula."
                  : form.tipo_flujo === "GARANTIA"
                    ? "El asesor revisa la compra y la cobertura antes de la cita."
                    : "Solo la entrega de equipos y las garantías se preparan. Lo define el tipo de atención."}</small>
              </span>
            </p>`}
      ${mensajeError(s.error)}
    </form>`;
  const pie = () => html`
    <button type="button" class="btn btn--suave" data-cerrar>Cancelar</button>
    <button type="submit" form="form-catalogo" class="btn btn--primario" ${s.guardando ? "disabled" : ""}>${s.guardando ? "Guardando…" : editando ? "Guardar cambios" : `Crear ${c.singular}`}</button>`;

  const v = abrirModal({ titulo: editando ? `Editar ${c.singular}` : c.nuevo, descripcion: c.detalle, cuerpo: cuerpo(), pie: pie() });
  const repintar = () => {
    pintar(v.cuerpo, cuerpo());
    pintar(v.pie, pie());
  };
  v.caja.addEventListener("input", (e) => {
    const campo = e.target.dataset.cat;
    if (!campo) return;
    form[campo] = e.target.value;
    repintar();
  });
  v.caja.addEventListener("click", (e) => {
    const b = e.target.closest("[data-flujo]");
    if (!b) return;
    form.tipo_flujo = b.dataset.flujo;
    repintar();
  });
  v.caja.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cuerpoApi = { nombre: String(form.nombre).trim() };
    if (tipo === "sedes") cuerpoApi.direccion = String(form.direccion || "").trim();
    else {
      cuerpoApi.descripcion = String(form.descripcion || "").trim();
      cuerpoApi.tipo_flujo = form.tipo_flujo || "GENERAL";
      cuerpoApi.tiempo_estimado = Number(form.tiempo_estimado);
    }
    s.error =
      cuerpoApi.nombre.length < 2 ? "Escribe un nombre de al menos 2 caracteres."
      : tipo === "tramites" && !(cuerpoApi.tiempo_estimado >= 1 && cuerpoApi.tiempo_estimado <= 10) ? "La duración estimada debe estar entre 1 y 10 minutos (regla de atención)."
      : "";
    if (s.error) return repintar();
    s.guardando = true;
    repintar();
    try {
      const { registro } = editando ? await catalogoApi.actualizar(tipo, inicial.id, cuerpoApi) : await catalogoApi.crear(tipo, cuerpoApi);
      v.cerrar();
      alGuardado(registro, editando);
    } catch (err) {
      s.error = err.message;
      s.guardando = false;
      repintar();
    }
  });
}

export function montarCatalogo(contenedor, { tipo, titulo, soloLectura }) {
  const c = CONFIG[tipo];
  const esSede = tipo === "sedes";
  const s = { buscar: "", cambiando: null };
  let detalleAbierto = null;
  let sondeo = null;

  const registros = () => sondeo?.estado.datos || [];
  const buscarRegistro = (id) => registros().find((x) => String(x.id) === String(id));
  const urlSala = (id) => `#/sala?sede=${id}`;

  function filasTabla() {
    const f = s.buscar.trim().toLowerCase();
    return registros()
      .filter((x) => !f || `${x.nombre} ${x.direccion || ""} ${x.descripcion || ""}`.toLowerCase().includes(f))
      .map((r) => {
        const estado = estadoInsignia(r.activo ? "ok" : "cancelado", r.activo ? "Activo" : "Inactivo");
        const principal = enlaceDetalle({ texto: r.nombre, id: r.id });
        const acciones = html`
          ${esSede ? html`<a class="icono-btn" href="${urlSala(r.id)}" target="_blank" rel="noopener noreferrer" title="Abrir pantalla de sala de espera" aria-label="Abrir pantalla de sala de ${r.nombre} (nueva pestaña)">${icono("pantalla", 17)}</a>` : ""}
          ${!soloLectura ? botonFila({ accion: "editar", id: r.id, ic: "editar", titulo: `Editar ${r.nombre}` }) : ""}
          ${!soloLectura && !esSede ? botonFila({ accion: "alternar", id: r.id, ic: "encender", titulo: `${r.activo ? "Desactivar" : "Activar"} ${r.nombre}`, deshabilitado: s.cambiando === r.id }) : ""}
          ${!soloLectura ? botonFila({ accion: "eliminar", id: r.id, ic: "eliminar", titulo: `Eliminar ${r.nombre}`, peligro: true }) : ""}`;
        const celdas = esSede
          ? [principal, r.direccion || html`<span class="tenue">Sin dirección</span>`, r.asesores_activos ?? "—", r.cupos_por_franja ?? "—", estado, acciones]
          : [
              principal,
              FLUJOS[r.tipo_flujo || "GENERAL"]?.texto,
              `${r.tiempo_estimado} min`,
              r.requiere_preparacion ? estadoInsignia("atencion", "Se prepara") : html`<span class="tenue">No aplica</span>`,
              estado,
              acciones,
            ];
        return { id: r.id, inactivo: !r.activo, celdas };
      });
  }

  function render() {
    const { datos, error, actualizado } = sondeo.estado;
    marcarEnVivo(contenedor, { actualizado, error });
    const activos = registros().filter((x) => x.activo).length;
    contenedor.querySelector("[data-conteo]").textContent = `${activos} activos de ${registros().length}`;
    pintarSiCambia(
      contenedor.querySelector("[data-tabla]"),
      tablaSeccion({
        etiqueta: titulo,
        columnas: esSede ? ["Sede", "Dirección", "Asesores activos", "Cupos por franja", "Estado", ""] : ["Trámite", "Tipo de atención", "Duración", "Preparación previa", "Estado", ""],
        alinear: ["left", "left", "center", "center", "center", "right"],
        anchos: esSede ? [20, 36, 12, 12, 10, 10] : [28, 18, 12, 18, 12, 12],
        filas: filasTabla(),
        cargando: !datos,
        vacio: s.buscar ? "Ningún resultado con esa búsqueda." : `Aún no hay registros. Usa “${c.nuevo}” para crear el primero.`,
      }),
    );
  }

  async function alternar(registro, activo) {
    s.cambiando = registro.id;
    sondeo.poner(registros().map((x) => (x.id === registro.id ? { ...x, activo } : x)));
    try {
      await catalogoApi.actualizar(tipo, registro.id, { activo });
      avisar(`${registro.nombre} ${activo ? "activado" : "desactivado"}.`);
    } catch (e) {
      avisar(e.message, "error");
    }
    s.cambiando = null;
    sondeo.refrescar();
  }

  function pedirEliminar(r) {
    confirmar({
      titulo: `Eliminar ${c.singular}`,
      mensaje: `¿Eliminar “${r.nombre}”? Si ya tiene turnos registrados no se puede eliminar; en ese caso desactívalo para que no aparezca al reservar.`,
      textoConfirmar: "Eliminar",
      alConfirmar: async () => {
        await catalogoApi.eliminar(tipo, r.id);
        avisar(`${r.nombre} eliminado.`);
        detalleAbierto?.cerrar();
        sondeo.refrescar();
      },
    });
  }

  function editar(r = {}) {
    abrirFormulario(tipo, r, (registro, editando) => {
      avisar(`${registro?.nombre || "Registro"} ${editando ? "actualizado" : "creado"}.`);
      detalleAbierto?.cerrar();
      sondeo.refrescar();
    });
  }

  function verDetalle(r) {
    const cuerpo = esSede
      ? datosDetalle("Operación", [
          ["Asesores activos", r.asesores_activos],
          ["Cupos por franja de 30 min", r.cupos_por_franja],
          ["Estado", r.activo ? "Recibe reservas" : "No aparece al reservar"],
          ["Identificador", `#${r.id}`],
        ])
      : html`
          <section class="detalle__bloque"><h3>Descripción</h3><p class="detalle__texto">${r.descripcion || "Sin descripción."}</p></section>
          ${datosDetalle("Configuración", [
            ["Tipo de atención", FLUJOS[r.tipo_flujo || "GENERAL"]?.texto],
            ["Cómo reserva el cliente", FLUJOS[r.tipo_flujo || "GENERAL"]?.detalle],
            ["Duración estimada", `${r.tiempo_estimado} min`],
            ["Preparación previa", r.requiere_preparacion ? "Sí, se alista antes de la llegada" : "No"],
          ])}`;
    const acciones = html`
      ${esSede ? html`<a class="btn btn--borde" href="${urlSala(r.id)}" target="_blank" rel="noopener noreferrer">${icono("pantalla", 16)} Pantalla de sala</a>` : ""}
      ${!soloLectura
        ? html`
            <button class="btn btn--suave" data-d="editar">${icono("editar", 16)} Editar</button>
            <button class="btn btn--suave" data-d="alternar">${icono("encender", 16)} ${r.activo ? "Desactivar" : "Activar"}</button>
            <button class="btn btn--peligro" data-d="eliminar">${icono("eliminar", 16)} Eliminar</button>`
        : ""}`;
    detalleAbierto = abrirDetalle({
      titulo: r.nombre,
      subtitulo: esSede ? r.direccion || "Sin dirección registrada" : `${r.tiempo_estimado} min por atención`,
      insignia: estadoInsignia(r.activo ? "ok" : "cancelado", r.activo ? "Activo" : "Inactivo"),
      cuerpo,
      acciones,
      alCerrar: () => {
        detalleAbierto = null;
      },
    });
    detalleAbierto.caja.addEventListener("click", (e) => {
      const b = e.target.closest("[data-d]");
      if (!b) return;
      if (b.dataset.d === "editar") editar(r);
      if (b.dataset.d === "alternar") {
        detalleAbierto.cerrar();
        alternar(r, !r.activo);
      }
      if (b.dataset.d === "eliminar") pedirEliminar(r);
    });
  }

  contenedor.innerHTML = String(html`
    <section class="adm__seccion">
      ${encabezado({
        titulo,
        detalle: c.detalle,
        extra: soloLectura ? "" : html`<button class="btn btn--primario" data-accion="nuevo">${icono("mas", 17)} ${c.nuevo}</button>`,
      })}
      <article class="panel panel--tabla">
        <div class="barra-tabla">
          <label class="campo campo--buscar">${icono("buscar", 16)}<input id="cat-buscar" placeholder="Buscar ${c.singular}" aria-label="Buscar" /></label>
          <span class="tenue" data-conteo></span>
        </div>
        <div data-tabla></div>
      </article>
    </section>`);

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    const r = buscarRegistro(b.dataset.id);
    const accion = b.dataset.accion;
    if (accion === "nuevo") editar({});
    else if (accion === "detalle") verDetalle(r);
    else if (accion === "editar") editar(r);
    else if (accion === "alternar") alternar(r, !r.activo);
    else if (accion === "eliminar") pedirEliminar(r);
  });
  contenedor.addEventListener("input", (e) => {
    if (e.target.id !== "cat-buscar") return;
    s.buscar = e.target.value;
    render();
  });

  sondeo = crearSondeo(() => catalogoApi.listar(tipo, { todos: true }), 30000, render);
  render();
  return () => sondeo.detener();
}
