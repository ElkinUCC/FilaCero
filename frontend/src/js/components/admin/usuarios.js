/**
 * Usuarios y permisos (solo ADMIN): cuentas del personal, rol, bloqueo,
 * contraseña temporal y eliminación.
 *   montarUsuarios(contenedor, { titulo })
 */
import * as adminApi from "../../api/admin.api.js";
import { listarSedes } from "../../api/catalogo.api.js";
import { html, pintar, pintarSiCambia } from "../../utils/dom.js";
import { fechaHora } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { teclasPestanas } from "../../utils/voz.js";
import { encabezado, marcarEnVivo } from "../layout/encabezado.js";
import { icono } from "../ui/icon.js";
import { abrirDetalle, abrirModal, confirmar, datosDetalle, mensajeError } from "../ui/modal.js";
import { avisar } from "../ui/toast.js";
import { botonFila, enlaceDetalle, estadoInsignia, tablaSeccion } from "./tablaSeccion.js";

const ROLES = {
  ADMIN: { nombre: "Administrador", tono: "admin", permisos: ["Todo el panel", "Crear y editar sedes, trámites y usuarios", "Ver la actividad del sistema"] },
  SUPERVISOR: { nombre: "Supervisor", tono: "super", permisos: ["Ver resumen, historial, sedes y asesores", "No puede modificar nada"] },
  AGENTE: { nombre: "Asesor", tono: "asesor", permisos: ["Consola de atención de su sede", "Llamar, atender y cerrar turnos"] },
};

function hace(iso) {
  if (!iso) return "Nunca";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "Ayer" : `Hace ${d} días`;
}

/** Muestra una sola vez la contraseña temporal generada por el servidor. */
function mostrarClaveTemporal({ titulo, usuario, clave }) {
  const v = abrirModal({
    titulo,
    descripcion: `${usuario.nombre} · ${usuario.correo}`,
    ancho: 440,
    cuerpo: html`
      <p class="modal__texto">Entrégale esta contraseña temporal. Al ingresar, el sistema le pedirá crear una propia.</p>
      <div class="clave-temporal"><span>${clave}</span><button class="icono-btn" data-copiar title="Copiar" aria-label="Copiar contraseña">${icono("copiar", 17)}</button></div>
      <p class="nota-segura">${icono("alerta", 16)} Por seguridad no se volverá a mostrar. Si se pierde, restablécela de nuevo.</p>`,
    pie: html`<button class="btn btn--primario" data-cerrar>Listo, ya la compartí</button>`,
  });
  v.caja.querySelector("[data-copiar]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(clave);
      avisar("Contraseña copiada.");
    } catch {
      avisar("Selecciónala y cópiala manualmente.", "error");
    }
  });
}

