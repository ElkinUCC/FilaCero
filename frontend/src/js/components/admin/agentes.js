/**
 * Asesores: personas que atienden en cada sede (crear, editar, retirar, eliminar).
 *   montarAgentes(contenedor, { titulo, soloLectura })
 */
import * as adminApi from "../../api/admin.api.js";
import { listarSedes } from "../../api/catalogo.api.js";
import { html, pintar, pintarSiCambia } from "../../utils/dom.js";
import { fechaCorta, horaDe, PRESENCIAS } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { encabezado, marcarEnVivo } from "../layout/encabezado.js";
import { icono } from "../ui/icon.js";
import { abrirDetalle, abrirModal, confirmar, datosDetalle, mensajeError } from "../ui/modal.js";
import { avisar } from "../ui/toast.js";
import { botonFila, enlaceDetalle, estadoInsignia, tablaSeccion } from "./tablaSeccion.js";
import { cargando } from "../ui/cargando.js";

/** Lo que el asesor está haciendo AHORA (atendiendo, en pausa, almuerzo...). */
function actividadAgente(agente, sedes) {
  if (!agente.activo) return { texto: "Retirado", detalle: "Acceso retirado", tono: "cancelado" };
  if (!agente.punto_asignado_id) return { texto: "Sin sede", detalle: "Asigna una sede para atender", tono: "espera" };
  const sede = sedes.find((item) => item.id === agente.punto_asignado_id);
  if (sede && !sede.activo) return { texto: "Sede inactiva", detalle: "No puede recibir turnos", tono: "cancelado" };
  if (agente.estado_turno_actual === "EN_ATENCION") return { texto: "Atendiendo", detalle: `Atiende el turno ${agente.turno_actual.slice(-6)}`, tono: "atencion" };
  if (agente.estado_turno_actual === "LLAMADO") return { texto: "Llamando", detalle: `Llamó el turno ${agente.turno_actual.slice(-6)}`, tono: "llamado" };
  const p = PRESENCIAS[agente.presencia || "DISPONIBLE"] || PRESENCIAS.DISPONIBLE;
  const desde = agente.presencia_desde ? ` desde las ${horaDe(agente.presencia_desde)}` : "";
  const detalle = agente.presencia === "DISPONIBLE" || !agente.presencia ? `Libre para atender${desde}` : `${p.texto}${desde}`;
  return { texto: p.texto, detalle, tono: p.tono };
}

function hace(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "Ayer" : `Hace ${d} días`;
}
const ultimoAcceso = (iso) => (iso ? `${fechaCorta(iso.slice(0, 10))} · ${horaDe(iso)}` : "Sin ingresos registrados");

