import { useEffect, useRef, useState } from "react";
import * as adminApi from "../../api/admin.api";
import { teclasPestanas } from "../../hooks/useAccesibilidad";
import Icon from "../ui/Icon";
import usePolling from "../../hooks/usePolling";
import { duracion, ESTADOS, fechaCorta, hoyISO } from "../../utils/formatters";
import Encabezado from "../layout/Encabezado";

const PERIODOS = [
  { id: "hoy", texto: "Hoy", desde: () => hoyISO(), hasta: () => hoyISO() },
  { id: "7", texto: "7 días", desde: () => hoyISO(-6), hasta: () => hoyISO() },
  { id: "30", texto: "30 días", desde: () => hoyISO(-29), hasta: () => hoyISO() },
];

const COLORES = {
  ATENDIDO: "var(--verde)", ESPERANDO: "var(--ambar)", LLAMADO: "var(--azul)",
  EN_ATENCION: "var(--petroleo)", NO_ASISTIO: "var(--rojo)", CANCELADO: "#9aa8a9",
};

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

function Medidor({ valor, meta = 90 }) {
  if (valor == null) return <strong className="kpi__valor">—</strong>;
  const tono = valor >= meta ? "ok" : valor >= meta - 15 ? "medio" : "bajo";
  return <strong className={`kpi__valor kpi__valor--${tono}`}>{valor}%</strong>;
}

function haceMin(iso) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export default function Resumen({ titulo }) {
  const [periodo, setPeriodo] = useState("hoy");
  const p = PERIODOS.find((x) => x.id === periodo);

  const { datos, error, actualizado } = usePolling(async () => {
    const rango = { desde: p.desde(), hasta: p.hasta() };
    const [m, s, t, v] = await Promise.all([
      adminApi.metricas(rango),
      adminApi.metricasPorSede(rango),
      adminApi.metricasPorTramite(rango),
      adminApi.enVivo(),
    ]);
    return { m, sedes: s.sedes, tramites: t.tramites, vivo: v.sedes, recientesVivo: v.recientes };
  }, 15000, [periodo]);

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

  const m = datos?.m;
  const total = m?.total_turnos || 0;
  const estados = Object.entries(m?.por_estado || {}).filter(([, v]) => v > 0);

  return (
    <section className="adm__seccion">
      <Encabezado titulo={titulo} detalle="Cómo se está cumpliendo la promesa de FilaCero: atención dentro de la franja reservada." actualizado={actualizado} error={error}>
        <div className="segmentos" role="tablist" aria-label="Periodo" onKeyDown={teclasPestanas}>
          {PERIODOS.map((x) => (
            <button key={x.id} role="tab" tabIndex={periodo === x.id ? 0 : -1} aria-selected={periodo === x.id} className={periodo === x.id ? "activo" : ""} onClick={() => setPeriodo(x.id)}>
              {x.texto}
            </button>
          ))}
        </div>
      </Encabezado>

      <div className="kpis">
        <div className="kpi kpi--destacado">
          <span>Atendidos dentro de su franja</span>
          <Medidor valor={m?.puntualidad_pct} />
          <small>Meta 90% · {m?.atendidos_medidos ?? 0} atenciones medidas</small>
        </div>
        <div className="kpi">
          <span>Dentro de {Math.round((m?.max_atencion_seg || 600) / 60)} min</span>
          <Medidor valor={m?.dentro_tiempo_max_pct} />
          <small>Atención promedio {duracion(m?.promedio_atencion_segundos)}</small>
        </div>
        <div className="kpi">
          <span>Turnos</span>
          <strong className="kpi__valor">{total.toLocaleString("es-CO")}</strong>
          <small>{m?.atendidos ?? 0} atendidos · {m?.en_espera ?? 0} en espera</small>
        </div>
        <div className="kpi">
          <span>No asistieron</span>
          <strong className="kpi__valor">{m?.no_asistio ?? 0}</strong>
          <small>{m?.cancelados ?? 0} cancelados por el ciudadano</small>
        </div>
        <div className="kpi">
          <span>Asesores activos</span>
          <strong className="kpi__valor">{m?.agentes_activos ?? 0}</strong>
          <small>3 cupos por asesor cada 30 min</small>
        </div>
      </div>

      <div className="rejilla-vivo">
        <article className="panel">
          <header className="panel__cabeza">
            <h2>Sedes ahora</h2>
            <span className="panel__nota">Se actualiza solo cada 15 segundos</span>
          </header>
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
                                {s.asesores.map((a, i) => <i key={i} className={a.estado === "LIBRE" ? "libre" : a.estado === "EN_ATENCION" ? "ocupado" : "llamando"} />)}
                              </span>
                              {s.asesores.length} · {libres} libre{libres === 1 ? "" : "s"}
                            </summary>
                            <ul>
                              {s.asesores.map((a) => (
                                <li key={a.nombre}>
                                  {a.nombre}
                                  <span className={`estado estado--${a.estado === "LIBRE" ? "ok" : a.estado === "EN_ATENCION" ? "atencion" : "llamado"}`}>
                                    {a.estado === "LIBRE" ? "Libre" : a.estado === "EN_ATENCION" ? `Atiende ${a.turno.slice(-6)}` : `Llama ${a.turno.slice(-6)}`}
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
            {(datos?.recientesVivo || []).map((t) => (
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

      <div className="rejilla-3">
        <article className="panel">
          <header className="panel__cabeza"><h2>Estados</h2></header>
          {total ? (
            <>
              <div className="apilada" aria-hidden="true">
                {estados.map(([k, v]) => <span key={k} style={{ flex: v, background: COLORES[k] }} title={`${ESTADOS[k]?.texto}: ${v}`} />)}
              </div>
              <ul className="leyenda">
                {estados.map(([k, v]) => (
                  <li key={k}><i style={{ background: COLORES[k] }} />{ESTADOS[k]?.texto}<strong>{v}</strong></li>
                ))}
              </ul>
            </>
          ) : <p className="vacio">Sin turnos en este periodo.</p>}
        </article>
        <article className="panel">
          <header className="panel__cabeza"><h2>Por sede</h2></header>
          <Barras total={total} filas={(datos?.sedes || []).map((s) => ({ clave: s.punto_id, nombre: s.nombre, valor: s.total_turnos }))} />
        </article>
        <article className="panel">
          <header className="panel__cabeza"><h2>Trámites más pedidos</h2></header>
          <Barras total={total} filas={(datos?.tramites || []).map((t) => ({ clave: t.tramite_id, nombre: t.nombre, valor: t.total_turnos }))} />
        </article>
      </div>
      {!datos && !error && <p className="tenue"><Icon name="reloj" size={14} /> Cargando indicadores…</p>}
    </section>
  );
}
