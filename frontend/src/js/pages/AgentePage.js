/**
 * Consola del asesor con asistente de despacho. Ruta: #/agente (rol AGENTE)
 *
 * Secciones: Atención (puesto + cola), Equipos (taller) y Reclamos.
 * Se actualiza sola: panel cada 5 s, reclamos cada 12 s y reloj cada segundo.
 */
import * as agenteApi from "../api/agente.api.js";
import { listarSedes } from "../api/publico.api.js";
import { montarEquipos } from "../components/agente/equipos.js";
import { abrirFormularioEquipo } from "../components/agente/formularioEquipo.js";
import { abrirPrepararTurno, insigniaPreparacion } from "../components/agente/prepararTurno.js";
import { presenciaHTML } from "../components/agente/presencia.js";
import { montarReclamos } from "../components/agente/reclamos.js";
import { abrirVerificarCedula } from "../components/agente/verificarCedula.js";
import { marca, saltarAlContenido } from "../components/layout/marca.js";
import { montarAsistenteIA } from "../components/ui/asistenteIA.js";
import { abrirCambiarMiClave } from "../components/ui/cambiarClave.js";
import { icono } from "../components/ui/icon.js";
import { confirmar } from "../components/ui/modal.js";
import { avisar } from "../components/ui/toast.js";
import { html, pintarSiCambia } from "../utils/dom.js";
import {
  codigoTurno, duracion, ESTADOS_EQUIPO, fechaCorta, horaDe, iniciales, PREPARACION, PRESENCIAS, primerNombre, textoPreparacion,
  valorRespuesta, ZONA,
} from "../utils/formatters.js";
import { crearSondeo } from "../utils/polling.js";
import { anunciar, crearLlamadoPorVoz, destinoHablado } from "../utils/voz.js";

const LLEGADA_MAX_SEG = 180;
const PUNTUALIDAD = {
  a_tiempo: { texto: "A tiempo", tono: "ok" },
  en_riesgo: { texto: "En riesgo", tono: "riesgo" },
  atrasado: { texto: "Atrasado", tono: "atrasado" },
  proxima: { texto: "Próxima franja", tono: "proxima" },
};
const ICONO_ACCION = {
  llamar: "megafono", pausa: "reloj", adelantar: "derecha", iniciar: "atender", ausente: "ausente",
  finalizar: "finalizado", atendiendo: "atender", esperar: "check", preparar: "paquete",
};
const ETAPAS = [
  { estado: "LLAMADO", texto: "Llamado", icono: "megafono" },
  { estado: "EN_ATENCION", texto: "En atención", icono: "atender" },
  { estado: "ATENDIDO", texto: "Finalizado", icono: "finalizado" },
];

const reloj = (ms) =>
  new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: ZONA }).format(new Date(ms));
function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Progreso del turno en el puesto: Llamado → En atención → Finalizado. */
function etapasHTML(estado) {
  const actual = ETAPAS.findIndex((e) => e.estado === estado);
  return html`
    <ol class="etapas" aria-label="Etapa del turno">
      ${ETAPAS.map(
        (e, i) => html`
          <li class="etapas__paso ${i < actual ? "etapas__paso--hecho" : ""} ${i === actual ? "etapas__paso--actual" : ""}" ${i === actual ? 'aria-current="step"' : ""}>
            <span class="etapas__icono">${icono(i < actual ? "check" : e.icono, 16)}</span>
            <span class="etapas__texto">${e.texto}</span>
          </li>`,
      )}
    </ol>`;
}

/** Cronómetro: el tiempo lo llena tick() cada segundo. */
const cronoHTML = (desde, limite, etiqueta) => html`
  <div class="crono crono--verde" data-crono data-desde="${desde || ""}" data-limite="${limite}">
    <div class="crono__cifras"><strong data-crono-tiempo>0:00</strong><span>${etiqueta} · máximo ${mmss(limite)}</span></div>
    <div class="crono__pista"><span data-crono-barra style="width: 0%"></span></div>
  </div>`;

export function AgentePage() {
  return html`
    <div class="ag">
      ${saltarAlContenido()}
      <header class="ag__barra" data-barra></header>
      <div data-avisos></div>
      <nav class="ag__tabs" aria-label="Secciones de la consola" data-tabs></nav>
      <div data-seccion></div>
      <div class="alertas" aria-live="assertive" data-alertas></div>
      <div data-ia></div>
    </div>`;
}