function abrirFormularioAsesor(inicial, sedes, alGuardado) {
  const editando = Boolean(inicial?.id);
  const form = { nombre: inicial?.nombre || "", correo: inicial?.correo || "", password: "", punto_id: inicial?.punto_asignado_id ?? "", modulo: inicial?.modulo || "" };
  const s = { guardando: false, error: "" };

  const cuerpo = () => html`
    <form id="form-asesor" class="formulario">
      <label><span class="etiqueta">Nombre completo</span>
        <span class="campo">${icono("usuario", 17)}<input id="as-nombre" data-f="nombre" value="${form.nombre}" maxlength="100" required /></span></label>
      ${editando
        ? ""
        : html`<label><span class="etiqueta">Correo de acceso</span>
            <span class="campo"><input id="as-correo" data-f="correo" type="email" value="${form.correo}" maxlength="120" placeholder="nombre@filacero.co" required /></span></label>`}
      <div class="row row-cols-1 row-cols-sm-2 g-3">
        <label class="dd"><span class="dd__label">Sede</span>
          <span class="campo campo--select">${icono("edificio", 17)}
            <select data-f="punto_id">
              <option value="">Sin sede asignada</option>
              ${sedes.filter((x) => x.activo).map((x) => html`<option value="${x.id}" ${String(x.id) === String(form.punto_id) ? "selected" : ""}>${x.nombre}</option>`)}
            </select>
          </span>
        </label>
        <label><span class="etiqueta">Módulo o taquilla</span>
          <span class="campo">${icono("atender", 17)}<input id="as-modulo" data-f="modulo" value="${form.modulo}" maxlength="40" list="sugerencias-modulo" placeholder="Ej. Módulo 2" /></span>
          <datalist id="sugerencias-modulo">
            ${[1, 2, 3, 4, 5, 6].map((n) => html`<option value="Módulo ${n}"></option>`)}
            ${[1, 2, 3].map((n) => html`<option value="Taquilla ${n}"></option>`)}
          </datalist>
        </label>
      </div>
      <small class="formulario__ayuda">El módulo se anuncia en la sala de espera y en el llamado por voz: “acérquese al Módulo 2”.</small>
      <label><span class="etiqueta">${editando ? "Nueva contraseña (opcional)" : "Contraseña"}</span>
        <span class="campo">${icono("llave", 17)}<input id="as-password" data-f="password" type="password" value="${form.password}" autocomplete="new-password" placeholder="Mínimo 8, con letras y números" /></span></label>
      ${mensajeError(s.error)}
    </form>`;
  const pie = () => html`
    <button type="button" class="btn btn--suave" data-cerrar>Cancelar</button>
    <button type="submit" form="form-asesor" class="btn btn--primario" ${s.guardando ? "disabled" : ""}>${s.guardando ? cargando("Guardando…") : editando ? "Guardar cambios" : "Crear asesor"}</button>`;

  const v = abrirModal({
    titulo: editando ? "Editar asesor" : "Nuevo asesor",
    descripcion: editando ? "Revisa la ficha y actualiza los datos asignados al asesor." : "Cada asesor suma 3 cupos por franja de 30 minutos en su sede.",
    ancho: 560,
    cuerpo: cuerpo(),
    pie: pie(),
  });
  const repintar = () => {
    pintar(v.cuerpo, cuerpo());
    pintar(v.pie, pie());
  };
  const guardarCampo = (e) => {
    if (e.target.dataset.f) form[e.target.dataset.f] = e.target.value;
  };
  v.caja.addEventListener("input", guardarCampo);
  v.caja.addEventListener("change", guardarCampo);
  v.caja.addEventListener("submit", async (e) => {
    e.preventDefault();
    const claveValida = form.password.length >= 8 && /\d/.test(form.password) && /[a-z]/i.test(form.password);
    s.error =
      form.nombre.trim().length < 3 ? "Escribe el nombre completo."
      : !editando && !/^\S+@\S+\.\S+$/.test(form.correo.trim()) ? "Escribe un correo válido."
      : (!editando || form.password) && !claveValida ? "La contraseña debe tener 8 caracteres o más, con letras y números."
      : "";
    if (s.error) return repintar();
    const cuerpoApi = { nombre: form.nombre.trim(), punto_id: form.punto_id === "" ? null : Number(form.punto_id), modulo: form.modulo.trim() };
    if (!editando) cuerpoApi.correo = form.correo.trim();
    if (form.password) cuerpoApi.password = form.password;
    s.guardando = true;
    repintar();
    try {
      const r = editando ? await adminApi.actualizarAgente(inicial.id, cuerpoApi) : await adminApi.crearAgente(cuerpoApi);
      v.cerrar();
      alGuardado(r.agente, editando);
    } catch (err) {
      s.error = err.message;
      s.guardando = false;
      repintar();
    }
  });
}

