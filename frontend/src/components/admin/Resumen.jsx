import { useEffect, useRef, useState } from "react";
import * as adminApi from "../../api/admin.api";
import { teclasPestanas } from "../../hooks/useAccesibilidad";
import Icon from "../ui/Icon";
import usePolling from "../../hooks/usePolling";
import { listarSedes } from "../../api/publico.api";
import { duracion, ESTADOS, fechaCorta, hoyISO } from "../../utils/formatters";
import Dropdown from "../ui/Dropdown";
import { CATEGORICOS, SERIE, useConteo } from "../../utils/graficas";
import { Columnas, Lineas, Segmentada, Sparkline } from "./Graficas";
import Encabezado from "../layout/Encabezado";

const PERIODOS = [
  { id: "1", texto: "Hoy", dias: 1, desde: () => hoyISO(), hasta: () => hoyISO() },
  { id: "7", texto: "7 días", dias: 7, desde: () => hoyISO(-6), hasta: () => hoyISO() },
  { id: "30", texto: "30 días", dias: 30, desde: () => hoyISO(-29), hasta: () => hoyISO() },
  { id: "90", texto: "90 días", dias: 90, desde: () => hoyISO(-89), hasta: () => hoyISO() },
];

const ESTADOS_EQ = [
  ["POR_RECIBIR", "Por recibir"], ["RECIBIDO", "Recibidos"], ["EN_REPARACION", "En reparación"],
  ["LISTO", "Listos"], ["ENTREGADO", "Entregados"],
];

/** Estado de cada asesor en "Sedes ahora" (incluye pausa, almuerzo y fuera de turno). */
const ESTADO_ASESOR = {
  LIBRE: { texto: "Libre", tono: "ok" },
  EN_ATENCION: { tono: "atencion" },
  LLAMADO: { tono: "llamado" },
  PAUSA: { texto: "En pausa", tono: "espera" },
  ALMUERZO: { texto: "En almuerzo", tono: "llamado" },
  AUSENTE: { texto: "Fuera de turno", tono: "cancelado" },
};
const CLASE_ASESOR = { LIBRE: "libre", EN_ATENCION: "ocupado", LLAMADO: "llamando", PAUSA: "pausa", ALMUERZO: "pausa", AUSENTE: "fuera" };

