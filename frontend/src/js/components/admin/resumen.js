/**
 * Resumen: tablero ejecutivo del panel (indicadores, tendencia, operación en
 * vivo, demanda por hora, taller, reclamos, sedes y trámites).
 *   montarResumen(contenedor, { titulo, soloLectura })
 */
import * as adminApi from "../../api/admin.api.js";
import { listarSedes } from "../../api/publico.api.js";
import { html, pintarSiCambia } from "../../utils/dom.js";
import { duracion, ESTADOS, fechaCorta, hoyISO } from "../../utils/formatters.js";
import { crearSondeo } from "../../utils/polling.js";
import { teclasPestanas } from "../../utils/voz.js";
import { encabezado, marcarEnVivo } from "../layout/encabezado.js";
import { icono } from "../ui/icon.js";
import { CATEGORICOS, montarColumnas, montarLineas, SERIE, segmentada, sparkline } from "./graficas.js";

const PERIODOS = [
  { id: "1", texto: "Hoy", dias: 1 },
  { id: "7", texto: "7 días", dias: 7 },
  { id: "30", texto: "30 días", dias: 30 },
  { id: "90", texto: "90 días", dias: 90 },
];
const ESTADOS_EQ = [["POR_RECIBIR", "Por recibir"], ["RECIBIDO", "Recibidos"], ["EN_REPARACION", "En reparación"], ["LISTO", "Listos"], ["ENTREGADO", "Entregados"]];
/** Estado de cada asesor en "Sedes ahora". */
const ESTADO_ASESOR = {
  LIBRE: { texto: "Libre", tono: "ok" },
  EN_ATENCION: { tono: "atencion" },
  LLAMADO: { tono: "llamado" },
  PAUSA: { texto: "En pausa", tono: "espera" },
  ALMUERZO: { texto: "En almuerzo", tono: "llamado" },
  AUSENTE: { texto: "Fuera de turno", tono: "cancelado" },
};
const CLASE_ASESOR = { LIBRE: "libre", EN_ATENCION: "ocupado", LLAMADO: "llamando", PAUSA: "pausa", ALMUERZO: "pausa", AUSENTE: "fuera" };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const num = (v) => (v == null ? "—" : Math.round(v).toLocaleString("es-CO"));
const pct = (v) => (v == null ? "—" : `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`);
const diaCorto = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
};
function haceMin(iso) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/** Variación contra el periodo anterior. bueno: qué dirección conviene. */
function delta(actual, anterior, { bueno = "sube", puntos = false } = {}) {
  if (actual == null || anterior == null || (!puntos && !anterior)) return html`<span class="delta delta--nada">sin periodo previo</span>`;
  const dif = puntos ? actual - anterior : ((actual - anterior) / anterior) * 100;
  if (Math.abs(dif) < 0.05) return html`<span class="delta delta--nada">= igual que antes</span>`;
  const sube = dif > 0;
  const favorable = (sube && bueno === "sube") || (!sube && bueno === "baja");
  return html`<span class="delta ${favorable ? "delta--bien" : "delta--mal"}">${icono(sube ? "subir" : "bajar", 13, { grosor: 2.4 })}${sube ? "+" : "−"}${Math.abs(dif).toLocaleString("es-CO", { maximumFractionDigits: 1 })}${puntos ? " pts" : "%"}<small> vs. periodo anterior</small></span>`;
}

const tarjeta = ({ etiqueta, valor, delta: d, tendencia, nota }) => html`
  <article class="tarjeta">
    <span class="tarjeta__etiqueta">${etiqueta}</span>
    <strong class="tarjeta__valor">${valor}</strong>
    ${d}
    ${tendencia ? sparkline(tendencia) : ""}
    ${nota ? html`<small class="tarjeta__nota">${nota}</small>` : ""}
  </article>`;

/** Porcentaje con una barra fina (meta 90 %). */
function mini(valor) {
  if (valor == null) return html`<span class="tenue">—</span>`;
  return html`<span class="mini"><span class="mini__pista"><span style="width: ${Math.min(100, valor)}%" class="${valor >= 90 ? "" : "mini--bajo"}"></span></span><b>${pct(valor)}</b></span>`;
}