export function montarAgentes(contenedor, { titulo, soloLectura }) {
  const s = { buscar: "", mostrarRetirados: false };
  let detalleAbierto = null;
  let sondeo = null;

  const agentes = () => sondeo?.estado.datos?.agentes || [];
  const sedes = () => sondeo?.estado.datos?.sedes || [];
  const buscarAgente = (id) => agentes().find((a) => String(a.id) === String(id));

  function botonAcceso(a, conTexto = false) {
    if (soloLectura || a.protegida) return "";
    const enCurso = Boolean(a.turno_actual);
    const texto = a.activo ? "Retirar" : "Reactivar";
    const ayuda = a.activo ? (enCurso ? "No se puede retirar mientras tiene un turno en curso." : "Retira el acceso sin borrar el historial.") : "Devuelve el acceso al asesor.";
    return html`<button class="${conTexto ? "btn btn--suave" : "icono-btn"}" title="${ayuda}" aria-label="${texto} a ${a.nombre}" data-accion="acceso" data-id="${a.id}" ${a.activo && enCurso ? "disabled" : ""}>
      ${icono("encender", conTexto ? 16 : 17)}${conTexto ? ` ${texto}` : ""}</button>`;
  }

  function render() {
    const { datos, error, actualizado } = sondeo.estado;
    marcarEnVivo(contenedor, { actualizado, error });
    const todos = agentes();
    const retirados = todos.filter((a) => !a.activo).length;
    contenedor.querySelector("[data-conteo]").textContent = `${todos.length - retirados} activos · ${retirados} retirados`;
    const f = s.buscar.trim().toLowerCase();
    const visibles = todos.filter((a) => (s.mostrarRetirados || a.activo) && (!f || `${a.nombre} ${a.correo} ${a.sede || ""} ${a.modulo || ""}`.toLowerCase().includes(f)));
    const filas = visibles.map((a) => {
      const act = actividadAgente(a, sedes());
      return {
        id: a.id,
        inactivo: !a.activo,
        celdas: [
          enlaceDetalle({ texto: a.nombre, id: a.id, avatar: a.nombre[0] }),
          a.sede || html`<span class="tenue">Sin sede</span>`,
          a.modulo || html`<span class="tenue">Sin módulo</span>`,
          a.ultimo_acceso ? hace(a.ultimo_acceso) : html`<span class="tenue">Nunca</span>`,
          estadoInsignia(act.tono, act.texto),
          soloLectura
            ? ""
            : html`
                ${botonFila({ accion: "editar", id: a.id, ic: "editar", titulo: `Editar ${a.nombre}` })}
                ${botonAcceso(a)}
                ${a.protegida ? "" : botonFila({ accion: "eliminar", id: a.id, ic: "eliminar", titulo: a.turno_actual ? "Tiene un turno en curso" : `Eliminar a ${a.nombre}`, peligro: true, deshabilitado: Boolean(a.turno_actual) })}`,
        ],
      };
    });
    pintarSiCambia(
      contenedor.querySelector("[data-tabla]"),
      tablaSeccion({
        etiqueta: titulo,
        columnas: ["Asesor", "Sede", "Módulo", "Último ingreso", "Estado", ""],
        alinear: ["left", "left", "center", "center", "center", "right"],
        anchos: [24, 16, 12, 14, 19, 15],
        filas,
        cargando: !datos,
        vacio: s.buscar
          ? "Ningún asesor con esa búsqueda."
          : retirados && !s.mostrarRetirados
            ? "No hay asesores activos. Activa “Mostrar retirados” para revisar o reactivar cuentas."
            : "Aún no hay asesores. Crea el primero con “Nuevo asesor”.",
      }),
    );
  }

  async function alternar(a, activo) {
    const d = sondeo.estado.datos;
    sondeo.poner({ ...d, agentes: d.agentes.map((x) => (x.id === a.id ? { ...x, activo } : x)) });
    try {
      await adminApi.actualizarAgente(a.id, { activo });
      avisar(`${a.nombre} ${activo ? "puede ingresar" : "ya no puede ingresar"}.`);
    } catch (e) {
      avisar(e.message, "error");
    }
    sondeo.refrescar();
  }

  function acceso(a) {
    if (!a.activo) return alternar(a, true);
    confirmar({
      titulo: "Retirar asesor",
      mensaje: `¿Retirar a ${a.nombre}? Se desactivará su acceso y dejará de contar para la capacidad de la sede. Sus turnos e historial se conservarán; puedes reactivarlo después.`,
      textoConfirmar: "Retirar asesor",
      alConfirmar: async () => {
        await adminApi.actualizarAgente(a.id, { activo: false });
        avisar(`${a.nombre} retirado. Se conservaron sus turnos e historial.`);
        detalleAbierto?.cerrar();
        sondeo.refrescar();
      },
    });
  }

  function eliminar(a) {
    confirmar({
      titulo: "Eliminar asesor",
      mensaje: `¿Eliminar definitivamente a ${a.nombre}? Desaparecerá de la lista, no podrá volver a ingresar y su correo quedará libre. Las atenciones que realizó se conservan en el historial y en los indicadores. Esta acción no se puede deshacer; si solo quieres pausar su acceso, usa “Retirar”.`,
      textoConfirmar: "Eliminar asesor",
      alConfirmar: async () => {
        const r = await adminApi.eliminarAgente(a.id);
        avisar(r?.mensaje || `${a.nombre} eliminado.`);
        detalleAbierto?.cerrar();
        sondeo.refrescar();
      },
    });
  }

  function editar(a = {}) {
    abrirFormularioAsesor(a, sedes(), (agente, editando) => {
      avisar(`${agente?.nombre || "Asesor"} ${editando ? "actualizado" : "creado"}.`);
      detalleAbierto?.cerrar();
      sondeo.refrescar();
    });
  }

  function verDetalle(a) {
    const act = actividadAgente(a, sedes());
    detalleAbierto = abrirDetalle({
      titulo: a.nombre,
      subtitulo: a.correo,
      insignia: html`${estadoInsignia(act.tono, act.texto)}${a.protegida ? html`<span class="insignia-protegida">${icono("escudo", 12)} Protegida</span>` : ""}`,
      cuerpo: html`
        ${datosDetalle("Puesto de atención", [
          ["Sede", a.sede || "Sin sede asignada"],
          ["Módulo o taquilla", a.modulo || "Sin módulo"],
          ["Ahora", act.detalle],
          ["Turno en curso", a.turno_actual ? a.turno_actual.slice(-6) : "Ninguno"],
        ])}
        ${datosDetalle("Cuenta", [
          ["Correo de acceso", a.correo],
          ["Acceso", a.activo ? "Activo" : "Retirado"],
          ["Último ingreso", ultimoAcceso(a.ultimo_acceso)],
          ["Creado", a.fecha_creacion ? fechaCorta(a.fecha_creacion.slice(0, 10)) : null],
        ])}`,
      acciones: soloLectura
        ? ""
        : html`
            <button class="btn btn--suave" data-accion="editar" data-id="${a.id}">${icono("editar", 16)} Editar</button>
            ${botonAcceso(a, true)}
            ${a.protegida ? "" : html`<button class="btn btn--peligro" data-accion="eliminar" data-id="${a.id}" ${a.turno_actual ? "disabled" : ""}>${icono("eliminar", 16)} Eliminar</button>`}`,
      alCerrar: () => {
        detalleAbierto = null;
      },
    });
    detalleAbierto.caja.addEventListener("click", manejarClic);
  }

  function manejarClic(e) {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    const a = buscarAgente(b.dataset.id);
    const accion = b.dataset.accion;
    if (accion === "nuevo") editar({});
    else if (accion === "detalle") verDetalle(a);
    else if (accion === "editar") editar(a);
    else if (accion === "acceso") acceso(a);
    else if (accion === "eliminar") eliminar(a);
  }

  contenedor.innerHTML = String(html`
    <section class="adm__seccion">
      ${encabezado({
        titulo,
        detalle: "Personas que atienden en cada sede. Haz clic en un asesor para ver su ficha completa.",
        extra: soloLectura ? "" : html`<button class="btn btn--primario" data-accion="nuevo">${icono("mas", 17)} Nuevo asesor</button>`,
      })}
      <article class="panel panel--tabla">
        <div class="barra-tabla">
          <label class="campo campo--buscar">${icono("buscar", 16)}<input id="ag-buscar" placeholder="Nombre, sede o módulo" aria-label="Buscar asesor" /></label>
          <div class="barra-tabla__der">
            <span class="tenue" data-conteo></span>
            <label class="filtro-retirados"><input type="checkbox" id="ag-retirados" /> Mostrar retirados</label>
          </div>
        </div>
        <div data-tabla></div>
      </article>
    </section>`);

  contenedor.addEventListener("click", manejarClic);
  contenedor.addEventListener("input", (e) => {
    if (e.target.id === "ag-buscar") s.buscar = e.target.value;
    else if (e.target.id === "ag-retirados") s.mostrarRetirados = e.target.checked;
    else return;
    render();
  });

  sondeo = crearSondeo(async () => {
    const [a, listaSedes] = await Promise.all([adminApi.listarAgentes(), listarSedes({ todos: true })]);
    return { agentes: a.agentes, sedes: listaSedes };
  }, 10000, render);
  render();
  return () => sondeo.detener();
}