function Barras({ filas, total }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  if (!filas.length) return <p className="vacio">Sin datos en este periodo.</p>;
  return (
    <ul className="barras">
      {filas.map((f) => (
        <li key={f.clave}>
          <span className="barras__nombre">{f.nombre}</span>
          <span className="barras__pista"><span style={{ width: `${(f.valor / max) * 100}%` }} /></span>
          <span className="barras__valor">{f.valor.toLocaleString("es-CO")}{total ? <small> {Math.round((f.valor / total) * 100)}%</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** Variación contra el periodo anterior. bueno: "sube" | "baja" (qué dirección conviene). */
function Delta({ actual, anterior, bueno = "sube", puntos = false }) {
  if (actual == null || anterior == null || (!puntos && !anterior)) return <span className="delta delta--nada">sin periodo previo</span>;
  const dif = puntos ? actual - anterior : ((actual - anterior) / anterior) * 100;
  if (Math.abs(dif) < 0.05) return <span className="delta delta--nada">= igual que antes</span>;
  const sube = dif > 0;
  const favorable = (sube && bueno === "sube") || (!sube && bueno === "baja");
  return (
    <span className={`delta ${favorable ? "delta--bien" : "delta--mal"}`}>
      <Icon name={sube ? "subir" : "bajar"} size={13} strokeWidth={2.4} />
      {sube ? "+" : "−"}{Math.abs(dif).toLocaleString("es-CO", { maximumFractionDigits: 1 })}{puntos ? " pts" : "%"}
      <small> vs. periodo anterior</small>
    </span>
  );
}

/** Tarjeta de indicador: etiqueta, valor que cuenta, variación y tendencia. */
function Tarjeta({ etiqueta, valor, formato = (v) => Math.round(v).toLocaleString("es-CO"), delta, tendencia, nota }) {
  const v = useConteo(valor);
  return (
    <article className="tarjeta">
      <span className="tarjeta__etiqueta">{etiqueta}</span>
      <strong className="tarjeta__valor">{v == null ? "—" : formato(v)}</strong>
      {delta}
      {tendencia && <Sparkline valores={tendencia} />}
      {nota && <small className="tarjeta__nota">{nota}</small>}
    </article>
  );
}

const pct = (v) => `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`;
const diaCorto = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1]}`;
};

/** Descarga lo que se ve como CSV (abre en Excel). */
function exportarCsv(t) {
  const filas = [["Fecha", "Turnos", "Atendidos", "No asistió", "Cancelados", "Turnos periodo anterior"],
    ...t.por_dia.map((d, i) => [d.fecha, d.total, d.atendidos, d.no_asistio, d.cancelados, t.por_dia_anterior[i] ?? ""])];
  const csv = "\ufeff" + filas.map((f) => f.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `filacero-tablero-${t.periodo.desde}_${t.periodo.hasta}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function haceMin(iso) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export default function Resumen({ titulo, soloLectura }) {
  const [periodo, setPeriodo] = useState("7");
  const [sede, setSede] = useState("");
  const [sedes, setSedes] = useState([]);
  const [verTabla, setVerTabla] = useState(false);
  const p = PERIODOS.find((x) => x.id === periodo);
  useEffect(() => { listarSedes().then((r) => setSedes(r?.puntos || [])).catch(() => {}); }, []);

  const { datos, error, actualizado } = usePolling(async () => {
    const [t, v] = await Promise.all([
      adminApi.tablero({ dias: p.dias, punto_id: sede || undefined }),
      adminApi.enVivo(),
    ]);
    return { t, vivo: v.sedes, recientesVivo: v.recientes };
  }, 15000, [periodo, sede]);

  // Resalta las reservas que llegaron desde la última actualización.
  const vistos = useRef(null);
  const [nuevos, setNuevos] = useState(new Set());
  useEffect(() => {
    const ids = (datos?.recientesVivo || []).map((t) => t.id);
    if (!ids.length) return;
    if (vistos.current) {
      const llegaron = ids.filter((id) => !vistos.current.has(id));
      if (llegaron.length) setNuevos(new Set(llegaron));
    }
    vistos.current = new Set(ids);
  }, [datos?.recientesVivo]);

  const t = datos?.t;
  const k = t?.kpis || {};
  const a = t?.kpis_anterior || {};
  const dias = t?.por_dia || [];
  const unDia = (t?.periodo?.dias || p.dias) === 1;
  const serieTotal = dias.map((d) => d.total);
  const serieAtendidos = dias.map((d) => d.atendidos);
  const asesoresAhora = (datos?.vivo || []).flatMap((s) => s.asesores);
  const asesoresAtendiendo = asesoresAhora.filter((a) => a.estado === "EN_ATENCION").length;
  const asesoresLlamando = asesoresAhora.filter((a) => a.estado === "LLAMADO").length;
  const asesoresLibres = asesoresAhora.filter((a) => a.estado === "LIBRE").length;
  const horas = (t?.por_hora || []).map((h) => ({
    clave: h.hora, valor: h.total,
    etiqueta: `${String(h.hora).padStart(2, "0")}:00 – ${String(h.hora + 1).padStart(2, "0")}:00`,
    corta: `${h.hora}h`,
  }));
  const pico = horas.reduce((m, h) => (h.valor > (m?.valor ?? -1) ? h : m), null);
  const nombreSede = sedes.find((s) => String(s.id) === String(sede))?.nombre;

  return (
    <section className="adm__seccion tablero">
      <Encabezado
        titulo={titulo}
        detalle={`Tablero ejecutivo${nombreSede ? ` · ${nombreSede}` : " · todas las sedes"}${t ? ` · ${fechaCorta(t.periodo.desde)} – ${fechaCorta(t.periodo.hasta)} frente a ${fechaCorta(t.anterior.desde)} – ${fechaCorta(t.anterior.hasta)}` : ""}`}
        actualizado={actualizado}
        error={error}
      >
        <div className="tablero__filtros">
          {soloLectura && <span className="estado estado--espera"><Icon name="ver" size={13} /> Solo lectura</span>}
          <Dropdown className="dd--compacto" icon="edificio" ariaLabel="Sede" value={sede} placeholder="Todas las sedes"
            options={[{ value: "", label: "Todas las sedes" }, ...sedes.map((s) => ({ value: s.id, label: s.nombre }))]}
            onChange={(v) => setSede(String(v))} />
          <div className="segmentos" role="tablist" aria-label="Periodo" onKeyDown={teclasPestanas}>
            {PERIODOS.map((x) => (
              <button key={x.id} role="tab" tabIndex={periodo === x.id ? 0 : -1} aria-selected={periodo === x.id} className={periodo === x.id ? "activo" : ""} onClick={() => setPeriodo(x.id)}>
                {x.texto}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--suave btn--chico" disabled={!t} onClick={() => exportarCsv(t)}><Icon name="externo" size={15} /> CSV</button>
        </div>
      </Encabezado>

      {/* ---------- Indicador principal + tarjetas ---------- */}
      <div className="tablero__kpis">
        <article className="heroe">
          <span className="heroe__etiqueta">Atendidos dentro de su franja</span>
          <HeroeValor valor={k.puntualidad_pct} />
          <Delta actual={k.puntualidad_pct} anterior={a.puntualidad_pct} puntos />
          <div className="heroe__meta" aria-label={`Meta 90 %, actual ${k.puntualidad_pct ?? "sin dato"} %`}>
            <span style={{ width: `${Math.min(100, k.puntualidad_pct || 0)}%` }} />
            <i style={{ left: "90%" }} title="Meta 90 %" />
          </div>
          <small>Meta 90 % · {(k.atendidos_medidos ?? 0).toLocaleString("es-CO")} atenciones medidas</small>
          <dl className="heroe__pie">
            <div><dt>En menos de 10 min</dt><dd>{k.dentro_tiempo_max_pct != null ? `${k.dentro_tiempo_max_pct}%` : "—"}</dd></div>
            <div><dt>En curso ahora</dt><dd>{k.en_curso ?? "—"}</dd></div>
            <div><dt>No asistieron</dt><dd>{k.no_asistio ?? "—"}</dd></div>
          </dl>
        </article>
        <Tarjeta etiqueta="Turnos reservados" valor={k.total} delta={<Delta actual={k.total} anterior={a.total} />} tendencia={unDia ? null : serieTotal} nota={unDia ? `${k.en_curso ?? 0} en curso ahora` : null} />
        <Tarjeta etiqueta="Atendidos" valor={k.atendidos} delta={<Delta actual={k.atendidos} anterior={a.atendidos} />} tendencia={unDia ? null : serieAtendidos} nota={unDia ? "Atenciones finalizadas hoy" : null} />
        <Tarjeta etiqueta="Asistencia" valor={k.asistencia_pct} formato={pct} delta={<Delta actual={k.asistencia_pct} anterior={a.asistencia_pct} puntos />} nota={`${(k.no_asistio ?? 0).toLocaleString("es-CO")} no asistieron`} />
        <Tarjeta etiqueta="Atención promedio" valor={k.atencion_promedio_seg} formato={(v) => duracion(v)} delta={<Delta actual={k.atencion_promedio_seg} anterior={a.atencion_promedio_seg} bueno="baja" />} nota="Tope por atención: 10 min" />
        <Tarjeta etiqueta="Cancelaciones" valor={k.cancelacion_pct} formato={pct} delta={<Delta actual={k.cancelacion_pct} anterior={a.cancelacion_pct} bueno="baja" puntos />} nota={`${(k.cancelados ?? 0).toLocaleString("es-CO")} turnos liberados`} />
        <Tarjeta etiqueta="Alistados antes de llegar" valor={k.preparados_pct} formato={pct} delta={<Delta actual={k.preparados_pct} anterior={a.preparados_pct} puntos />} nota="Entregas y garantías" />
      </div>

      {/* ---------- Tendencia + asistente de métricas ---------- */}
      <div className="tablero__fila tablero__fila--ancha">
        <article className="panel">
          <header className="panel__cabeza">
            <h2>{unDia ? "Turnos de hoy por hora" : "Turnos por día"}</h2>
            {!unDia && (
              <ul className="leyenda leyenda--linea" aria-label="Series">
                <li><i style={{ background: SERIE.actual }} />Este periodo</li>
                <li><i className="discontinua" style={{ borderColor: SERIE.anterior }} />Periodo anterior</li>
              </ul>
            )}
            <button type="button" className="enlace" onClick={() => setVerTabla((v) => !v)}>{verTabla ? "Ver gráfica" : "Ver tabla"}</button>
          </header>
          {!t ? <div className="esqueleto" style={{ height: 230 }} /> : verTabla ? (
            <div className="tabla-envoltura tablero__tabla">
              <table className="tabla">
                <thead><tr><th>Fecha</th><th className="num">Turnos</th><th className="num">Atendidos</th><th className="num">No asistió</th><th className="num">Cancelados</th><th className="num">Anterior</th></tr></thead>
                <tbody>{dias.map((d, i) => <tr key={d.fecha}><td>{fechaCorta(d.fecha)}</td><td className="num">{d.total}</td><td className="num">{d.atendidos}</td><td className="num">{d.no_asistio}</td><td className="num">{d.cancelados}</td><td className="num">{t.por_dia_anterior[i]}</td></tr>)}</tbody>
              </table>
            </div>
          ) : unDia ? (
            <Columnas datos={horas} alto={230} descripcion="Turnos de hoy por hora" destacar={(d) => d === pico} />
          ) : (
            <Lineas
              key={`${periodo}-${sede}`}
              etiquetas={dias.map((d) => diaCorto(d.fecha))}
              descripcion={`Turnos por día: ${serieTotal.reduce((x, y) => x + y, 0)} en el periodo`}
              series={[
                { nombre: "Este periodo", color: SERIE.actual, valores: serieTotal },
                { nombre: "Periodo anterior", color: SERIE.anterior, valores: t.por_dia_anterior },
              ]}
            />
          )}
        </article>
        <article className="panel asistente-metricas" aria-labelledby="titulo-asistente">
          <header className="panel__cabeza">
            <h2 id="titulo-asistente"><Icon name="rayo" size={16} /> Asistente de métricas</h2>
            <span className="panel__nota">Lectura automática del periodo</span>
          </header>
          {!t ? <div className="esqueleto" style={{ height: 200 }} /> : t.hallazgos?.length ? (
            <ul className="hallazgos">
              {t.hallazgos.map((h, i) => (
                <li key={h.titulo} className={`hallazgo hallazgo--${h.tono}`} style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="hallazgo__marca" aria-hidden="true"><Icon name={{ alerta: "alerta", atencion: "reloj", info: "grafica", bien: "check" }[h.tono]} size={15} /></span>
                  <div><strong>{h.titulo}</strong><p>{h.detalle}</p></div>
                </li>
              ))}
            </ul>
          ) : <p className="vacio">Sin hallazgos para este periodo.</p>}
        </article>
      </div>

      {/* ---------- Operación en vivo ---------- */}
      <div className="rejilla-vivo">
        <article className="panel">
          <header className="panel__cabeza">
            <h2>Sedes ahora</h2>
            <span className="panel__nota">Se actualiza solo cada 15 segundos</span>
          </header>
          <div className="mini-kpis" aria-label="Estado actual de asesores en sedes activas">
            <div><strong>{datos ? asesoresAhora.length : "—"}</strong><span>asesores en sede</span></div>
            <div><strong>{datos ? asesoresAtendiendo : "—"}</strong><span>atendiendo ahora</span></div>
            <div><strong>{datos ? asesoresLlamando : "—"}</strong><span>llamando</span></div>
            <div><strong>{datos ? asesoresLibres : "—"}</strong><span>libres para atender</span></div>
          </div>
          <div className="tabla-envoltura">
            <table className="tabla tabla--vivo">
              <thead>
                <tr>
                  <th scope="col">Sede</th>
                  <th scope="col">Franja en curso</th>
                  <th scope="col">Próximo turno</th>
                  <th scope="col" className="num">Esperan hoy</th>
                  <th scope="col" className="num">En riesgo</th>
                  <th scope="col">Asesores</th>
                </tr>
              </thead>
              <tbody>
                {(datos?.vivo || []).map((s) => {
                  const f = s.franja_actual;
                  const libres = s.asesores.filter((a) => a.estado === "LIBRE").length;
                  return (
                    <tr key={s.punto_id}>
                      <th scope="row"><strong>{s.nombre}</strong></th>
                      <td>
                        {f ? (
                          <div className="ocupacion" title={`${f.reservados} reservados de ${f.capacidad} cupos · ${f.atendidos} atendidos`}>
                            <div className="ocupacion__fila">
                              <span className="ocupacion__hora">{f.inicio}–{f.fin}</span>
                              <span className="ocupacion__dato">{f.reservados}/{f.capacidad} cupos</span>
                            </div>
                            <div className="ocupacion__pista" aria-hidden="true">
                              <span className="ocupacion__ok" style={{ width: `${(f.atendidos / f.capacidad) * 100}%` }} />
                              <span className="ocupacion__res" style={{ width: `${(Math.max(0, f.reservados - f.atendidos) / f.capacidad) * 100}%` }} />
                            </div>
                          </div>
                        ) : <span className="tenue">Fuera de horario</span>}
                      </td>
                      <td>
                        {s.proxima
                          ? <span className="proxima"><strong>{s.proxima.hora}</strong> · {s.proxima.cantidad} {s.proxima.cantidad === 1 ? "persona" : "personas"}</span>
                          : <span className="tenue">Sin turnos pendientes</span>}
                      </td>
                      <td className="num">{s.en_espera_hoy}</td>
                      <td className="num">{s.en_riesgo ? <span className="estado estado--ausente">{s.en_riesgo}</span> : <span className="tenue">0</span>}</td>
                      <td>
                        {s.asesores.length === 0 ? <span className="estado estado--espera">Sin asesores</span> : (
                          <details className="asesores">
                            <summary>
                              <span className="asesores__puntos" aria-hidden="true">
                                {s.asesores.map((a, i) => <i key={i} className={CLASE_ASESOR[a.estado] || "fuera"} />)}
                              </span>
                              {s.asesores.length} · {libres} libre{libres === 1 ? "" : "s"}
                            </summary>
                            <ul>
                              {s.asesores.map((a) => (
                                <li key={a.nombre}>
                                  {a.nombre}
                                  <span className={`estado estado--${ESTADO_ASESOR[a.estado]?.tono || "cancelado"}`}>
                                    {a.estado === "EN_ATENCION" ? `Atiende TU-${a.turno.slice(-6)}` : a.estado === "LLAMADO" ? `Llama TU-${a.turno.slice(-6)}` : ESTADO_ASESOR[a.estado]?.texto || a.estado}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!datos && <tr><td colSpan={6}><div className="esqueleto" style={{ height: 18 }} /></td></tr>}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel recientes" aria-labelledby="titulo-recientes">
          <header className="panel__cabeza">
            <h2 id="titulo-recientes">Reservas recientes</h2>
          </header>
          <ol className="recientes__lista" aria-live="polite">
            {(datos?.recientesVivo || []).slice(0, 6).map((t) => (
              <li key={t.id} className={nuevos.has(t.id) ? "recientes__nuevo" : ""}>
                <span className="recientes__cuando">{haceMin(t.reservado)}</span>
                <div>
                  <strong>{t.sede}</strong>
                  <small>{t.tramite} · {t.fecha === hoyISO() ? "hoy" : fechaCorta(t.fecha)} {t.hora}</small>
                </div>
                <span className={`estado estado--${ESTADOS[t.estado]?.tono}`}>{ESTADOS[t.estado]?.texto}</span>
              </li>
            ))}
            {datos && !(datos.recientesVivo || []).length && <li className="vacio">Aún no hay reservas.</li>}
          </ol>
        </article>
      </div>

      {/* ---------- Demanda, taller y reclamos ---------- */}
      <div className="tablero__fila">
        <article className="panel">
          <header className="panel__cabeza">
            <h2>Demanda por hora</h2>
            {pico && <span className="panel__nota">Pico {pico.etiqueta}</span>}
          </header>
          {!t ? <div className="esqueleto" style={{ height: 200 }} /> : horas.length
            ? <Columnas datos={horas} descripcion="Turnos por hora del día" destacar={(d) => d === pico} />
            : <p className="vacio">Sin turnos en este periodo.</p>}
          <p className="tablero__pista"><Icon name="rayo" size={14} /> Refuerza asesores en la hora pico; las horas bajas sirven para alistar entregas.</p>
        </article>
        <article className="panel">
          <header className="panel__cabeza"><h2>Taller</h2><span className="panel__nota">Equipos de clientes hoy</span></header>
          <div className="mini-kpis">
            <div><strong>{t?.equipos.en_taller ?? "—"}</strong><span>en taller</span></div>
            <div><strong>{t?.equipos.listos_por_recoger ?? "—"}</strong><span>listos por recoger</span></div>
            <div><strong>{t?.equipos.recibidos_periodo ?? "—"}</strong><span>recibidos en el periodo</span></div>
            <div><strong>{t?.equipos.entregados_periodo ?? "—"}</strong><span>entregados en el periodo</span></div>
          </div>
          {t && <Segmentada descripcion="Equipos por estado" partes={ESTADOS_EQ.map(([c, n], i) => ({ nombre: n, valor: t.equipos.por_estado[c] || 0, color: CATEGORICOS[i], tinta: i === 3 ? "#0b0b0b" : "#fff" }))} />}
          <h3 className="tablero__sub">Reclamos</h3>
          <div className="mini-kpis">
            <div><strong>{t?.reclamos.abiertos ?? "—"}</strong><span>abiertos</span></div>
            <div className={t?.reclamos.sin_atender ? "mini-alerta" : ""}><strong>{t?.reclamos.sin_atender ?? "—"}</strong><span>sin atender</span></div>
            <div><strong>{t?.reclamos.resueltos ?? "—"}</strong><span>resueltos</span></div>
            <div><strong>{t?.reclamos.respuesta_promedio_horas != null ? `${t.reclamos.respuesta_promedio_horas} h` : "—"}</strong><span>respuesta promedio</span></div>
          </div>
        </article>
      </div>

      {/* ---------- Sedes y trámites ---------- */}
      <div className="tablero__fila">
        <article className="panel">
          <header className="panel__cabeza"><h2>Desempeño por sede</h2><span className="panel__nota">Ordenadas por demanda</span></header>
          <div className="tabla-envoltura">
            <table className="tabla tabla--ranking">
              <thead><tr><th>Sede</th><th className="num">Turnos</th><th>Asistencia</th><th>En su franja</th><th className="num">Atención</th></tr></thead>
              <tbody>
                {(t?.por_sede || []).map((s) => (
                  <tr key={s.id}>
                    <th scope="row">{s.nombre}</th>
                    <td className="num">{s.total.toLocaleString("es-CO")}</td>
                    <td><Mini valor={s.asistencia_pct} /></td>
                    <td><Mini valor={s.puntualidad_pct} /></td>
                    <td className="num">{duracion(s.atencion_promedio_seg)}</td>
                  </tr>
                ))}
                {t && !t.por_sede.length && <tr><td colSpan={5} className="vacio">Sin turnos en este periodo.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel">
          <header className="panel__cabeza"><h2>Trámites más pedidos</h2><span className="panel__nota">Participación en el periodo</span></header>
          <Barras total={k.total} filas={(t?.por_tramite || []).slice(0, 6).map((x) => ({ clave: x.id, nombre: x.nombre, valor: x.total }))} />
        </article>
      </div>
      {!datos && !error && <p className="tenue"><Icon name="reloj" size={14} /> Cargando indicadores…</p>}
    </section>
  );
}

function HeroeValor({ valor }) {
  const v = useConteo(valor);
  return <strong className="heroe__valor">{v == null ? "—" : `${v.toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: v % 1 ? 1 : 0 })}%`}</strong>;
}

/** Porcentaje con una barra fina (meta 90 %). */
function Mini({ valor }) {
  if (valor == null) return <span className="tenue">—</span>;
  return (
    <span className="mini">
      <span className="mini__pista"><span style={{ width: `${Math.min(100, valor)}%` }} className={valor >= 90 ? "" : "mini--bajo"} /></span>
      <b>{valor.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%</b>
    </span>
  );
}