function abrirFormularioUsuario(inicial, sedes, yo, alGuardado) {
  const editando = Boolean(inicial?.id);
  const esYo = inicial?.id === yo;
  const form = { nombre: inicial?.nombre || "", correo: inicial?.correo || "", rol: inicial?.rol || "AGENTE", punto_id: inicial?.punto_asignado_id ?? "" };
  const s = { guardando: false, error: "" };

  const cuerpo = () => html`
    <form id="form-usuario" class="formulario">
      <div class="formulario__fila">
        <label><span class="etiqueta">Nombre completo</span><span class="campo">${icono("usuario", 17)}<input id="us-nombre" data-f="nombre" value="${form.nombre}" maxlength="100" /></span></label>
        <label><span class="etiqueta">Correo de acceso</span><span class="campo"><input id="us-correo" data-f="correo" type="email" value="${form.correo}" maxlength="120" placeholder="nombre@filacero.co" /></span></label>
      </div>
      <div>
        <span class="etiqueta">Rol y permisos ${esYo ? html`<small class="tenue">(no puedes cambiar tu propio rol)</small>` : ""}</span>
        <div class="roles" role="radiogroup" aria-label="Rol">
          ${Object.entries(ROLES).map(
            ([clave, r]) => html`
              <button type="button" role="radio" aria-checked="${form.rol === clave}" data-rol="${clave}" ${esYo && form.rol !== clave ? "disabled" : ""}
                class="rol-op rol-op--${r.tono} ${form.rol === clave ? "activo" : ""}">
                <strong>${r.nombre}</strong><ul>${r.permisos.map((p) => html`<li>${p}</li>`)}</ul>
              </button>`,
          )}
        </div>
      </div>
      ${form.rol === "AGENTE"
        ? html`
            <label class="dd"><span class="dd__label">Sede donde atiende</span>
              <span class="campo campo--select">${icono("edificio", 17)}
                <select data-f="punto_id">
                  <option value="">Sin sede asignada</option>
                  ${sedes.filter((x) => x.activo).map((x) => html`<option value="${x.id}" ${String(x.id) === String(form.punto_id) ? "selected" : ""}>${x.nombre}</option>`)}
                </select>
              </span>
            </label>`
        : ""}
      ${mensajeError(s.error)}
    </form>`;
  const pie = () => html`
    <button type="button" class="btn btn--suave" data-cerrar>Cancelar</button>
    <button type="submit" form="form-usuario" class="btn btn--primario" ${s.guardando ? "disabled" : ""}>${s.guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear usuario"}</button>`;

  const v = abrirModal({
    titulo: editando ? "Editar usuario" : "Nuevo usuario",
    descripcion: editando ? "Los cambios de rol aplican de inmediato, incluso con la sesión abierta." : "Se generará una contraseña temporal que deberá cambiar al ingresar.",
    ancho: 620,
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
  v.caja.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rol]");
    if (!b || b.disabled) return;
    form.rol = b.dataset.rol;
    repintar();
  });
  v.caja.addEventListener("submit", async (e) => {
    e.preventDefault();
    s.error = form.nombre.trim().length < 3 ? "Escribe el nombre completo." : !/^\S+@\S+\.\S+$/.test(form.correo.trim()) ? "Escribe un correo válido." : "";
    if (s.error) return repintar();
    const cuerpoApi = { nombre: form.nombre.trim(), correo: form.correo.trim() };
    if (!esYo) cuerpoApi.rol = form.rol;
    if (form.rol === "AGENTE") cuerpoApi.punto_id = form.punto_id === "" ? null : Number(form.punto_id);
    s.guardando = true;
    repintar();
    try {
      const r = editando ? await adminApi.actualizarUsuario(inicial.id, cuerpoApi) : await adminApi.crearUsuario(cuerpoApi);
      v.cerrar();
      alGuardado(r, editando);
    } catch (err) {
      s.error = err.message;
      s.guardando = false;
      repintar();
    }
  });
}