export function mountAgentePage({ usuario, onSalir, onUsuario }) {
  const raiz = document.querySelector(".ag");
  const zona = (nombre) => raiz.querySelector(`[data-${nombre}]`);

  // ------------------------------------------------------------ estado
  const s = {
    sedes: [],
    seccion: "atencion",
    ocupado: false,
    pausaHasta: null,
    presenciaAbierta: false,
    verProximos: false,
    cierre: null,
    recienLlegados: new Set(),
    reclamosPendientes: null,
    alertas: [],
  };
  let desfase = 0;
  let limpiarSeccion = null;
  let colaVista = null;
  let conocidosHoy = null;
  let previoSinLeer = null;
  const avisadas = new Set();
  const accionesAlerta = {};
  const voz = crearLlamadoPorVoz();
  const temporizadores = new Set();
  const despues = (ms, fn) => {
    const t = window.setTimeout(() => {
      temporizadores.delete(t);
      fn();
    }, ms);
    temporizadores.add(t);
  };

  const ahora = () => Date.now() + desfase;
  const p = () => panel.estado.datos;
  const actual = () => p()?.actual;

  // ------------------------------------------------------------ acciones
  async function ejecutar(accion, exito, alTerminar) {
    s.ocupado = true;
    render();
    try {
      const r = await accion();
      avisar(exito || r.mensaje);
      s.pausaHasta = null;
      alTerminar?.(r);
    } catch (e) {
      avisar(e.message, "error");
    }
    s.ocupado = false;
    panel.refrescar();
  }

  const llamar = (turnoId) =>
    turnoId && p()?.cola?.[0]?.id !== turnoId
      ? ejecutar(() => agenteApi.llamar(turnoId), "Turno llamado.")
      : ejecutar(agenteApi.llamarSiguiente, "Turno llamado.");

  /** Al finalizar se muestra un cierre breve (2,4 s) antes de liberar el puesto. */
  function finalizar(turno) {
    ejecutar(() => agenteApi.finalizar(turno.id), "Atención finalizada.", () => {
      s.cierre = {
        nombre: turno.usuario_nombre,
        codigo: codigoTurno(turno),
        seg: turno.fecha_inicio ? (ahora() - Date.parse(turno.fecha_inicio)) / 1000 : null,
      };
      despues(2400, () => {
        s.cierre = null;
        render();
      });
    });
  }

  async function cambiarPresencia(nueva, { silencioso = false } = {}) {
    try {
      const r = await agenteApi.cambiarPresencia(nueva);
      if (!silencioso) avisar(r.mensaje);
      panel.refrescar();
    } catch (e) {
      avisar(e.message, "error");
    }
  }
  function iniciarPausa(segundos) {
    s.pausaHasta = ahora() + segundos * 1000;
    cambiarPresencia("PAUSA", { silencioso: true });
    render();
  }
  function terminarPausa() {
    s.pausaHasta = null;
    cambiarPresencia("DISPONIBLE", { silencioso: true });
    render();
  }

  /** Entregar o recibir un equipo exige verificar la cédula del titular. */
  async function moverEquipo(equipo, estado) {
    if (estado === "ENTREGADO" || (estado === "RECIBIDO" && equipo.estado === "POR_RECIBIR")) {
      abrirVerificarCedula({
        equipo,
        estado,
        nombre: actual()?.usuario_nombre,
        alListo: (r) => {
          avisar(r.mensaje);
          panel.refrescar();
        },
      });
      return;
    }
    try {
      const r = await agenteApi.cambiarEstadoEquipo(equipo.id, estado);
      avisar(r.mensaje);
      panel.refrescar();
    } catch (e) {
      avisar(e.message, "error");
    }
  }

  function abrirPreparar(turnoId) {
    const t = [actual(), ...(p()?.cola || [])].find((x) => x && x.id === turnoId);
    if (!t) return;
    abrirPrepararTurno(t, (r) => {
      avisar(r.mensaje);
      panel.refrescar();
    });
  }

  function pedirCambioSede(id) {
    const sede = s.sedes.find((x) => String(x.id) === String(id));
    if (!sede || sede.id === p()?.agente?.sede_id) return;
    confirmar({
      titulo: "Cambiar de sede",
      mensaje: `Vas a atender en ${sede.nombre}. Tu cola cambia a la de esa sede y el cupo de ambas sedes se recalcula (3 personas por asesor cada 30 min).`,
      textoConfirmar: `Atender en ${sede.nombre}`,
      peligro: false,
      alConfirmar: async () => {
        const r = await agenteApi.cambiarSede(sede.id);
        s.pausaHasta = null;
        avisar(r.mensaje);
        anunciar(r.mensaje);
        panel.refrescar();
      },
    });
    // Si cancela, el desplegable vuelve a la sede actual.
    zona("barra").__ultimoHTML = null;
    renderBarra();
  }

  function cambiarSeccion(seccion) {
    if (s.seccion === seccion) return;
    s.seccion = seccion;
    limpiarSeccion?.();
    limpiarSeccion = null;
    zona("seccion").__ultimoHTML = null;
    zona("seccion").innerHTML = "";
    if (seccion === "equipos" || seccion === "reclamos") {
      const main = document.createElement("main");
      main.className = "ag__seccion";
      main.id = "contenido";
      main.tabIndex = -1;
      zona("seccion").appendChild(main);
      limpiarSeccion =
        seccion === "equipos"
          ? montarEquipos(main)
          : montarReclamos(main, {
              onPendientes: (n) => {
                s.reclamosPendientes = n;
                renderTabs();
              },
            });
    }
    render();
  }

  // ------------------------------------------------------------ alertas emergentes del asistente
  function emitir(clave, alerta) {
    if (avisadas.has(clave)) return;
    avisadas.add(clave);
    if (alerta.accion) accionesAlerta[clave] = alerta.accion.fn;
    s.alertas = [...s.alertas.slice(-2), { clave, ...alerta }];
    anunciar(alerta.titulo);
    renderAlertas();
    despues(12000, () => cerrarAlerta(clave));
  }
  function cerrarAlerta(clave) {
    s.alertas = s.alertas.filter((a) => a.clave !== clave);
    delete accionesAlerta[clave];
    renderAlertas();
  }

  /** Fin de franja cerca y siguiente persona atrasada (se revisa cada segundo, sin repetir). */
  function revisarAlertas() {
    const datos = p();
    const franja = datos?.franja_actual;
    if (franja) {
      const restante = franja.restante_seg - (ahora() - Date.parse(datos.ahora)) / 1000;
      const pendientes = Math.max(0, franja.reservados - franja.atendidos);
      if (restante > 0 && restante <= 300 && pendientes > 0) {
        emitir(`franja-${franja.inicio}`, {
          tono: "riesgo", icono: "reloj",
          titulo: `Quedan ${Math.ceil(restante / 60)} min de la franja ${franja.inicio}–${franja.fin}`,
          detalle: `${pendientes} persona(s) de esta franja aún sin atender. Prioriza a quien está en riesgo.`,
        });
      }
    }
    const sig = datos?.cola?.find((t) => t.es_hoy);
    if (sig && !actual() && ["atrasado", "en_riesgo"].includes(sig.puntualidad)) {
      emitir(`tarde-${sig.id}-${sig.puntualidad}`, {
        tono: sig.puntualidad === "atrasado" ? "atrasado" : "riesgo", icono: "megafono",
        titulo: `${primerNombre(sig.usuario_nombre)} ${sig.puntualidad === "atrasado" ? "ya está fuera de su franja" : "está por salirse de su franja"}`,
        detalle: `Turno ${codigoTurno(sig)} · ${sig.tramite_nombre}. El asistente recomienda llamarle ya.`,
        accion: { texto: `Llamar a ${primerNombre(sig.usuario_nombre)}`, fn: () => llamar(sig.id) },
      });
    }
  }

  // ------------------------------------------------------------ vistas
  function barraHTML() {
    const datos = p();
    const franja = datos?.franja_actual;
    const modulo = datos?.agente?.modulo || "";
    const presencia = datos?.agente?.presencia || "DISPONIBLE";
    return html`
      ${marca()}
      <div class="ag__sede">
        <span class="campo campo--select campo--barra">
          ${icono("edificio", 17)}
          <select data-campo="sede" aria-label="Sede donde atiendes" ${s.sedes.length ? "" : "disabled"}>
            ${datos?.agente?.sede_id ? "" : html`<option value="">Elige tu sede</option>`}
            ${s.sedes.map((x) => html`<option value="${x.id}" ${x.id === datos?.agente?.sede_id ? "selected" : ""}>${x.nombre}</option>`)}
          </select>
        </span>
        <small>${usuario.nombre}${modulo ? ` · ${modulo}` : ""}</small>
      </div>
      <div class="ag__franja-chip">
        ${franja
          ? html`<span><span class="ag__franja-etq">Franja </span>${franja.inicio}–${franja.fin}</span><strong data-franja-restante>quedan —</strong>`
          : html`<span>${datos && !datos.en_horario ? `Fuera de horario · ${datos.horario?.hora_apertura}–${datos.horario?.hora_cierre}` : "—"}</span>`}
      </div>
      <time class="ag__reloj" aria-label="Hora actual" data-reloj></time>
      ${presenciaHTML({ valor: presencia, desde: datos?.agente?.presencia_desde, bloqueado: Boolean(actual()), abierto: s.presenciaAbierta })}
      <button type="button" class="ag__voz ${voz.estado.activo ? "ag__voz--on" : ""}" aria-pressed="${voz.estado.activo}" data-accion="voz"
        title="${voz.soportado ? "Anunciar por voz el turno llamado (se repite cada 20 s)" : "Este navegador no permite voz"}" ${voz.soportado ? "" : "disabled"}>
        ${icono(voz.estado.activo ? "volumen" : "silencio", 17)}<span>Voz ${voz.estado.activo ? "activada" : "apagada"}</span>
      </button>
      <button class="icono-btn ag__salir" data-accion="clave" title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña">${icono("llave", 18)}</button>
      <button class="icono-btn ag__salir" data-accion="salir" title="Cerrar sesión" aria-label="Cerrar sesión">${icono("salir", 19)}</button>`;
  }

  function tabsHTML() {
    const tabs = [
      ["atencion", "Atención", "atender", p()?.resumen?.en_espera_hoy],
      ["equipos", "Equipos", "tv", null],
      ["reclamos", "Reclamos", "mensaje", s.reclamosPendientes],
    ];
    return tabs.map(
      ([id, texto, ic, n]) => html`
        <button type="button" class="${s.seccion === id ? "activo" : ""}" ${s.seccion === id ? 'aria-current="page"' : ""} data-accion="seccion" data-valor="${id}">
          ${icono(ic, 16)} ${texto}${n ? html`<small>${n}</small>` : ""}
        </button>`,
    );
  }

  function botonesAsistente(rec) {
    if (!rec || s.pausaHasta) return "";
    const id = rec.turno_id;
    const persona = primerNombre(rec.turno_nombre) || codigoTurno(rec.turno_codigo);
    const ocupado = s.ocupado ? "disabled" : "";
    switch (rec.accion) {
      case "llamar":
        return html`<button class="btn btn--primario" data-accion="llamar" data-id="${id}" ${ocupado}>${icono("megafono", 17)} Llamar a ${persona}</button>`;
      case "pausa":
        return html`
          <button class="btn btn--primario" data-accion="pausa" data-seg="${rec.pausa_seg}">${icono("reloj", 17)} Tomar pausa de ${mmss(rec.pausa_seg)}</button>
          <button class="btn btn--borde-claro" data-accion="llamar" data-id="${id}" ${ocupado}>Llamar ahora</button>`;
      case "adelantar":
        return html`
          <button class="btn btn--primario" data-accion="llamar" data-id="${id}" ${ocupado}>${icono("derecha", 17)} Adelantar a ${persona}</button>
          ${rec.pausa_seg > 60 ? html`<button class="btn btn--borde-claro" data-accion="pausa" data-seg="${Math.min(rec.pausa_seg, 180)}">Pausa ${mmss(Math.min(rec.pausa_seg, 180))}</button>` : ""}`;
      case "iniciar":
        return html`<button class="btn btn--primario" data-accion="iniciar" data-id="${id}" ${ocupado}>${icono("atender", 17)} Iniciar atención</button>`;
      case "ausente":
        return html`
          <button class="btn btn--primario" data-accion="no-asistio" data-id="${id}" ${ocupado}>${icono("ausente", 17)} Marcar no asistió</button>
          <button class="btn btn--borde-claro" data-accion="iniciar" data-id="${id}" ${ocupado}>Ya llegó, iniciar</button>`;
      case "finalizar":
        return html`<button class="btn btn--primario" data-accion="finalizar" ${s.ocupado || !actual() ? "disabled" : ""}>${icono("finalizado", 17)} Finalizar atención</button>`;
      case "preparar":
        return html`
          <button class="btn btn--primario" data-accion="preparar" data-id="${id}">${icono("paquete", 17)} Alistar lo de ${persona}</button>
          <button class="btn btn--borde-claro" data-accion="llamar" data-id="${id}" ${ocupado}>Llamar ahora</button>`;
      default:
        return "";
    }
  }

  function asistenteHTML() {
    const rec = p()?.recomendacion;
    if (s.pausaHasta) {
      return html`
        <section class="asistente asistente--pausa" aria-live="polite">
          ${icono("reloj", 22)}
          <div class="asistente__texto">
            <span class="asistente__tag">Pausa activa</span>
            <h2 data-pausa-restante>—</h2>
            <p>Levántate, estira cuello y espalda, toma agua. La franja va a tiempo.</p>
          </div>
          <div class="asistente__acciones"><button class="btn btn--primario" data-accion="terminar-pausa">Terminar pausa</button></div>
        </section>`;
    }
    if (!rec) return html`<section class="asistente"><div class="esqueleto" style="height: 60px; width: 100%"></div></section>`;
    return html`
      <section class="asistente asistente--${rec.nivel}" aria-live="polite">
        ${icono(ICONO_ACCION[rec.accion] || "campana", 22)}
        <div class="asistente__texto">
          <span class="asistente__tag">Asistente de despacho</span>
          <h2>${rec.titulo}</h2>
          <p>${rec.motivo}</p>
        </div>
        <div class="asistente__acciones">${botonesAsistente(rec)}</div>
      </section>`;
  }

  function puestoActualHTML(t) {
    const modulo = p()?.agente?.modulo || "";
    const maxSeg = p()?.max_atencion_seg || 600;
    const eq = t.equipo;
    const estEq = eq ? ESTADOS_EQUIPO[eq.estado] : null;
    const ocupado = s.ocupado ? "disabled" : "";
    return html`
      <div class="puesto__contenido">
        <div class="puesto__cabeza">
          ${etapasHTML(t.estado)}
          <span class="puesto__franja">Reservó ${t.hora_inicio}–${t.hora_fin}</span>
        </div>
        <div class="puesto__turno">
          <span class="puesto__avatar" aria-hidden="true">${iniciales(t.usuario_nombre)}</span>
          <div>
            <h2>${t.usuario_nombre}</h2>
            <p class="puesto__datos">
              <span>${t.tramite_nombre}</span>
              <span>Turno <b class="mono">${codigoTurno(t)}</b></span>
              <span>${icono("celular", 13)} ${t.usuario_celular}</span>
              ${t.usuario_documento ? html`<span>${icono("ficha", 13)} C.C. ${t.usuario_documento}</span>` : ""}
            </p>
          </div>
        </div>
        ${t.detalle_necesidad
          ? html`<section class="puesto__necesidad" aria-label="Necesidad reportada por el ciudadano"><strong>Necesidad reportada</strong><p>${t.detalle_necesidad}</p></section>`
          : ""}
        ${t.respuestas_solicitud?.length
          ? html`
              <section class="puesto__necesidad" aria-label="Respuestas del ciudadano">
                <strong>Respuestas</strong>
                <dl>${t.respuestas_solicitud.map((r) => html`<div><dt>${r.etiqueta}</dt><dd>${valorRespuesta(r.valor)}</dd></div>`)}</dl>
              </section>`
          : ""}
        ${eq
          ? html`
              <section class="puesto__equipo" aria-label="Equipo del cliente">
                <span class="puesto__equipo-icono">${icono("tv", 20)}</span>
                <div>
                  <strong>${eq.marca} ${eq.modelo}</strong>
                  <small><span class="mono">${eq.codigo}</span> · ${eq.origen_texto}${eq.falla ? ` · ${eq.falla}` : ""}</small>
                </div>
                <span class="estado estado--${estEq?.tono}">${estEq?.texto}</span>
                ${eq.estado === "LISTO" && t.tramite_flujo === "ENTREGA"
                  ? html`<button type="button" class="btn btn--exito btn--chico" data-accion="equipo" data-estado="ENTREGADO">${icono("check", 15)} Entregar equipo</button>`
                  : ""}
                ${eq.estado === "POR_RECIBIR"
                  ? html`<button type="button" class="btn btn--primario btn--chico" data-accion="equipo" data-estado="RECIBIDO">${icono("paquete", 15)} Recibir equipo</button>`
                  : ""}
              </section>`
          : ""}
        ${t.reclamo
          ? html`
              <section class="puesto__necesidad" aria-label="Reclamo del cliente">
                <strong>Reclamo <span class="mono">${t.reclamo.radicado}</span> · ${t.reclamo.categoria_texto}</strong>
                <p>${t.reclamo.descripcion}</p>
                <button type="button" class="enlace" data-accion="seccion" data-valor="reclamos">Responder en Reclamos</button>
              </section>`
          : ""}
        ${!eq && t.estado === "EN_ATENCION" && t.tramite_flujo === "GENERAL"
          ? html`<button type="button" class="btn btn--borde btn--chico puesto__recibir" data-accion="registrar-equipo">${icono("tv", 15)} ¿Deja un equipo? Registrarlo</button>`
          : ""}
        ${t.preparacion && eq?.estado !== "ENTREGADO"
          ? html`
              <section class="puesto__prep puesto__prep--${PREPARACION[t.preparacion.estado]?.tono}" aria-label="Preparación previa">
                ${icono("paquete", 18)}
                <div><strong>${textoPreparacion(t.tramite_flujo, t.preparacion.estado)}</strong>${t.preparacion.nota ? html`<p>${t.preparacion.nota}</p>` : ""}</div>
                <button type="button" class="btn btn--suave btn--chico" data-accion="preparar" data-id="${t.id}">Actualizar</button>
              </section>`
          : ""}
        ${t.estado === "LLAMADO"
          ? html`
              <div class="llamado-voz ${voz.estado.activo ? "" : "llamado-voz--off"}" role="status">
                ${icono(voz.estado.activo ? "volumen" : "silencio", 18)}
                <span data-voz-estado>${!voz.soportado ? "Este navegador no permite anunciar por voz." : voz.estado.activo ? "Preparando el anuncio por voz…" : "Voz apagada: el turno solo se muestra en la sala."}</span>
                ${voz.soportado
                  ? html`
                      <button type="button" class="btn btn--suave btn--chico" data-accion="repetir-voz">${icono("megafono", 15)} Repetir</button>
                      <button type="button" class="btn btn--fantasma btn--chico" data-accion="voz">${voz.estado.activo ? "Silenciar" : "Activar voz"}</button>`
                  : ""}
              </div>`
          : ""}
        ${t.estado === "EN_ATENCION" ? cronoHTML(t.fecha_inicio, maxSeg, "Atendiendo") : cronoHTML(t.fecha_llamado, LLEGADA_MAX_SEG, "Esperando que llegue")}
        <div class="puesto__acciones">
          ${t.estado === "LLAMADO"
            ? html`
                <button class="btn btn--primario btn--grande" data-accion="iniciar" data-id="${t.id}" ${ocupado}>${icono("atender", 18)} Iniciar atención</button>
                <button class="btn btn--borde" data-accion="no-asistio" data-id="${t.id}" ${ocupado}>${icono("ausente", 17)} No asistió</button>
                <button class="btn btn--fantasma" data-accion="devolver" data-id="${t.id}" ${ocupado}>${icono("deshacer", 17)} Devolver a la cola</button>`
            : html`<button class="btn btn--exito btn--grande" data-accion="finalizar" ${ocupado}>${icono("finalizado", 18)} Finalizar atención</button>`}
        </div>
        ${modulo ? html`<span class="sr">Módulo ${modulo}</span>` : ""}
      </div>`;
  }

  function puestoHTML() {
    const t = actual();
    const datos = p();
    const r = datos?.resumen || {};
    const presencia = datos?.agente?.presencia || "DISPONIBLE";
    const fuera = presencia !== "DISPONIBLE" && !s.pausaHasta;
    let contenido;
    if (t) contenido = puestoActualHTML(t);
    else if (s.cierre) {
      contenido = html`
        <div class="puesto__cierre" role="status">
          <svg class="sello" viewBox="0 0 52 52" aria-hidden="true"><circle class="sello__circulo" cx="26" cy="26" r="23" /><path class="sello__check" d="m15 27 7.5 7.5L38 19" /></svg>
          <div><h2>Atención finalizada</h2><p>${s.cierre.nombre} · <span class="mono">${s.cierre.codigo}</span>${s.cierre.seg != null ? ` · ${mmss(s.cierre.seg)}` : ""}</p></div>
        </div>`;
    } else {
      contenido = html`
        <div class="puesto__libre ${fuera ? "puesto__libre--fuera" : ""}">
          <span class="puesto__icono">${icono(fuera ? PRESENCIAS[presencia]?.icono : "atender", 28)}</span>
          <div>
            ${fuera
              ? html`
                  <h2>${PRESENCIAS[presencia]?.texto}</h2>
                  <p>Desde las ${horaDe(datos?.agente?.presencia_desde)} · ${r.en_espera_hoy ?? 0} para hoy en la cola.</p>
                  <button type="button" class="enlace" data-accion="presencia" data-valor="DISPONIBLE">Volver a disponible</button>`
              : html`
                  <h2>Puesto libre</h2>
                  <p>${datos?.cola?.length ? `${r.en_espera_hoy ?? 0} para hoy · ${datos.cola.length} en total en la cola.` : "Nadie en la cola por ahora."}</p>`}
          </div>
          <button class="btn btn--primario btn--grande" data-accion="llamar" ${s.ocupado || !datos?.cola?.length || s.pausaHasta ? "disabled" : ""}>${icono("megafono", 18)} Llamar siguiente</button>
        </div>`;
    }
    return html`<section class="puesto ${t ? `puesto--${t.estado.toLowerCase()}` : s.cierre ? "puesto--cierre" : ""}">${contenido}</section>`;
  }

  function jornadaHTML() {
    const r = p()?.resumen || {};
    const maxSeg = p()?.max_atencion_seg || 600;
    const tonoPct = (v) => (v == null ? "" : v >= 90 ? "jornada__icono--ok" : "jornada__icono--alerta");
    const cifra = (v, sufijo = "") => (v == null ? "—" : `${v}${sufijo}`);
    return html`
      <section class="jornada" aria-labelledby="titulo-jornada">
        <header class="jornada__cabeza"><h2 id="titulo-jornada">${icono("grafica", 16)} Tu jornada de hoy</h2><span>${p()?.agente?.sede || "—"}</span></header>
        <div class="jornada__metricas">
          <div class="jornada__metrica"><span class="jornada__icono jornada__icono--ok">${icono("finalizado", 17)}</span><strong>${cifra(r.atendidos_hoy)}</strong><span>Atendidos</span></div>
          <div class="jornada__metrica"><span class="jornada__icono jornada__icono--mal">${icono("ausente", 17)}</span><strong>${cifra(r.no_asistio_hoy)}</strong><span>No asistieron</span></div>
          <div class="jornada__metrica"><span class="jornada__icono">${icono("reloj", 17)}</span><strong>${duracion(r.promedio_hoy_segundos)}</strong><span>Tiempo promedio</span></div>
          <div class="jornada__metrica"><span class="jornada__icono ${tonoPct(r.puntualidad_pct)}">${icono("calendario", 17)}</span><strong>${cifra(r.puntualidad_pct, "%")}</strong><span>En su franja</span></div>
          <div class="jornada__metrica"><span class="jornada__icono ${tonoPct(r.dentro_tiempo_max_pct)}">${icono("rayo", 17)}</span><strong>${cifra(r.dentro_tiempo_max_pct, "%")}</strong><span>Dentro de ${Math.round(maxSeg / 60)} min</span></div>
        </div>
      </section>
      ${p()?.recientes?.length
        ? html`
            <section class="ag__recientes">
              <h3>${icono("lista", 15)} Últimas atenciones</h3>
              <ul>
                ${p().recientes.map(
                  (t) => html`
                    <li>
                      <span class="ag__reciente-quien"><strong>${t.usuario_nombre}</strong><small class="mono">${codigoTurno(t)}</small></span>
                      <span class="estado estado--${t.estado === "ATENDIDO" ? "ok" : "ausente"}">${t.estado === "ATENDIDO" ? duracion((Date.parse(t.fecha_fin) - Date.parse(t.fecha_inicio)) / 1000) : "No asistió"}</span>
                    </li>`,
                )}
              </ul>
            </section>`
        : ""}`;
  }

  function agrupar(lista) {
    const mapa = new Map();
    lista.forEach((t) => {
      const clave = `${t.fecha} ${t.hora_inicio}`;
      if (!mapa.has(clave)) mapa.set(clave, { clave, t, items: [] });
      mapa.get(clave).items.push(t);
    });
    return [...mapa.values()];
  }

  function grupoHTML(g) {
    const rec = p()?.recomendacion;
    return html`
      <div class="cola__grupo">
        <h3>${g.t.es_hoy ? "Hoy" : fechaCorta(g.t.fecha)} · ${g.t.hora_inicio}–${g.t.hora_fin}<small>${g.items.length}</small></h3>
        ${g.items.map((t) => {
          const pu = PUNTUALIDAD[t.puntualidad] || {};
          const recomendado = rec?.turno_id === t.id && !actual();
          return html`
            <div class="cola__item ${recomendado ? "cola__item--rec" : ""} ${s.recienLlegados.has(t.id) ? "cola__item--nuevo" : ""}">
              <span class="cola__hora" title="Hora proyectada de inicio">${t.es_hoy ? t.inicio_proyectado : t.hora_inicio}</span>
              <div class="cola__info">
                <strong>${t.usuario_nombre}</strong>
                <small><span class="mono">${codigoTurno(t)}</span> · ${t.tramite_nombre} · ~${Math.round(t.duracion_estimada_seg / 60)} min</small>
                ${t.respuestas_solicitud?.length ? html`<small class="cola__necesidad">${t.respuestas_solicitud.map((r) => `${r.etiqueta}: ${valorRespuesta(r.valor)}`).join(" · ")}</small>` : ""}
                ${t.detalle_necesidad ? html`<small class="cola__necesidad" title="${t.detalle_necesidad}">${t.detalle_necesidad}</small>` : ""}
                ${t.equipo ? html`<small class="cola__equipo">${icono("tv", 12)} ${t.equipo.marca} ${t.equipo.modelo} · <span class="mono">${t.equipo.codigo}</span> · ${ESTADOS_EQUIPO[t.equipo.estado]?.texto}</small>` : ""}
                ${t.reclamo ? html`<small class="cola__equipo">${icono("mensaje", 12)} Reclamo <span class="mono">${t.reclamo.radicado}</span> · ${t.reclamo.categoria_texto}</small>` : ""}
                ${t.preparacion ? html`<span class="cola__prep">${insigniaPreparacion(t.preparacion, t.tramite_flujo)}</span>` : ""}
              </div>
              ${t.requiere_preparacion || t.preparacion
                ? html`<button class="icono-btn" title="Preparar antes de que llegue" aria-label="Preparar el pedido de ${t.usuario_nombre}" data-accion="preparar" data-id="${t.id}">${icono("paquete", 17)}</button>`
                : html`<span aria-hidden="true"></span>`}
              <span class="punt punt--${pu.tono}">${pu.texto}</span>
              <button class="icono-btn" title="Llamar a esta persona" aria-label="Llamar a ${t.usuario_nombre}" data-accion="llamar" data-id="${t.id}" ${actual() || s.ocupado ? "disabled" : ""}>${icono("megafono", 17)}</button>
            </div>`;
        })}
      </div>`;
  }

  function colaHTML() {
    const datos = p();
    const r = datos?.resumen || {};
    const franja = datos?.franja_actual;
    const grupos = agrupar((datos?.cola || []).filter((t) => t.es_hoy));
    const proximos = agrupar((datos?.cola || []).filter((t) => !t.es_hoy));
    const totalProximos = proximos.reduce((n, g) => n + g.items.length, 0);
    return html`
      <aside class="cola" aria-label="Cola de turnos">
        <header class="cola__cabeza">
          <h2>Cola</h2>
          <span>
            ${r.en_espera_hoy ?? 0} hoy
            ${r.en_riesgo ? html` · <b class="texto-riesgo">${r.en_riesgo} en riesgo</b>` : ""}
            ${r.por_preparar ? html` · <b class="texto-prep">${r.por_preparar} por preparar</b>` : ""}
          </span>
        </header>
        ${franja
          ? html`
              <div class="cola__franja">
                <div class="cola__franja-fila">
                  <span>Franja actual ${franja.inicio}–${franja.fin}</span>
                  <span>${franja.atendidos}/${franja.reservados} atendidos · cupo ${franja.capacidad}</span>
                </div>
                <div class="cola__tiempo"><span data-cola-tiempo style="width: 0%"></span></div>
              </div>`
          : ""}
        <div class="cola__lista">
          ${datos ? "" : [1, 2, 3].map(() => html`<div class="esqueleto" style="height: 54px; margin: 8px 0"></div>`)}
          ${datos && !grupos.length ? html`<p class="vacio">No hay más turnos para hoy.</p>` : ""}
          ${grupos.map(grupoHTML)}
          ${totalProximos
            ? html`
                <div class="cola__proximos">
                  <button type="button" class="cola__desplegar" aria-expanded="${s.verProximos}" data-accion="proximos">
                    ${icono("abajo", 16, { clase: s.verProximos ? "girado" : "" })} Próximos días <small>${totalProximos}</small>
                  </button>
                  ${s.verProximos ? proximos.map(grupoHTML) : ""}
                </div>`
            : ""}
        </div>
      </aside>`;
  }

  function atencionHTML() {
    return html`
      <main class="ag__cuerpo" id="contenido" tabindex="-1">
        <h1 class="sr">Consola de atención${p()?.agente?.sede ? ` · ${p().agente.sede}` : ""}</h1>
        <div class="ag__principal">${asistenteHTML()}${puestoHTML()}${jornadaHTML()}</div>
        ${colaHTML()}
      </main>`;
  }

  function alertasHTML() {
    return s.alertas.map(
      (a) => html`
        <div class="alerta alerta--${a.tono}" role="alert">
          <span class="alerta__icono">${icono(a.icono, 18)}</span>
          <div>
            <strong>${a.titulo}</strong>
            <p>${a.detalle}</p>
            ${a.accion ? html`<button type="button" class="btn btn--primario btn--chico" data-alerta-accion="${a.clave}">${a.accion.texto}</button>` : ""}
          </div>
          <button type="button" class="icono-btn" aria-label="Cerrar aviso" data-alerta-cerrar="${a.clave}">${icono("cerrar", 15)}</button>
        </div>`,
    );
  }

  // ------------------------------------------------------------ pintar
  const renderBarra = () => pintarSiCambia(zona("barra"), barraHTML());
  const renderTabs = () => pintarSiCambia(zona("tabs"), html`${tabsHTML()}`);
  const renderAlertas = () => pintarSiCambia(zona("alertas"), html`${alertasHTML()}`);
  function render() {
    renderBarra();
    const error = panel?.estado.error;
    const errorPanel = p()?.error;
    pintarSiCambia(
      zona("avisos"),
      html`
        ${error ? html`<div class="ag__aviso">${icono("alerta", 16)} ${error} Reintentando…</div>` : ""}
        ${errorPanel ? html`<div class="ag__aviso">${icono("alerta", 16)} ${errorPanel} Elige tu sede en la parte de arriba.</div>` : ""}`,
    );
    renderTabs();
    if (s.seccion === "atencion") {
      // Solo se repinta si cambió algo; las animaciones de entrada no se repiten
      // mientras el turno del puesto siga siendo el mismo.
      const clave = `${actual()?.id}-${actual()?.estado}-${Boolean(s.cierre)}`;
      const cambio = pintarSiCambia(zona("seccion"), atencionHTML());
      if (cambio) zona("seccion").classList.toggle("repintado", clave === colaVista);
      colaVista = clave;
    }
    tick();
  }

  /** Cada segundo: reloj, franja, cronómetro, voz y pausa (sin volver a pintar todo). */
  function tick() {
    const ms = ahora();
    const datos = p();
    const el = (sel) => raiz.querySelector(sel);
    const relojEl = el("[data-reloj]");
    if (relojEl) relojEl.textContent = reloj(ms);

    const franja = datos?.franja_actual;
    if (franja) {
      const restante = franja.restante_seg - (ms - Date.parse(datos.ahora)) / 1000;
      const chip = el("[data-franja-restante]");
      if (chip) {
        chip.textContent = `quedan ${mmss(restante)}`;
        chip.classList.toggle("urgente", restante < 300);
      }
      const barra = el("[data-cola-tiempo]");
      if (barra) barra.style.width = `${Math.min(100, 100 - (restante / franja.total_seg) * 100)}%`;
    }

    raiz.querySelectorAll("[data-crono]").forEach((c) => {
      const limite = Number(c.dataset.limite);
      const transcurrido = c.dataset.desde ? (ms - Date.parse(c.dataset.desde)) / 1000 : 0;
      const pct = Math.min(100, (transcurrido / limite) * 100);
      c.className = `crono crono--${pct >= 100 ? "rojo" : pct >= 80 ? "ambar" : "verde"}`;
      c.querySelector("[data-crono-tiempo]").textContent = mmss(transcurrido);
      c.querySelector("[data-crono-barra]").style.width = `${pct}%`;
    });

    const vozEl = el("[data-voz-estado]");
    if (vozEl && voz.soportado && voz.estado.activo) {
      const modulo = datos?.agente?.modulo || "";
      const restante = voz.restante();
      vozEl.innerHTML =
        restante != null
          ? String(html`Anunciando por voz${modulo ? ` ${destinoHablado(modulo)}` : ""} · se repite en <b>${restante} s</b>`)
          : voz.estado.veces
            ? "Se completaron los anuncios por voz (3 min)."
            : "Preparando el anuncio por voz…";
    }

    if (s.pausaHasta) {
      const restante = (s.pausaHasta - ms) / 1000;
      const pausaEl = el("[data-pausa-restante]");
      if (pausaEl) pausaEl.textContent = mmss(restante);
      if (restante <= 0) {
        s.pausaHasta = null;
        agenteApi.cambiarPresencia("DISPONIBLE").catch(() => {});
        avisar("Pausa terminada. El siguiente turno te espera.");
        render();
      }
    }
    revisarAlertas();
  }

  // ------------------------------------------------------------ datos en vivo
  /** Llegó el panel: hora del servidor, voz, turnos nuevos y re-pintado. */
  function alLlegarPanel(estado) {
    const datos = estado.datos;
    if (datos?.ahora) desfase = Date.parse(datos.ahora) - Date.now();
    voz.actualizar(datos?.actual, datos?.agente?.modulo || "", datos?.agente?.nombre || usuario.nombre);
    asistente?.subtitulo(datos?.agente?.sede ? `Tu cola de ${datos.agente.sede} en tiempo real` : "");

    if (datos?.cola) {
      // Aviso cuando llega una reserva nueva para hoy (visual y lector de pantalla).
      const hoy = datos.cola.filter((t) => t.es_hoy);
      if (conocidosHoy === null) conocidosHoy = new Set(hoy.map((t) => t.id));
      else {
        const nuevos = hoy.filter((t) => !conocidosHoy.has(t.id));
        hoy.forEach((t) => conocidosHoy.add(t.id));
        if (nuevos.length === 1) {
          avisar(`Nuevo turno: ${nuevos[0].usuario_nombre} a las ${nuevos[0].hora_inicio}`);
          anunciar(`Nuevo turno para las ${nuevos[0].hora_inicio}: ${nuevos[0].usuario_nombre}, ${nuevos[0].tramite_nombre}.`);
        } else if (nuevos.length > 1) {
          avisar(`${nuevos.length} turnos nuevos en la cola de hoy`);
          anunciar(`Llegaron ${nuevos.length} turnos nuevos a la cola.`);
        }
        // Se resaltan unos segundos en la cola.
        if (nuevos.length) {
          s.recienLlegados = new Set(nuevos.map((t) => t.id));
          despues(4000, () => {
            s.recienLlegados = new Set();
            render();
          });
        }
      }
    }
    render();
  }

  const panel = crearSondeo(agenteApi.obtenerPanel, 5000, alLlegarPanel);
  const bandeja = crearSondeo(() => agenteApi.bandejaReclamos(), 12000, ({ datos }) => {
    if (!datos) return;
    if (s.seccion !== "reclamos") s.reclamosPendientes = datos.pendientes ?? 0;
    const sinLeer = datos.mensajes_sin_leer || 0;
    if (previoSinLeer !== null && sinLeer > previoSinLeer) {
      emitir(`chat-${Date.now()}`, {
        tono: "info", icono: "mensaje",
        titulo: "Nuevo mensaje de un cliente",
        detalle: "El asistente ya le respondió lo básico. Revisa si necesita precio, fecha o diagnóstico.",
        accion: { texto: "Abrir reclamos", fn: () => cambiarSeccion("reclamos") },
      });
    }
    previoSinLeer = sinLeer;
    renderTabs();
  });
  listarSedes()
    .then((r) => {
      s.sedes = r?.puntos || [];
      renderBarra();
    })
    .catch(() => {});

  // ------------------------------------------------------------ eventos
  const acciones = {
    llamar: (b) => llamar(b.dataset.id ? Number(b.dataset.id) : undefined),
    iniciar: (b) => ejecutar(() => agenteApi.iniciar(Number(b.dataset.id))),
    "no-asistio": (b) => ejecutar(() => agenteApi.noAsistio(Number(b.dataset.id))),
    devolver: (b) => ejecutar(() => agenteApi.devolver(Number(b.dataset.id))),
    finalizar: () => actual() && finalizar(actual()),
    preparar: (b) => abrirPreparar(Number(b.dataset.id)),
    pausa: (b) => iniciarPausa(Number(b.dataset.seg)),
    "terminar-pausa": terminarPausa,
    equipo: (b) => moverEquipo(actual().equipo, b.dataset.estado),
    "registrar-equipo": () => {
      const t = actual();
      abrirFormularioEquipo({
        inicial: { cliente_celular: t.usuario_celular, cliente_nombre: t.usuario_nombre, cliente_documento: t.usuario_documento },
        alGuardado: (r) => {
          avisar(r.mensaje);
          panel.refrescar();
        },
      });
    },
    seccion: (b) => cambiarSeccion(b.dataset.valor),
    proximos: () => {
      s.verProximos = !s.verProximos;
      render();
    },
    voz: () => {
      voz.alternar();
      render();
    },
    "repetir-voz": () => voz.repetir(),
    "presencia-menu": () => {
      s.presenciaAbierta = !s.presenciaAbierta;
      renderBarra();
    },
    presencia: (b) => {
      s.presenciaAbierta = false;
      const nueva = b.dataset.valor;
      const actualPresencia = p()?.agente?.presencia || "DISPONIBLE";
      if (nueva === "DISPONIBLE" && s.pausaHasta) terminarPausa();
      else if (nueva !== actualPresencia) cambiarPresencia(nueva);
      renderBarra();
    },
    clave: () =>
      abrirCambiarMiClave({
        alListo: (u) => {
          onUsuario?.(u);
          avisar("Tu contraseña fue actualizada.");
        },
      }),
    salir: onSalir,
  };

  raiz.addEventListener("click", (e) => {
    const alertaAccion = e.target.closest("[data-alerta-accion]");
    const alertaCerrar = e.target.closest("[data-alerta-cerrar]");
    if (alertaAccion) {
      const clave = alertaAccion.dataset.alertaAccion;
      accionesAlerta[clave]?.();
      cerrarAlerta(clave);
      return;
    }
    if (alertaCerrar) return cerrarAlerta(alertaCerrar.dataset.alertaCerrar);
    const b = e.target.closest("[data-accion]");
    // Las secciones Equipos y Reclamos manejan sus propios botones.
    if (!b || b.disabled || (zona("seccion").contains(b) && s.seccion !== "atencion")) return;
    acciones[b.dataset.accion]?.(b);
  });
  raiz.addEventListener("change", (e) => {
    if (e.target.dataset.campo === "sede" && zona("barra").contains(e.target)) pedirCambioSede(e.target.value);
  });
  // Clic fuera del menú de presencia o Escape: se cierra.
  const fuera = (e) => {
    if (s.presenciaAbierta && !e.target.closest("[data-presencia]")) {
      s.presenciaAbierta = false;
      renderBarra();
    }
  };
  const escape = (e) => {
    if (e.key === "Escape" && s.presenciaAbierta) {
      s.presenciaAbierta = false;
      renderBarra();
    }
  };
  document.addEventListener("pointerdown", fuera);
  document.addEventListener("keydown", escape);

  const asistente = montarAsistenteIA(zona("ia"), {
    titulo: "Copiloto IA",
    onAccion: (a) => {
      if (a.tipo === "llamar") {
        cambiarSeccion("atencion");
        llamar(a.turno_id);
      } else if (a.tipo === "preparar") {
        cambiarSeccion("atencion");
        abrirPreparar(a.turno_id);
      } else if (a.tipo === "seccion") cambiarSeccion(a.destino);
    },
  });

  const reloj1s = window.setInterval(tick, 1000);
  render();

  return () => {
    panel.detener();
    bandeja.detener();
    window.clearInterval(reloj1s);
    temporizadores.forEach((t) => window.clearTimeout(t));
    voz.destruir();
    asistente.destruir();
    limpiarSeccion?.();
    document.removeEventListener("pointerdown", fuera);
    document.removeEventListener("keydown", escape);
  };
}