function barras(filas, total) {
  if (!filas.length) return html`<p class="vacio">Sin datos en este periodo.</p>`;
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return html`
    <ul class="barras">
      ${filas.map(
        (f) => html`
          <li>
            <span class="barras__nombre">${f.nombre}</span>
            <span class="barras__pista"><span style="width: ${(f.valor / max) * 100}%"></span></span>
            <span class="barras__valor">${f.valor.toLocaleString("es-CO")}${total ? html`<small> ${Math.round((f.valor / total) * 100)}%</small>` : ""}</span>
          </li>`,
      )}
    </ul>`;
}

/** Descarga la tendencia como CSV (abre en Excel). */
function exportarCsv(t) {
  const filas = [
    ["Fecha", "Turnos", "Atendidos", "No asistió", "Cancelados", "Turnos periodo anterior"],
    ...t.por_dia.map((d, i) => [d.fecha, d.total, d.atendidos, d.no_asistio, d.cancelados, t.por_dia_anterior[i] ?? ""]),
  ];
  const csv = "﻿" + filas.map((f) => f.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `filacero-tablero-${t.periodo.desde}_${t.periodo.hasta}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function montarResumen(contenedor, { titulo, soloLectura }) {
  const s = { periodo: "7", sede: "", sedes: [], verTabla: false, nuevos: new Set() };
  let sondeo = null;
  let vistosRecientes = null;
  const graficas = {};
  const zona = (n) => contenedor.querySelector(`[data-z="${n}"]`);

  /** Monta una gráfica en su lugar y libera la anterior. */
  function grafica(nombre, montar) {
    graficas[nombre]?.();
    const lugar = contenedor.querySelector(`[data-graf="${nombre}"]`);
    graficas[nombre] = lugar ? montar(lugar) : null;
  }

  function filtrosHTML() {
    return html`
      ${soloLectura ? html`<span class="estado estado--espera">${icono("ver", 13)} Solo lectura</span>` : ""}
      <span class="campo campo--select campo--compacto">
        ${icono("edificio", 17)}
        <select data-campo="sede" aria-label="Sede">
          <option value="">Todas las sedes</option>
          ${s.sedes.map((x) => html`<option value="${x.id}" ${String(x.id) === String(s.sede) ? "selected" : ""}>${x.nombre}</option>`)}
        </select>
      </span>
      <div class="segmentos" role="tablist" aria-label="Periodo" data-periodos>
        ${PERIODOS.map((x) => html`<button role="tab" tabindex="${s.periodo === x.id ? 0 : -1}" aria-selected="${s.periodo === x.id}" class="${s.periodo === x.id ? "activo" : ""}" data-accion="periodo" data-valor="${x.id}">${x.texto}</button>`)}
      </div>
      <button type="button" class="btn btn--suave btn--chico" data-accion="csv" ${sondeo?.estado.datos ? "" : "disabled"}>${icono("externo", 15)} CSV</button>`;
  }

  function kpisHTML(t) {
    const k = t?.kpis || {};
    const a = t?.kpis_anterior || {};
    const unDia = (t?.periodo?.dias || 7) === 1;
    const dias = t?.por_dia || [];
    return html`
      <article class="heroe">
        <span class="heroe__etiqueta">Atendidos dentro de su franja</span>
        <strong class="heroe__valor">${pct(k.puntualidad_pct)}</strong>
        ${delta(k.puntualidad_pct, a.puntualidad_pct, { puntos: true })}
        <div class="heroe__meta" aria-label="Meta 90 %, actual ${k.puntualidad_pct ?? "sin dato"} %">
          <span style="width: ${Math.min(100, k.puntualidad_pct || 0)}%"></span><i style="left: 90%" title="Meta 90 %"></i>
        </div>
        <small>Meta 90 % · ${(k.atendidos_medidos ?? 0).toLocaleString("es-CO")} atenciones medidas</small>
        <dl class="heroe__pie">
          <div><dt>En menos de 10 min</dt><dd>${k.dentro_tiempo_max_pct != null ? `${k.dentro_tiempo_max_pct}%` : "—"}</dd></div>
          <div><dt>En curso ahora</dt><dd>${k.en_curso ?? "—"}</dd></div>
          <div><dt>No asistieron</dt><dd>${k.no_asistio ?? "—"}</dd></div>
        </dl>
      </article>
      ${tarjeta({ etiqueta: "Turnos reservados", valor: num(k.total), delta: delta(k.total, a.total), tendencia: unDia ? null : dias.map((d) => d.total), nota: unDia ? `${k.en_curso ?? 0} en curso ahora` : null })}
      ${tarjeta({ etiqueta: "Atendidos", valor: num(k.atendidos), delta: delta(k.atendidos, a.atendidos), tendencia: unDia ? null : dias.map((d) => d.atendidos), nota: unDia ? "Atenciones finalizadas hoy" : null })}
      ${tarjeta({ etiqueta: "Asistencia", valor: pct(k.asistencia_pct), delta: delta(k.asistencia_pct, a.asistencia_pct, { puntos: true }), nota: `${(k.no_asistio ?? 0).toLocaleString("es-CO")} no asistieron` })}
      ${tarjeta({ etiqueta: "Atención promedio", valor: k.atencion_promedio_seg == null ? "—" : duracion(k.atencion_promedio_seg), delta: delta(k.atencion_promedio_seg, a.atencion_promedio_seg, { bueno: "baja" }), nota: "Tope por atención: 10 min" })}
      ${tarjeta({ etiqueta: "Cancelaciones", valor: pct(k.cancelacion_pct), delta: delta(k.cancelacion_pct, a.cancelacion_pct, { bueno: "baja", puntos: true }), nota: `${(k.cancelados ?? 0).toLocaleString("es-CO")} turnos liberados` })}
      ${tarjeta({ etiqueta: "Alistados antes de llegar", valor: pct(k.preparados_pct), delta: delta(k.preparados_pct, a.preparados_pct, { puntos: true }), nota: "Entregas y garantías" })}`;
  }

  function horasDe(t) {
    return (t?.por_hora || []).map((h) => ({
      clave: h.hora,
      valor: h.total,
      etiqueta: `${String(h.hora).padStart(2, "0")}:00 – ${String(h.hora + 1).padStart(2, "0")}:00`,
      corta: `${h.hora}h`,
    }));
  }
  const picoDe = (horas) => horas.reduce((m, h) => (h.valor > (m?.valor ?? -1) ? h : m), null);

  function tendenciaHTML(t) {
    const unDia = (t?.periodo?.dias || 7) === 1;
    const dias = t?.por_dia || [];
    let cuerpo;
    if (!t) cuerpo = html`<div class="esqueleto" style="height: 230px"></div>`;
    else if (s.verTabla) {
      cuerpo = html`
        <div class="tabla-envoltura tablero__tabla">
          <table class="tabla">
            <thead><tr><th>Fecha</th><th class="num">Turnos</th><th class="num">Atendidos</th><th class="num">No asistió</th><th class="num">Cancelados</th><th class="num">Anterior</th></tr></thead>
            <tbody>${dias.map((d, i) => html`<tr><td>${fechaCorta(d.fecha)}</td><td class="num">${d.total}</td><td class="num">${d.atendidos}</td><td class="num">${d.no_asistio}</td><td class="num">${d.cancelados}</td><td class="num">${t.por_dia_anterior[i]}</td></tr>`)}</tbody>
          </table>
        </div>`;
    } else cuerpo = html`<div data-graf="tendencia"></div>`;
    return html`
      <header class="panel__cabeza">
        <h2>${unDia ? "Turnos de hoy por hora" : "Turnos por día"}</h2>
        ${!unDia
          ? html`<ul class="leyenda leyenda--linea" aria-label="Series">
              <li><i style="background: ${SERIE.actual}"></i>Este periodo</li>
              <li><i class="discontinua" style="border-color: ${SERIE.anterior}"></i>Periodo anterior</li>
            </ul>`
          : ""}
        <button type="button" class="enlace" data-accion="tabla">${s.verTabla ? "Ver gráfica" : "Ver tabla"}</button>
      </header>
      ${cuerpo}`;
  }

  function hallazgosHTML(t) {
    const iconos = { alerta: "alerta", atencion: "reloj", info: "grafica", bien: "check" };
    return html`
      <header class="panel__cabeza"><h2 id="titulo-asistente">${icono("rayo", 16)} Asistente de métricas</h2><span class="panel__nota">Lectura automática del periodo</span></header>
      ${!t
        ? html`<div class="esqueleto" style="height: 200px"></div>`
        : t.hallazgos?.length
          ? html`<ul class="hallazgos">${t.hallazgos.map(
              (h, i) => html`<li class="hallazgo hallazgo--${h.tono}" style="animation-delay: ${i * 70}ms">
                <span class="hallazgo__marca" aria-hidden="true">${icono(iconos[h.tono], 15)}</span><div><strong>${h.titulo}</strong><p>${h.detalle}</p></div></li>`,
            )}</ul>`
          : html`<p class="vacio">Sin hallazgos para este periodo.</p>`}`;
  }

  function vivoHTML(vivo) {
    const asesores = (vivo || []).flatMap((x) => x.asesores);
    const contar = (estado) => asesores.filter((a) => a.estado === estado).length;
    return html`
      <header class="panel__cabeza"><h2>Sedes ahora</h2><span class="panel__nota">Se actualiza solo cada 15 segundos</span></header>
      <div class="mini-kpis" aria-label="Estado actual de asesores en sedes activas">
        <div><strong>${vivo ? asesores.length : "—"}</strong><span>asesores en sede</span></div>
        <div><strong>${vivo ? contar("EN_ATENCION") : "—"}</strong><span>atendiendo ahora</span></div>
        <div><strong>${vivo ? contar("LLAMADO") : "—"}</strong><span>llamando</span></div>
        <div><strong>${vivo ? contar("LIBRE") : "—"}</strong><span>libres para atender</span></div>
      </div>
      <div class="tabla-envoltura">
        <table class="tabla tabla--vivo">
          <thead><tr><th scope="col">Sede</th><th scope="col">Franja en curso</th><th scope="col">Próximo turno</th><th scope="col" class="num">Esperan hoy</th><th scope="col" class="num">En riesgo</th><th scope="col">Asesores</th></tr></thead>
          <tbody>
            ${(vivo || []).map((x) => {
              const f = x.franja_actual;
              const libres = x.asesores.filter((a) => a.estado === "LIBRE").length;
              return html`
                <tr>
                  <th scope="row"><strong>${x.nombre}</strong></th>
                  <td>${f
                    ? html`<div class="ocupacion" title="${f.reservados} reservados de ${f.capacidad} cupos · ${f.atendidos} atendidos">
                        <div class="ocupacion__fila"><span class="ocupacion__hora">${f.inicio}–${f.fin}</span><span class="ocupacion__dato">${f.reservados}/${f.capacidad} cupos</span></div>
                        <div class="ocupacion__pista" aria-hidden="true">
                          <span class="ocupacion__ok" style="width: ${(f.atendidos / f.capacidad) * 100}%"></span>
                          <span class="ocupacion__res" style="width: ${(Math.max(0, f.reservados - f.atendidos) / f.capacidad) * 100}%"></span>
                        </div>
                      </div>`
                    : html`<span class="tenue">Fuera de horario</span>`}</td>
                  <td>${x.proxima
                    ? html`<span class="proxima"><strong>${x.proxima.hora}</strong> · ${x.proxima.cantidad} ${x.proxima.cantidad === 1 ? "persona" : "personas"}</span>`
                    : html`<span class="tenue">Sin turnos pendientes</span>`}</td>
                  <td class="num">${x.en_espera_hoy}</td>
                  <td class="num">${x.en_riesgo ? html`<span class="estado estado--ausente">${x.en_riesgo}</span>` : html`<span class="tenue">0</span>`}</td>
                  <td>${!x.asesores.length
                    ? html`<span class="estado estado--espera">Sin asesores</span>`
                    : html`<details class="asesores">
                        <summary>
                          <span class="asesores__puntos" aria-hidden="true">${x.asesores.map((a) => html`<i class="${CLASE_ASESOR[a.estado] || "fuera"}"></i>`)}</span>
                          ${x.asesores.length} · ${libres} libre${libres === 1 ? "" : "s"}
                        </summary>
                        <ul>${x.asesores.map(
                          (a) => html`<li>${a.nombre}<span class="estado estado--${ESTADO_ASESOR[a.estado]?.tono || "cancelado"}">${a.estado === "EN_ATENCION" ? `Atiende TU-${a.turno.slice(-6)}` : a.estado === "LLAMADO" ? `Llama TU-${a.turno.slice(-6)}` : ESTADO_ASESOR[a.estado]?.texto || a.estado}</span></li>`,
                        )}</ul>
                      </details>`}</td>
                </tr>`;
            })}
            ${vivo ? "" : html`<tr><td colspan="6"><div class="esqueleto" style="height: 18px"></div></td></tr>`}
          </tbody>
        </table>
      </div>`;
  }

  function recientesHTML(recientes) {
    return html`
      <header class="panel__cabeza"><h2 id="titulo-recientes">Reservas recientes</h2></header>
      <ol class="recientes__lista" aria-live="polite">
        ${(recientes || []).slice(0, 6).map(
          (t) => html`
            <li class="${s.nuevos.has(t.id) ? "recientes__nuevo" : ""}">
              <span class="recientes__cuando">${haceMin(t.reservado)}</span>
              <div><strong>${t.sede}</strong><small>${t.tramite} · ${t.fecha === hoyISO() ? "hoy" : fechaCorta(t.fecha)} ${t.hora}</small></div>
              <span class="estado estado--${ESTADOS[t.estado]?.tono}">${ESTADOS[t.estado]?.texto}</span>
            </li>`,
        )}
        ${recientes && !recientes.length ? html`<li class="vacio">Aún no hay reservas.</li>` : ""}
      </ol>`;
  }

  function demandaHTML(t) {
    const horas = horasDe(t);
    const pico = picoDe(horas);
    return html`
      <header class="panel__cabeza"><h2>Demanda por hora</h2>${pico ? html`<span class="panel__nota">Pico ${pico.etiqueta}</span>` : ""}</header>
      ${!t ? html`<div class="esqueleto" style="height: 200px"></div>` : horas.length ? html`<div data-graf="demanda"></div>` : html`<p class="vacio">Sin turnos en este periodo.</p>`}
      <p class="tablero__pista">${icono("rayo", 14)} Refuerza asesores en la hora pico; las horas bajas sirven para alistar entregas.</p>`;
  }

  function tallerHTML(t) {
    return html`
      <header class="panel__cabeza"><h2>Taller</h2><span class="panel__nota">Equipos de clientes hoy</span></header>
      <div class="mini-kpis">
        <div><strong>${t?.equipos.en_taller ?? "—"}</strong><span>en taller</span></div>
        <div><strong>${t?.equipos.listos_por_recoger ?? "—"}</strong><span>listos por recoger</span></div>
        <div><strong>${t?.equipos.recibidos_periodo ?? "—"}</strong><span>recibidos en el periodo</span></div>
        <div><strong>${t?.equipos.entregados_periodo ?? "—"}</strong><span>entregados en el periodo</span></div>
      </div>
      ${t ? segmentada(ESTADOS_EQ.map(([c, n], i) => ({ nombre: n, valor: t.equipos.por_estado[c] || 0, color: CATEGORICOS[i], tinta: i === 3 ? "#0b0b0b" : "#fff" })), "Equipos por estado") : ""}
      <h3 class="tablero__sub">Reclamos</h3>
      <div class="mini-kpis">
        <div><strong>${t?.reclamos.abiertos ?? "—"}</strong><span>abiertos</span></div>
        <div class="${t?.reclamos.sin_atender ? "mini-alerta" : ""}"><strong>${t?.reclamos.sin_atender ?? "—"}</strong><span>sin atender</span></div>
        <div><strong>${t?.reclamos.resueltos ?? "—"}</strong><span>resueltos</span></div>
        <div><strong>${t?.reclamos.respuesta_promedio_horas != null ? `${t.reclamos.respuesta_promedio_horas} h` : "—"}</strong><span>respuesta promedio</span></div>
      </div>`;
  }

  function sedesHTML(t) {
    return html`
      <header class="panel__cabeza"><h2>Desempeño por sede</h2><span class="panel__nota">Ordenadas por demanda</span></header>
      <div class="tabla-envoltura">
        <table class="tabla tabla--ranking">
          <thead><tr><th>Sede</th><th class="num">Turnos</th><th>Asistencia</th><th>En su franja</th><th class="num">Atención</th></tr></thead>
          <tbody>
            ${(t?.por_sede || []).map((x) => html`<tr><th scope="row">${x.nombre}</th><td class="num">${x.total.toLocaleString("es-CO")}</td><td>${mini(x.asistencia_pct)}</td><td>${mini(x.puntualidad_pct)}</td><td class="num">${duracion(x.atencion_promedio_seg)}</td></tr>`)}
            ${t && !t.por_sede.length ? html`<tr><td colspan="5" class="vacio">Sin turnos en este periodo.</td></tr>` : ""}
          </tbody>
        </table>
      </div>`;
  }

  function tramitesHTML(t) {
    return html`
      <header class="panel__cabeza"><h2>Trámites más pedidos</h2><span class="panel__nota">Participación en el periodo</span></header>
      ${barras((t?.por_tramite || []).slice(0, 6).map((x) => ({ clave: x.id, nombre: x.nombre, valor: x.total })), t?.kpis?.total)}`;
  }

  function render() {
    const { datos, error, actualizado } = sondeo.estado;
    const t = datos?.t;
    marcarEnVivo(contenedor, { actualizado, error });
    const nombreSede = s.sedes.find((x) => String(x.id) === String(s.sede))?.nombre;
    contenedor.querySelector("[data-detalle]").textContent = `Tablero ejecutivo${nombreSede ? ` · ${nombreSede}` : " · todas las sedes"}${
      t ? ` · ${fechaCorta(t.periodo.desde)} – ${fechaCorta(t.periodo.hasta)} frente a ${fechaCorta(t.anterior.desde)} – ${fechaCorta(t.anterior.hasta)}` : ""
    }`;
    pintarSiCambia(zona("filtros"), filtrosHTML());
    if (pintarSiCambia(zona("kpis"), kpisHTML(t))) zona("kpis").classList.toggle("repintado", Boolean(zona("kpis").dataset.visto));
    zona("kpis").dataset.visto = t ? "1" : "";

    if (pintarSiCambia(zona("tendencia"), tendenciaHTML(t)) && t && !s.verTabla) {
      const unDia = t.periodo.dias === 1;
      const horas = horasDe(t);
      const pico = picoDe(horas);
      grafica("tendencia", (lugar) =>
        unDia
          ? montarColumnas(lugar, { datos: horas, alto: 230, descripcion: "Turnos de hoy por hora", destacar: (d) => d === pico })
          : montarLineas(lugar, {
              etiquetas: t.por_dia.map((d) => diaCorto(d.fecha)),
              descripcion: `Turnos por día: ${t.por_dia.reduce((x, d) => x + d.total, 0)} en el periodo`,
              series: [
                { nombre: "Este periodo", color: SERIE.actual, valores: t.por_dia.map((d) => d.total) },
                { nombre: "Periodo anterior", color: SERIE.anterior, valores: t.por_dia_anterior },
              ],
            }),
      );
    }
    pintarSiCambia(zona("hallazgos"), hallazgosHTML(t));
    pintarSiCambia(zona("vivo"), vivoHTML(datos?.vivo));
    pintarSiCambia(zona("recientes"), recientesHTML(datos?.recientesVivo));
    if (pintarSiCambia(zona("demanda"), demandaHTML(t)) && t) {
      const horas = horasDe(t);
      const pico = picoDe(horas);
      grafica("demanda", (lugar) => montarColumnas(lugar, { datos: horas, descripcion: "Turnos por hora del día", destacar: (d) => d === pico }));
    }
    pintarSiCambia(zona("taller"), tallerHTML(t));
    pintarSiCambia(zona("sedes"), sedesHTML(t));
    pintarSiCambia(zona("tramites"), tramitesHTML(t));
    contenedor.querySelector("[data-cargando]").hidden = Boolean(datos || error);
  }

  /** Llegaron datos: resalta las reservas nuevas desde la última actualización. */
  function alLlegar(estado) {
    const ids = (estado.datos?.recientesVivo || []).map((t) => t.id);
    if (ids.length) {
      s.nuevos = vistosRecientes ? new Set(ids.filter((id) => !vistosRecientes.has(id))) : new Set();
      vistosRecientes = new Set(ids);
    }
    render();
  }

  const recargar = () => {
    sondeo.estado.datos = null;
    zona("kpis").dataset.visto = "";
    render();
    sondeo.refrescar();
  };

  contenedor.innerHTML = String(html`
    <section class="adm__seccion tablero">
      ${encabezado({ titulo, detalle: "Tablero ejecutivo", extra: html`<div class="tablero__filtros" data-z="filtros"></div>` })}
      <div class="tablero__kpis" data-z="kpis"></div>
      <div class="tablero__fila tablero__fila--ancha">
        <article class="panel" data-z="tendencia"></article>
        <article class="panel asistente-metricas" aria-labelledby="titulo-asistente" data-z="hallazgos"></article>
      </div>
      <div class="rejilla-vivo">
        <article class="panel" data-z="vivo"></article>
        <article class="panel recientes" aria-labelledby="titulo-recientes" data-z="recientes"></article>
      </div>
      <div class="tablero__fila">
        <article class="panel" data-z="demanda"></article>
        <article class="panel" data-z="taller"></article>
      </div>
      <div class="tablero__fila">
        <article class="panel" data-z="sedes"></article>
        <article class="panel" data-z="tramites"></article>
      </div>
      <p class="tenue" data-cargando>${icono("reloj", 14)} Cargando indicadores…</p>
    </section>`);

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b || b.disabled) return;
    if (b.dataset.accion === "periodo" && b.dataset.valor !== s.periodo) {
      s.periodo = b.dataset.valor;
      recargar();
    } else if (b.dataset.accion === "tabla") {
      s.verTabla = !s.verTabla;
      zona("tendencia").__ultimoHTML = null;
      render();
    } else if (b.dataset.accion === "csv" && sondeo.estado.datos?.t) exportarCsv(sondeo.estado.datos.t);
  });
  contenedor.addEventListener("change", (e) => {
    if (e.target.dataset.campo !== "sede") return;
    s.sede = e.target.value;
    recargar();
  });
  contenedor.addEventListener("keydown", (e) => {
    if (e.target.closest("[data-periodos]")) teclasPestanas({ ...e, currentTarget: e.target.closest("[data-periodos]"), key: e.key, preventDefault: () => e.preventDefault() });
  });

  listarSedes()
    .then((r) => {
      s.sedes = r?.puntos || [];
      render();
    })
    .catch(() => {});
  sondeo = crearSondeo(async () => {
    const dias = PERIODOS.find((x) => x.id === s.periodo).dias;
    const [t, v] = await Promise.all([adminApi.tablero({ dias, punto_id: s.sede || undefined }), adminApi.enVivo()]);
    return { t, vivo: v.sedes, recientesVivo: v.recientes };
  }, 15000, alLlegar);
  render();

  return () => {
    sondeo.detener();
    Object.values(graficas).forEach((limpiar) => limpiar?.());
  };
}
