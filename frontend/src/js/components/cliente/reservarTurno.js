/**
 * Reserva guiada paso a paso. Los pasos cambian según el tipo de atención del
 * trámite (tipo_flujo):
 *
 *   GENERAL   Qué necesitas → Tu celular → Cuándo → Confirmar
 *   ENTREGA   Qué necesitas → Tu celular → Tu equipo (listo) → Cuándo → Confirmar
 *   GARANTIA  Qué necesitas → Tu celular → Tu televisor (compra ≤ 1 año) → Cuándo → Confirmar
 *   RECLAMO   Qué necesitas → Tu celular → Tu reclamo → [en línea: radicado] | [en persona: Cuándo → Confirmar]
 *
 * El celular verificado con código (OTP) es la identidad del ciudadano.
 *
 *   montarReservar(contenedor, { onResumen, onConfirmado }) -> función de limpieza
 */
import * as publicoApi from "../../api/publico.api.js";
import { clases, html, pintar } from "../../utils/dom.js";
import {
  diaMes, diaSemana, ESTADOS_EQUIPO, fechaCorta, fechaLarga, hoyISO, PREP_CLIENTE, soloDigitos,
} from "../../utils/formatters.js";
import { icono } from "../ui/icon.js";
import { mensajeError } from "../ui/modal.js";
import { cargando } from "../ui/cargando.js";

const DIAS_VISIBLES = 7;
const GARANTIA_DIAS = 365;
const JORNADAS = ["Madrugada", "Mañana", "Tarde", "Noche"];
const PASOS = {
  tramite: "Qué necesitas",
  celular: "Tu celular",
  equipo: "Tu equipo",
  garantia: "Tu televisor",
  reclamo: "Tu reclamo",
  horario: "Cuándo",
  confirmar: "Confirmar",
};
const ICONO_FLUJO = { ENTREGA: "paquete", GARANTIA: "escudo2", RECLAMO: "mensaje" };

/** Franja legible: "10:00 – 10:30". */
const rango = (f) => `${f.hora_inicio} – ${f.hora_fin}`;
/** Parte del día de una franja, para agrupar el desplegable de horas. */
function jornada(f) {
  const h = Number(String(f.hora_inicio).slice(0, 2));
  return h < 6 ? "Madrugada" : h < 12 ? "Mañana" : h < 18 ? "Tarde" : "Noche";
}
function iconoTramite(t) {
  if (ICONO_FLUJO[t.tipo_flujo]) return ICONO_FLUJO[t.tipo_flujo];
  if (/cotiz|repuesto/i.test(t.nombre)) return "ficha";
  if (/diagn|pantalla|televisor|repar/i.test(t.nombre)) return "tv";
  return "servicio";
}
function pasosDe(flujo, reclamoEnLinea) {
  const medio = { ENTREGA: ["equipo"], GARANTIA: ["garantia"], RECLAMO: ["reclamo"] }[flujo] || [];
  if (flujo === "RECLAMO" && reclamoEnLinea) return ["tramite", "celular", ...medio];
  return ["tramite", "celular", ...medio, "horario", "confirmar"];
}
/** "15 de junio de 2027" a partir de una fecha ISO. */
function fechaConAnio(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d, 12)),
  );
}

/** Desplegable nativo con etiqueta e icono (mismo estilo de los campos). */
function selector({ etiqueta, icon, campo, valor, opciones, placeholder, deshabilitado = false }) {
  return html`
    <label class="dd">
      <span class="dd__label">${etiqueta}</span>
      <span class="campo campo--select">
        ${icono(icon, 17)}
        <select data-campo="${campo}" ${deshabilitado ? "disabled" : ""}>
          <option value="">${placeholder}</option>
          ${opciones}
        </select>
      </span>
    </label>`;
}