export function montarUsuarios(contenedor, { titulo }) {
  const s = { filtroRol: "", buscar: "" };
  let detalleAbierto = null;
  let sondeo = null;

  const usuarios = () => sondeo?.estado.datos?.usuarios || [];
  const yo = () => sondeo?.estado.datos?.yo;
  const buscarUsuario = (id) => usuarios().find((u) => String(u.id) === String(id));

  function filtros() {
    const conteo = usuarios().reduce((acc, u) => ({ ...acc, [u.rol]: (acc[u.rol] || 0) + 1 }), {});
    return html`
      <button role="tab" tabindex="${!s.filtroRol ? 0 : -1}" aria-selected="${!s.filtroRol}" class="${!s.filtroRol ? "activo" : ""}" data-accion="rol" data-valor="">Todos</button>
      ${Object.entries(ROLES).map(
        ([k, r]) => html`<button role="tab" tabindex="${s.filtroRol === k ? 0 : -1}" aria-selected="${s.filtroRol === k}" class="${s.filtroRol === k ? "activo" : ""}" data-accion="rol" data-valor="${k}">${r.nombre} <small>${conteo[k] || 0}</small></button>`,
      )}`;
  }

  function render() {
    const { datos, error, actualizado } = sondeo.estado;
    marcarEnVivo(contenedor, { actualizado, error });
    pintarSiCambia(contenedor.querySelector("[data-filtros]"), filtros());
    const f = s.buscar.trim().toLowerCase();
    const filas = usuarios()
      .filter((u) => (!s.filtroRol || u.rol === s.filtroRol) && (!f || `${u.nombre} ${u.correo}`.toLowerCase().includes(f)))
      .map((u) => {
        const r = ROLES[u.rol] || {};
        const esYo = u.id === yo();
        return {
          id: u.id,
          inactivo: !u.activo,
          celdas: [
            enlaceDetalle({ texto: `${u.nombre}${esYo ? " (tú)" : ""}`, id: u.id, avatar: u.nombre[0] }),
            html`<span class="rol rol--${r.tono}">${r.nombre}</span>`,
            u.rol === "AGENTE" ? u.sede || html`<span class="tenue">Sin sede</span>` : html`<span class="tenue">No aplica</span>`,
            html`<span title="${u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString("es-CO") : ""}">${hace(u.ultimo_acceso)}</span>`,
            estadoInsignia(u.activo ? "ok" : "cancelado", u.activo ? "Activo" : "Bloqueado"),
            html`
              ${botonFila({ accion: "editar", id: u.id, ic: "editar", titulo: `Editar ${u.nombre}` })}
              ${botonFila({ accion: "restablecer", id: u.id, ic: "llave", titulo: esYo ? "Usa “Cambiar mi contraseña”" : `Restablecer contraseña de ${u.nombre}`, deshabilitado: esYo })}
              ${botonFila({ accion: "eliminar", id: u.id, ic: "eliminar", titulo: esYo ? "No puedes eliminar tu propia cuenta" : u.protegida ? "Cuenta protegida" : `Eliminar a ${u.nombre}`, peligro: true, deshabilitado: esYo || u.protegida })}`,
          ],
        };
      });
    pintarSiCambia(
      contenedor.querySelector("[data-tabla]"),
      tablaSeccion({
        etiqueta: titulo,
        columnas: ["Usuario", "Rol", "Sede", "Último acceso", "Estado", ""],
        alinear: ["left", "center", "left", "center", "center", "right"],
        filas,
        cargando: !datos,
        vacio: "Ningún usuario con ese filtro.",
      }),
    );
  }

  async function alternar(u, activo) {
    const d = sondeo.estado.datos;
    sondeo.poner({ ...d, usuarios: d.usuarios.map((x) => (x.id === u.id ? { ...x, activo } : x)) });
    try {
      await adminApi.actualizarUsuario(u.id, { activo });
      avisar(activo ? `${u.nombre} puede ingresar de nuevo.` : `${u.nombre} ya no puede ingresar.`);
    } catch (e) {
      avisar(e.message, "error");
    }
    sondeo.refrescar();
  }

  function restablecer(u) {
    confirmar({
      titulo: "Restablecer contraseña",
      mensaje: `Se generará una contraseña temporal para ${u.nombre}. Su contraseña actual dejará de funcionar y deberá crear una nueva al ingresar.`,
      textoConfirmar: "Restablecer",
      peligro: false,
      alConfirmar: async () => {
        const r = await adminApi.restablecerClave(u.id);
        detalleAbierto?.cerrar();
        sondeo.refrescar();
        window.setTimeout(() => mostrarClaveTemporal({ titulo: "Contraseña restablecida", usuario: u, clave: r.clave_temporal }), 0);
      },
    });
  }

  function eliminar(u) {
    confirmar({
      titulo: "Eliminar cuenta",
      mensaje: `¿Eliminar definitivamente la cuenta de ${u.nombre}? No podrá volver a ingresar y desaparecerá de la lista. Su historial de atenciones y la bitácora se conservan. Si solo quieres pausar el acceso, usa “Bloquear acceso”.`,
      textoConfirmar: "Eliminar cuenta",
      alConfirmar: async () => {
        const r = await adminApi.eliminarUsuario(u.id);
        avisar(r?.mensaje || `${u.nombre} eliminado.`);
        detalleAbierto?.cerrar();
        sondeo.refrescar();
      },
    });
  }

  function editar(u = {}) {
    abrirFormularioUsuario(u, sondeo.estado.datos?.sedes || [], yo(), (r, editando) => {
      detalleAbierto?.cerrar();
      sondeo.refrescar();
      if (r.clave_temporal) mostrarClaveTemporal({ titulo: "Usuario creado", usuario: r.usuario, clave: r.clave_temporal });
      else avisar(`${r.usuario?.nombre} ${editando ? "actualizado" : "creado"}.`);
    });
  }

  function verDetalle(u) {
    const r = ROLES[u.rol] || {};
    const esYo = u.id === yo();
    detalleAbierto = abrirDetalle({
      titulo: u.nombre + (esYo ? " (tú)" : ""),
      subtitulo: u.correo,
      insignia: html`
        <span class="rol rol--${r.tono}">${r.nombre}</span>
        ${estadoInsignia(u.activo ? "ok" : "cancelado", u.activo ? "Activo" : "Bloqueado")}
        ${u.protegida ? html`<span class="insignia-protegida">${icono("escudo", 12)} Protegida</span>` : ""}`,
      cuerpo: html`
        <section class="detalle__bloque"><h3>Permisos del rol</h3><ul class="detalle__lista">${(r.permisos || []).map((p) => html`<li>${p}</li>`)}</ul></section>
        ${datosDetalle("Cuenta", [
          ["Correo de acceso", u.correo],
          u.rol === "AGENTE" && ["Sede", u.sede || "Sin sede"],
          u.rol === "AGENTE" && ["Módulo", u.modulo || "Sin módulo"],
          ["Último acceso", u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : "Nunca"],
          ["Contraseña", u.debe_cambiar_clave ? "Temporal (debe cambiarla)" : "Propia"],
          ["Creada", u.fecha_creacion ? fechaHora(u.fecha_creacion) : null],
        ])}`,
      acciones: html`
        <button class="btn btn--suave" data-accion="editar" data-id="${u.id}">${icono("editar", 16)} Editar</button>
        <button class="btn btn--suave" data-accion="restablecer" data-id="${u.id}" ${esYo ? "disabled" : ""}>${icono("llave", 16)} Restablecer clave</button>
        <button class="btn btn--suave" data-accion="alternar" data-id="${u.id}" ${esYo || u.protegida ? "disabled" : ""}>${icono("encender", 16)} ${u.activo ? "Bloquear acceso" : "Permitir acceso"}</button>
        <button class="btn btn--peligro" data-accion="eliminar" data-id="${u.id}" ${esYo || u.protegida ? "disabled" : ""}>${icono("eliminar", 16)} Eliminar</button>`,
      alCerrar: () => {
        detalleAbierto = null;
      },
    });
    detalleAbierto.caja.addEventListener("click", manejarClic);
  }

  function manejarClic(e) {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    const u = buscarUsuario(b.dataset.id);
    const accion = b.dataset.accion;
    if (accion === "nuevo") editar({});
    else if (accion === "rol") {
      s.filtroRol = b.dataset.valor;
      render();
    } else if (accion === "detalle") verDetalle(u);
    else if (accion === "editar") editar(u);
    else if (accion === "restablecer") restablecer(u);
    else if (accion === "eliminar") eliminar(u);
    else if (accion === "alternar") {
      detalleAbierto?.cerrar();
      alternar(u, !u.activo);
    }
  }

  contenedor.innerHTML = String(html`
    <section class="adm__seccion">
      ${encabezado({
        titulo,
        detalle: "Cuentas del personal y lo que cada rol puede hacer. Haz clic en un usuario para ver sus permisos.",
        extra: html`<button class="btn btn--primario" data-accion="nuevo">${icono("mas", 17)} Nuevo usuario</button>`,
      })}
      <article class="panel panel--tabla">
        <div class="barra-tabla barra-tabla--filtros">
          <label class="campo campo--buscar">${icono("buscar", 16)}<input id="us-buscar" placeholder="Nombre o correo" aria-label="Buscar usuario" /></label>
          <div class="segmentos" role="tablist" aria-label="Filtrar por rol" data-filtros></div>
        </div>
        <div data-tabla></div>
      </article>
    </section>`);

  contenedor.addEventListener("click", manejarClic);
  contenedor.querySelector("[data-filtros]").addEventListener("keydown", teclasPestanas);
  contenedor.addEventListener("input", (e) => {
    if (e.target.id !== "us-buscar") return;
    s.buscar = e.target.value;
    render();
  });

  sondeo = crearSondeo(async () => {
    const [u, listaSedes] = await Promise.all([adminApi.listarUsuarios(), listarSedes({ todos: true })]);
    return { ...u, sedes: listaSedes };
  }, 20000, render);
  render();
  return () => sondeo.detener();
}