export function montarReservar(contenedor, { onResumen, onConfirmado }) {
  // ------------------------------------------------------------ estado
  const s = {
    sedes: [], tramites: [], marcas: [], categorias: {}, cargando: true,
    paso: "tramite", direccion: 1, tramiteId: "", sede: "",
    celular: "", nombre: "", codigo: "", codigoEnviado: false, codigoPrueba: "", token: "", conocido: false, equipos: [],
    equipoId: "",
    garantia: { marca: "", modelo: "", fecha_compra: "", falla: "" },
    reclamo: { categoria: "", descripcion: "", equipo_id: "", presencial: null },
    reclamoCreado: null,
    fecha: hoyISO(), inicioDias: 0, franjas: [], franja: "", cargandoFranjas: false,
    ocupado: false, error: "",
  };
  let consulta = 0;
  let vivo = true;

  // ------------------------------------------------------------ derivados
  const tramite = () => s.tramites.find((t) => String(t.id) === String(s.tramiteId));
  const flujo = () => tramite()?.tipo_flujo || "GENERAL";
  const sedeSel = () => s.sedes.find((x) => String(x.id) === String(s.sede));
  const equipoSel = () => s.equipos.find((e) => String(e.id) === String(s.equipoId));
  const franjaSel = () => s.franjas.find((f) => String(f.franja_id) === String(s.franja));
  const pasos = () => pasosDe(flujo(), s.reclamo.presencial === false);
  const indice = () => Math.max(0, pasos().indexOf(s.paso));
  const celularValido = () => /^3\d{9}$/.test(s.celular);
  const nombreValido = () => s.nombre.trim().split(/\s+/).join(" ").length >= 3;
  // Validación en el cliente con los estados de Bootstrap (.is-invalid / .invalid-feedback).
  // El servidor vuelve a validar todo: esto solo orienta a la persona mientras escribe.
  const celularInvalido = () => s.celular.length === 10 && !celularValido();
  const nombreInvalido = () => s.nombre.trim().length > 0 && !nombreValido();
  const garantiaVence = () =>
    s.garantia.fecha_compra
      ? new Date(new Date(`${s.garantia.fecha_compra}T12:00:00`).getTime() + GARANTIA_DIAS * 86400000).toISOString().slice(0, 10)
      : null;
  const garantiaVigente = () =>
    Boolean(s.garantia.fecha_compra) && s.garantia.fecha_compra <= hoyISO() && s.garantia.fecha_compra >= hoyISO(-GARANTIA_DIAS);
  const garantiaLista = () => s.garantia.marca && garantiaVigente() && s.garantia.falla.trim().length >= 3;
  const reclamoListo = () =>
    s.reclamo.categoria && s.sede && s.reclamo.descripcion.trim().length >= 15 && s.reclamo.presencial !== null;

  /** Resumen en vivo para la ficha del lado izquierdo. */
  function resumir() {
    const f = franjaSel();
    onResumen?.({
      sede: sedeSel()?.nombre,
      tramite: tramite()?.nombre,
      fecha: f ? s.fecha : null,
      hora: f ? rango(f) : null,
      nombre: s.token ? s.nombre.trim() || null : null,
    });
  }

  // ------------------------------------------------------------ navegación
  function ir(destino, sentido = 1) {
    s.direccion = sentido;
    s.error = "";
    s.paso = destino;
    if (destino === "horario") cargarFranjas();
    render();
  }
  const siguiente = () => ir(pasos()[indice() + 1], 1);
  const atras = () => ir(pasos()[Math.max(0, indice() - 1)], -1);

  async function cargarFranjas() {
    if (!s.sede || !s.tramiteId) {
      s.franjas = [];
      return;
    }
    const id = ++consulta;
    s.cargandoFranjas = true;
    render();
    try {
      const r = await publicoApi.franjasDisponibles({ sedeId: s.sede, tramiteId: s.tramiteId, fecha: s.fecha });
      if (id === consulta) s.franjas = r?.franjas || [];
    } catch {
      if (id === consulta) s.franjas = [];
    }
    if (id === consulta && vivo) {
      s.cargandoFranjas = false;
      render();
    }
  }

  // ------------------------------------------------------------ acciones
  async function enviarCodigo() {
    s.ocupado = true;
    s.error = "";
    render();
    try {
      const r = await publicoApi.solicitarCodigo(s.celular);
      s.codigoEnviado = true;
      s.codigoPrueba = r.codigo_prueba || "";
      s.codigo = "";
    } catch (e) {
      s.error = e.message;
    }
    s.ocupado = false;
    render();
    contenedor.querySelector("#rv-codigo")?.focus();
  }

  async function verificar(valor) {
    s.ocupado = true;
    s.error = "";
    render();
    try {
      const r = await publicoApi.verificarCodigo(s.celular, valor);
      s.token = r.token_verificacion;
      s.codigoEnviado = false;
      // Con el celular verificado buscamos lo que ya tiene registrado con nosotros.
      const mios = await publicoApi.misEquipos(s.celular, r.token_verificacion).catch(() => null);
      s.equipos = mios?.equipos || [];
      if (mios?.cliente?.nombre) {
        s.nombre = mios.cliente.nombre;
        s.conocido = true;
      }
    } catch (e) {
      s.error = e.message;
      s.codigo = "";
    }
    s.ocupado = false;
    render();
    if (s.token && !s.conocido) contenedor.querySelector("#rv-nombre")?.focus();
  }

  function cambiarCodigo(valor) {
    s.codigo = soloDigitos(valor, 6);
    if (s.codigo.length === 6) verificar(s.codigo);
    else render();
  }

  async function radicarReclamo() {
    s.ocupado = true;
    s.error = "";
    render();
    try {
      const r = await publicoApi.radicarReclamo(s.celular, s.token, {
        nombre: s.nombre.trim(),
        categoria: s.reclamo.categoria,
        descripcion: s.reclamo.descripcion.trim(),
        punto_id: Number(s.sede),
        equipo_id: s.reclamo.equipo_id ? Number(s.reclamo.equipo_id) : null,
        presencial: Boolean(s.reclamo.presencial),
      });
      s.reclamoCreado = { ...r.reclamo, id: r.reclamo_id };
      s.ocupado = false;
      if (s.reclamo.presencial) ir("horario");
      else render();
    } catch (e) {
      s.error = e.message;
      s.ocupado = false;
      render();
    }
  }

  async function confirmar() {
    s.ocupado = true;
    s.error = "";
    render();
    const f = flujo();
    try {
      const r = await publicoApi.reservarTurno({
        nombre: s.nombre.trim(),
        celular: s.celular,
        token_verificacion: s.token,
        punto_id: Number(s.sede),
        tramite_id: Number(s.tramiteId),
        franja_id: Number(s.franja),
        ...(f === "ENTREGA" ? { equipo_id: Number(s.equipoId) } : {}),
        ...(f === "GARANTIA" ? { garantia: s.garantia } : {}),
        ...(f === "RECLAMO" && s.reclamoCreado ? { reclamo_id: s.reclamoCreado.id } : {}),
      });
      onConfirmado?.(r.turno, s.celular, r.espera, r.token_consulta);
    } catch (e) {
      s.error = e.message;
      s.ocupado = false;
      if (/cupo|comenzaron/i.test(e.message)) {
        s.franja = "";
        ir("horario", -1);
      } else render();
    }
  }

  function reiniciar() {
    s.reclamoCreado = null;
    s.tramiteId = "";
    s.reclamo = { categoria: "", descripcion: "", equipo_id: "", presencial: null };
    ir("tramite", -1);
  }

  // ------------------------------------------------------------ vistas por paso
  const pie = (botonDerecho) => html`
    <div class="wz__pie">
      <button type="button" class="btn btn--suave" data-accion="atras">Atrás</button>
      ${botonDerecho}
    </div>`;

  function vistaTramite() {
    return html`
      <h2 class="wz__titulo">¿Qué necesitas hoy?</h2>
      <div class="wz__opciones">
        ${s.cargando ? [1, 2, 3, 4].map(() => html`<div class="wz__opcion esqueleto"></div>`) : ""}
        ${s.tramites.map(
          (t, i) => html`
            <button type="button" class="wz__opcion ${String(t.id) === s.tramiteId ? "activo" : ""}" style="animation-delay: ${i * 45}ms"
              data-accion="elegir-tramite" data-id="${t.id}">
              <span class="wz__opcion-icono">${icono(iconoTramite(t), 22)}</span>
              <span class="wz__opcion-texto">
                <strong>${t.nombre}</strong>
                <small>${t.tipo_flujo === "RECLAMO" ? "En línea o en persona" : `${t.tiempo_estimado} min aprox.`}</small>
              </span>
              ${icono("derecha", 18, { clase: "wz__opcion-flecha" })}
            </button>`,
        )}
      </div>`;
  }

  function vistaCelular() {
    const titulo = s.token ? (s.conocido ? `¡Hola de nuevo, ${s.nombre.split(" ")[0]}!` : "¡Listo! ¿Cómo te llamas?") : "Verifica tu celular";
    const texto = s.token
      ? s.conocido ? "Encontramos tus datos. Revisa que tu nombre esté bien." : "Así te llamaremos cuando sea tu turno."
      : "Te enviamos un código para confirmar que eres tú. No necesitas crear cuenta.";
    return html`
      <h2 class="wz__titulo">${titulo}</h2>
      <p class="wz__texto">${texto}</p>
      ${!s.token
        ? html`
            <div class="wz__celular">
              <label class="campo campo--grande ${celularInvalido() ? "is-invalid" : ""}">
                ${icono("celular", 18)}
                <input id="rv-celular" type="tel" inputmode="numeric" autocomplete="tel-national" value="${s.celular}"
                  placeholder="300 123 4567" aria-label="Número de celular" aria-describedby="rv-celular-ayuda"
                  aria-invalid="${celularInvalido() ? "true" : "false"}" />
              </label>
              <button type="button" class="btn btn--primario" data-accion="enviar-codigo" ${!celularValido() || s.ocupado ? "disabled" : ""}>
                ${s.codigoEnviado ? "Reenviar" : "Enviar código"}
              </button>
            </div>
            ${celularInvalido()
              ? html`<div class="invalid-feedback d-block" id="rv-celular-ayuda">El celular debe tener 10 dígitos y empezar por 3 (ej. 300 123 4567).</div>`
              : html`<span class="visually-hidden" id="rv-celular-ayuda">Celular colombiano de 10 dígitos.</span>`}
            ${s.codigoEnviado
              ? html`
                  <div class="wz__codigo">
                    <input id="rv-codigo" class="wz__codigo-input" inputmode="numeric" autocomplete="one-time-code" value="${s.codigo}"
                      maxlength="6" placeholder="······" aria-label="Código de verificación" ${s.ocupado ? "disabled" : ""} />
                    <p class="rv__nota">
                      ${s.ocupado
                        ? cargando("Verificando…")
                        : s.codigoPrueba
                          ? html`Modo prueba: tu código es <button type="button" class="enlace" data-accion="usar-codigo">${s.codigoPrueba}</button>`
                          : `Te enviamos un SMS al ${s.celular}.`}
                    </p>
                  </div>`
              : ""}`
        : html`
            <div class="wz__verificado">${icono("check", 16)} ${s.celular} verificado</div>
            <label class="campo campo--grande ${nombreInvalido() ? "is-invalid" : ""}">
              ${icono("usuario", 18)}
              <input id="rv-nombre" value="${s.nombre}" placeholder="Nombre completo" autocomplete="name" maxlength="100" aria-label="Nombre completo"
                aria-invalid="${nombreInvalido() ? "true" : "false"}" />
            </label>
            ${nombreInvalido() ? html`<div class="invalid-feedback d-block">Escribe tu nombre completo (mínimo 3 letras).</div>` : ""}
            ${s.equipos.length > 0 && flujo() === "GENERAL"
              ? html`<p class="wz__pista">${icono("tv", 16)} Tienes ${s.equipos.length} equipo(s) registrado(s) con nosotros. Puedes ver su estado en “Consultar mi turno”.</p>`
              : ""}`}
      ${pie(html`<button type="button" class="btn btn--primario" data-accion="siguiente" ${!s.token || !nombreValido() ? "disabled" : ""}>Continuar</button>`)}`;
  }

  function vistaEquipo() {
    const activos = s.equipos.filter((e) => e.estado !== "ENTREGADO");
    const elegido = equipoSel();
    return html`
      <h2 class="wz__titulo">¿Qué equipo vas a recoger?</h2>
      <p class="wz__texto">Estos son los equipos registrados con tu celular. Puedes reservar la entrega de los que ya están listos.</p>
      <div class="wz__equipos">
        ${activos.map((e, i) => {
          const est = ESTADOS_EQUIPO[e.estado] || {};
          const listo = e.estado === "LISTO";
          return html`
            <button type="button" ${listo ? "" : "disabled"} style="animation-delay: ${i * 60}ms" data-accion="elegir-equipo" data-id="${e.id}"
              class="${clases("wz__equipo", String(e.id) === s.equipoId && "activo", listo && "wz__equipo--listo")}">
              <span class="wz__equipo-icono">${icono("tv", 24)}</span>
              <span class="wz__equipo-info">
                <strong>${e.marca} ${e.modelo}</strong>
                <small>${e.codigo} · ${e.sede}</small>
                <span class="wz__progreso" aria-label="${est.texto}">
                  ${[1, 2, 3].map((k) => html`<i class="${est.paso >= k ? "hecho" : ""}"></i>`)}
                </span>
                ${e.nota ? html`<small class="wz__equipo-nota">${e.nota}</small>` : ""}
              </span>
              <span class="estado estado--${est.tono}">${est.texto}</span>
            </button>`;
        })}
        ${activos.length
          ? ""
          : html`
              <div class="wz__vacio">
                ${icono("tv", 28)}
                <strong>No encontramos equipos pendientes con este celular</strong>
                <span>Si trajiste un equipo, revisa que sea el mismo número. También puedes elegir otro servicio.</span>
                <button type="button" class="btn btn--borde" data-accion="a-tramites">Elegir otro servicio</button>
              </div>`}
      </div>
      ${elegido
        ? html`<p class="rv__prep" role="note">${icono("paquete", 17)}<span><strong>Lo alistamos antes de que llegues.</strong> Tu ${elegido.marca} te espera probado en ${elegido.sede}. Trae tu cédula para recibirlo.</span></p>`
        : ""}
      ${pie(html`<button type="button" class="btn btn--primario" data-accion="siguiente" ${elegido ? "" : "disabled"}>Continuar</button>`)}`;
  }

  function vistaGarantia() {
    const g = s.garantia;
    const marcas = s.marcas.length ? s.marcas : ["Samsung", "LG", "Sony", "TCL", "Hisense", "Otra"];
    const vigente = garantiaVigente();
    const vence = garantiaVence();
    return html`
      <h2 class="wz__titulo">Cuéntanos de tu televisor</h2>
      <p class="wz__texto">La garantía cubre televisores con máximo 1 año desde la compra.</p>
      <span class="etiqueta">Marca</span>
      <div class="wz__chips">
        ${marcas.map((m) => html`<button type="button" class="wz__chip ${g.marca === m ? "activo" : ""}" data-accion="marca-garantia" data-valor="${m}">${m}</button>`)}
      </div>
      <div class="rv__fila rv__fila--2">
        <label>
          <span class="etiqueta">Fecha de compra</span>
          <span class="campo ${g.fecha_compra ? (vigente ? "campo--ok" : "is-invalid") : ""}">
            ${icono("calendario", 17)}
            <input id="rv-g-fecha" data-garantia="fecha_compra" type="date" value="${g.fecha_compra}" max="${hoyISO()}" aria-label="Fecha de compra"
              aria-invalid="${g.fecha_compra && !vigente ? "true" : "false"}" />
          </span>
          ${g.fecha_compra && !vigente ? html`<span class="invalid-feedback d-block">La compra supera 1 año: no aplica garantía.</span>` : ""}
        </label>
        <label>
          <span class="etiqueta">Modelo o tamaño (opcional)</span>
          <span class="campo">${icono("tv", 17)}<input id="rv-g-modelo" data-garantia="modelo" value="${g.modelo}" maxlength="60" placeholder='Ej. 55" 4K' /></span>
        </label>
      </div>
      ${g.fecha_compra
        ? html`
            <p class="wz__garantia ${vigente ? "wz__garantia--ok" : "wz__garantia--no"}" role="status">
              ${icono(vigente ? "escudo2" : "alerta", 17)}
              <span>
                ${vigente
                  ? html`En garantía hasta el <strong>${fechaConAnio(vence)}</strong>.`
                  : g.fecha_compra > hoyISO()
                    ? "La fecha de compra no puede ser futura."
                    : html`La garantía venció el ${fechaConAnio(vence)}. Puedes reservar un <button type="button" class="enlace" data-accion="a-tramites">diagnóstico</button>.`}
              </span>
            </p>`
        : ""}
      <label>
        <span class="etiqueta">¿Qué le pasa?</span>
        <span class="campo"><textarea id="rv-g-falla" data-garantia="falla" rows="2" maxlength="300" placeholder="Ej. No enciende, la luz parpadea">${g.falla}</textarea></span>
      </label>
      ${pie(html`<button type="button" class="btn btn--primario" data-accion="siguiente" ${garantiaLista() ? "" : "disabled"}>Continuar</button>`)}`;
  }

  function vistaReclamo() {
    if (s.reclamoCreado && !s.reclamoCreado.presencial) {
      return html`
        <div class="wz__exito">
          <span class="listo__icono">${icono("check", 26, { grosor: 2.4 })}</span>
          <h2>Reclamo radicado</h2>
          <div class="listo__codigo">${s.reclamoCreado.radicado}</div>
          <p>Un asesor de ${s.reclamoCreado.sede} lo gestionará y verás la respuesta en <strong>Consultar mi turno → Por celular</strong>. No necesitas desplazarte.</p>
          <button type="button" class="btn btn--primario" data-accion="reiniciar">Hacer otra solicitud</button>
        </div>`;
    }
    const r = s.reclamo;
    const largo = r.descripcion.trim().length;
    const botonDerecho = s.reclamoCreado?.presencial
      ? html`<button type="button" class="btn btn--primario" data-accion="siguiente">Elegir horario</button>`
      : html`<button type="button" class="btn btn--primario" data-accion="radicar" ${!reclamoListo() || s.ocupado ? "disabled" : ""}>
          ${s.ocupado ? cargando("Enviando…") : r.presencial ? "Radicar y elegir horario" : "Radicar reclamo"}
        </button>`;
    return html`
      <h2 class="wz__titulo">Cuéntanos qué pasó</h2>
      <span class="etiqueta">Motivo</span>
      <div class="wz__chips">
        ${Object.entries(s.categorias).map(([k, v]) => html`<button type="button" class="wz__chip ${r.categoria === k ? "activo" : ""}" data-accion="categoria" data-valor="${k}">${v}</button>`)}
      </div>
      <div class="rv__fila rv__fila--2">
        ${selector({
          etiqueta: "Sede", icon: "pin", campo: "sede", valor: s.sede, placeholder: "¿En qué sede?",
          opciones: s.sedes.map((x) => html`<option value="${x.id}" ${String(x.id) === String(s.sede) ? "selected" : ""}>${x.nombre}</option>`),
        })}
        ${selector({
          etiqueta: "Equipo relacionado (opcional)", icon: "tv", campo: "reclamo-equipo", valor: r.equipo_id,
          placeholder: s.equipos.length ? "Ninguno" : "Sin equipos registrados", deshabilitado: !s.equipos.length,
          opciones: s.equipos.map((e) => html`<option value="${e.id}" ${String(e.id) === String(r.equipo_id) ? "selected" : ""}>${e.marca} ${e.modelo || ""} · ${e.codigo}</option>`),
        })}
      </div>
      <label>
        <span class="etiqueta">Tu reclamo</span>
        <span class="campo"><textarea id="rv-reclamo" rows="3" maxlength="1500" placeholder="Escribe con tus palabras qué pasó y qué esperas que hagamos.">${r.descripcion}</textarea></span>
        <small class="formulario__ayuda" data-contador>${largo < 15 ? `Mínimo 15 caracteres (${largo}/15)` : `${r.descripcion.length}/1500`}</small>
      </label>
      <span class="etiqueta">¿Cómo quieres seguirlo?</span>
      <div class="wz__modos">
        <button type="button" class="wz__modo ${r.presencial === false ? "activo" : ""}" data-accion="modo-reclamo" data-valor="linea">
          ${icono("enviar", 20)}<strong>En línea</strong><small>Lo radicamos ya y ves la respuesta en “Consultar mi turno”.</small>
        </button>
        <button type="button" class="wz__modo ${r.presencial === true ? "activo" : ""}" data-accion="modo-reclamo" data-valor="persona">
          ${icono("usuario", 20)}<strong>En persona</strong><small>Lo radicamos y reservas un turno para hablar con un asesor.</small>
        </button>
      </div>
      ${pie(botonDerecho)}`;
  }

  function vistaHorario() {
    const f = flujo();
    const sedeFija = (f === "ENTREGA" && equipoSel()) || (f === "RECLAMO" && s.reclamoCreado);
    const elegida = franjaSel();
    const primera = s.franjas[0];
    const dias = Array.from({ length: DIAS_VISIBLES }, (_, i) => hoyISO(s.inicioDias + i));
    const grupos = JORNADAS.map((j) => [j, s.franjas.filter((x) => jornada(x) === j)]).filter(([, lista]) => lista.length);
    const textoHora = !s.sede
      ? "Primero elige la sede"
      : s.cargandoFranjas
        ? "Buscando horarios…"
        : s.franjas.length
          ? `${s.franjas.length} horarios disponibles`
          : "Sin horarios este día";
    return html`
      <h2 class="wz__titulo">¿Cuándo vienes?</h2>
      ${sedeFija
        ? html`<p class="wz__pista">${icono("pin", 16)} ${sedeSel()?.nombre} · ${sedeSel()?.direccion}</p>`
        : selector({
            etiqueta: "Sede", icon: "pin", campo: "sede-horario", valor: s.sede, placeholder: "¿Dónde te atendemos?",
            opciones: s.sedes.map((x) => html`<option value="${x.id}" ${String(x.id) === String(s.sede) ? "selected" : ""}>${x.nombre} · ${x.direccion || ""}</option>`),
          })}
      <div class="rv__dias ${s.sede ? "" : "rv__bloque--espera"}">
        <button type="button" class="rv__flecha" data-accion="dias-atras" ${s.inicioDias === 0 ? "disabled" : ""} aria-label="Días anteriores">${icono("izquierda", 16)}</button>
        ${dias.map(
          (d, i) => html`
            <button type="button" class="rv__dia ${s.fecha === d ? "rv__dia--activo" : ""}" aria-pressed="${s.fecha === d}" aria-label="${fechaCorta(d)}"
              data-accion="elegir-dia" data-valor="${d}" ${s.sede ? "" : "disabled"}>
              <small>${s.inicioDias + i === 0 ? "Hoy" : diaSemana(d)}</small>
              <strong>${diaMes(d)}</strong>
            </button>`,
        )}
        <button type="button" class="rv__flecha" data-accion="dias-adelante" ${s.inicioDias >= 28 ? "disabled" : ""} aria-label="Días siguientes">${icono("derecha", 16)}</button>
      </div>
      <div class="wz__hora-sel" aria-live="polite">
        <label class="dd">
          <span class="dd__label">Hora · ${fechaLarga(s.fecha)}</span>
          <span class="campo campo--select">
            ${icono("reloj", 17)}
            <select data-campo="franja" ${!s.sede || s.cargandoFranjas || !s.franjas.length ? "disabled" : ""}>
              <option value="">${textoHora}</option>
              ${grupos.map(
                ([j, lista]) => html`
                  <optgroup label="${j}">
                    ${lista.map((x) => {
                      const cupos = x.disponibles === 1 ? " · último cupo" : x.disponibles != null ? ` · ${x.disponibles} cupos` : "";
                      return html`<option value="${x.franja_id}" ${String(x.franja_id) === String(s.franja) ? "selected" : ""}>${rango(x)}${cupos}</option>`;
                    })}
                  </optgroup>`,
              )}
            </select>
          </span>
        </label>
        ${s.sede && !s.cargandoFranjas && primera && !elegida
          ? html`<button type="button" class="wz__sugerida" data-accion="sugerida">${icono("rayo", 15)} Lo más pronto: <strong>${rango(primera)}</strong></button>`
          : ""}
        ${s.sede && !s.cargandoFranjas && !s.franjas.length ? html`<p class="rv__nota">No quedan horarios ese día. Prueba con otra fecha.</p>` : ""}
        ${elegida ? html`<p class="wz__hora-elegida">${icono("check", 15)} ${fechaLarga(s.fecha)} · <strong>${rango(elegida)}</strong></p>` : ""}
      </div>
      ${pie(html`<button type="button" class="btn btn--primario" data-accion="siguiente" ${elegida ? "" : "disabled"}>Continuar</button>`)}`;
  }

  function vistaConfirmar() {
    const f = flujo();
    const eq = equipoSel();
    const g = s.garantia;
    const franja = franjaSel();
    const filas = [
      ["Servicio", tramite()?.nombre],
      f === "ENTREGA" && eq && ["Equipo", `${eq.marca} ${eq.modelo || ""} · ${eq.codigo}`],
      f === "GARANTIA" && ["Televisor", `${g.marca}${g.modelo ? ` ${g.modelo}` : ""} · compra ${fechaCorta(g.fecha_compra)}`],
      f === "RECLAMO" && s.reclamoCreado && ["Reclamo", s.reclamoCreado.radicado],
      ["Sede", sedeSel()?.nombre],
      ["Cuándo", franja ? `${fechaLarga(s.fecha)}, ${rango(franja)}` : ""],
      ["A nombre de", s.nombre.trim()],
      ["Celular", s.celular],
    ].filter(Boolean);
    const prep = PREP_CLIENTE[f];
    return html`
      <h2 class="wz__titulo">Revisa y confirma</h2>
      <dl class="wz__resumen">${filas.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
      ${prep ? html`<p class="rv__prep" role="note">${icono(prep.icono, 17)}<span><strong>${prep.titulo}</strong> ${prep.texto}</span></p>` : ""}
      ${f === "RECLAMO" && s.reclamoCreado
        ? html`<p class="rv__prep" role="note">${icono("mensaje", 17)}<span><strong>Tu reclamo ${s.reclamoCreado.radicado} ya está radicado.</strong> El asesor lo tendrá a la mano cuando llegues.</span></p>`
        : ""}
      ${pie(html`<button type="button" class="btn btn--primario btn--grande" data-accion="confirmar" ${s.ocupado ? "disabled" : ""}>${s.ocupado ? cargando("Reservando…") : "Confirmar turno"}</button>`)}`;
  }

  const VISTAS = {
    tramite: vistaTramite, celular: vistaCelular, equipo: vistaEquipo, garantia: vistaGarantia,
    reclamo: vistaReclamo, horario: vistaHorario, confirmar: vistaConfirmar,
  };

  // ------------------------------------------------------------ pintar
  let pasoPintado = null;
  function render() {
    if (!vivo) return;
    const lista = pasos();
    const i = indice();
    const pasoNuevo = pasoPintado !== s.paso;
    pintar(
      contenedor,
      html`
        <div class="wz ${pasoNuevo ? "" : "repintado"}">
          <ol class="wz__pasos" aria-label="Pasos de la reserva">
            ${lista.map(
              (p, k) => html`
                <li class="${clases(k < i && "hecho", k === i && "actual")}" ${k === i ? 'aria-current="step"' : ""}>
                  <span>${k < i ? icono("check", 12, { grosor: 3 }) : k + 1}</span>
                  <small>${PASOS[p]}</small>
                </li>`,
            )}
          </ol>
          <div class="wz__barra" aria-hidden="true"><span style="width: ${(i / Math.max(1, lista.length - 1)) * 100}%"></span></div>
          <section class="wz__paso ${s.direccion < 0 ? "wz__paso--atras" : ""}">${VISTAS[s.paso]()}</section>
          ${mensajeError(s.error)}
        </div>`,
    );
    if (pasoNuevo) {
      pasoPintado = s.paso;
      if (s.paso === "celular") contenedor.querySelector(s.token ? "#rv-nombre" : "#rv-celular")?.focus();
    }
    resumir();
  }

  // ------------------------------------------------------------ eventos
  const acciones = {
    "elegir-tramite": (b) => {
      const t = s.tramites.find((x) => String(x.id) === b.dataset.id);
      s.tramiteId = String(t.id);
      s.equipoId = "";
      s.reclamo = { categoria: "", descripcion: "", equipo_id: "", presencial: null };
      s.franja = "";
      ir(s.token ? pasosDe(t.tipo_flujo, false)[2] : "celular");
    },
    atras,
    siguiente,
    "enviar-codigo": enviarCodigo,
    "usar-codigo": () => cambiarCodigo(s.codigoPrueba),
    "elegir-equipo": (b) => {
      const e = s.equipos.find((x) => String(x.id) === b.dataset.id);
      s.equipoId = String(e.id);
      s.sede = String(e.punto_id);
      render();
    },
    "a-tramites": () => ir("tramite", -1),
    "marca-garantia": (b) => {
      s.garantia.marca = b.dataset.valor;
      render();
    },
    categoria: (b) => {
      s.reclamo.categoria = b.dataset.valor;
      render();
    },
    "modo-reclamo": (b) => {
      s.reclamo.presencial = b.dataset.valor === "persona";
      render();
    },
    radicar: radicarReclamo,
    reiniciar,
    "dias-atras": () => {
      s.inicioDias = Math.max(0, s.inicioDias - DIAS_VISIBLES);
      render();
    },
    "dias-adelante": () => {
      s.inicioDias = Math.min(28, s.inicioDias + DIAS_VISIBLES);
      render();
    },
    "elegir-dia": (b) => {
      s.fecha = b.dataset.valor;
      s.franja = "";
      cargarFranjas();
    },
    sugerida: () => {
      s.franja = String(s.franjas[0].franja_id);
      render();
    },
    confirmar,
  };

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (b && !b.disabled && acciones[b.dataset.accion]) acciones[b.dataset.accion](b);
  });

  contenedor.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "rv-celular") {
      s.celular = soloDigitos(el.value, 10);
      s.token = "";
      s.codigoEnviado = false;
      s.codigo = "";
      s.conocido = false;
      s.equipos = [];
      render();
    } else if (el.id === "rv-codigo") cambiarCodigo(el.value);
    else if (el.id === "rv-nombre") {
      s.nombre = el.value;
      render();
    } else if (el.dataset.garantia) {
      s.garantia[el.dataset.garantia] = el.value;
      render();
    } else if (el.id === "rv-reclamo") {
      s.reclamo.descripcion = el.value;
      render();
    }
  });

  contenedor.addEventListener("change", (e) => {
    const campo = e.target.dataset.campo;
    if (campo === "sede") {
      s.sede = e.target.value;
      render();
    } else if (campo === "reclamo-equipo") {
      s.reclamo.equipo_id = e.target.value;
      render();
    } else if (campo === "sede-horario") {
      s.sede = e.target.value;
      s.franja = "";
      cargarFranjas();
      render();
    } else if (campo === "franja") {
      s.franja = e.target.value;
      render();
    }
  });

  // ------------------------------------------------------------ carga inicial
  render();
  Promise.all([
    publicoApi.listarSedes(),
    publicoApi.listarTramites(),
    publicoApi.catalogoEquipos().catch(() => null),
    publicoApi.catalogoReclamos().catch(() => null),
  ])
    .then(([sedes, tramites, ce, cr]) => {
      s.sedes = sedes?.puntos || [];
      s.tramites = tramites?.tramites || [];
      s.marcas = ce?.marcas || [];
      s.categorias = cr?.categorias || {};
    })
    .catch((e) => {
      s.error = e.message;
    })
    .finally(() => {
      s.cargando = false;
      render();
    });

  return () => {
    vivo = false;
  };
}
