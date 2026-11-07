import { useEffect, useId, useRef, useState } from "react";
import { SERIE } from "../../utils/graficas";

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("es-CO"));

/**
 * Gráficas del tablero ejecutivo en SVG propio (sin librerías).
 * Reglas: marcas delgadas, una sola escala por gráfica, el color identifica la
 * serie y el texto va siempre en tinta; cada gráfica responde al puntero y al
 * teclado con un tooltip, y todo valor existe también en la tabla de datos.
 */

/** Ticks redondos para un eje Y que empieza en 0. */
function ticks(max, n = 4) {
  if (max <= 0) return [0, 1];
  const bruto = max / n;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= bruto) || bruto;
  const tope = Math.ceil(max / paso) * paso;
  return Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
}

/** Minigráfica de tendencia para una tarjeta (sin ejes; el valor vive en la tarjeta). */
export function Sparkline({ valores = [], alto = 30, ancho = 120 }) {
  if (valores.length < 2) return <svg width={ancho} height={alto} aria-hidden="true" />;
  const max = Math.max(1, ...valores);
  const x = (i) => (i / (valores.length - 1)) * (ancho - 6) + 3;
  const y = (v) => alto - 3 - (v / max) * (alto - 6);
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ultimo = valores.length - 1;
  return (
    <svg className="spark" width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
      <path d={`${d}L${x(ultimo)},${alto}L${x(0)},${alto}Z`} fill={SERIE.actual} opacity="0.1" />
      <path d={d} fill="none" stroke={SERIE.actual} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="spark__linea" />
      <circle cx={x(ultimo)} cy={y(valores[ultimo])} r="3.5" fill={SERIE.actual} stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

/**
 * Líneas sobre un mismo eje (periodo actual vs anterior) con cruz que sigue al
 * puntero y tooltip con todas las series del punto.
 * series: [{ nombre, color, valores: number[] }] · etiquetas: string[] (eje X)
 */
export function Lineas({ series, etiquetas, alto = 230, descripcion }) {
  const [hover, setHover] = useState(null);
  const caja = useRef(null);
  const [ancho, setAncho] = useState(640);
  const id = useId();
  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = { t: 12, r: 14, b: 26, l: 40 };
  const n = etiquetas.length;
  const max = Math.max(1, ...series.flatMap((s) => s.valores));
  const escala = ticks(max);
  const tope = escala[escala.length - 1];
  const x = (i) => m.l + (n <= 1 ? 0.5 : i / (n - 1)) * (ancho - m.l - m.r);
  const y = (v) => m.t + (1 - v / tope) * (alto - m.t - m.b);
  const cada = Math.max(1, Math.ceil(n / Math.floor((ancho - m.l) / 64)));

  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - m.l) / (ancho - m.l - m.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }
  function teclas(e) {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    if (e.key === "Escape") setHover(null);
  }

  return (
    <div className="graf" ref={caja}>
      <svg
        width={ancho} height={alto} role="img" aria-label={descripcion} tabIndex={0}
        onPointerMove={mover} onPointerLeave={() => setHover(null)} onKeyDown={teclas}
        onFocus={() => setHover((h) => h ?? n - 1)} onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={series[0]?.color} stopOpacity="0.16" />
            <stop offset="1" stopColor={series[0]?.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {escala.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={ancho - m.r} y1={y(t)} y2={y(t)} className={t ? "graf__grid" : "graf__base"} />
            <text x={m.l - 8} y={y(t)} className="graf__tick" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
          </g>
        ))}
        {etiquetas.map((e, i) => ((i % cada === 0 && n - 1 - i >= cada * 0.7) || i === n - 1) && (
          <text key={e + i} x={x(i)} y={alto - 8} className="graf__tick" textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{e}</text>
        ))}
        {[...series].reverse().map((s, k) => {
          const d = s.valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
          const principal = k === series.length - 1;
          return (
            <g key={s.nombre}>
              {principal && n > 1 && <path d={`${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${id}-area)`} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={principal ? undefined : "4 4"} className={principal ? "graf__trazo" : ""} pathLength={principal ? 1 : undefined} />
            </g>
          );
        })}
        {n > 0 && hover == null && (
          <circle cx={x(n - 1)} cy={y(series[0].valores[n - 1] || 0)} r="4.5" fill={series[0].color} stroke="#fff" strokeWidth="2" />
        )}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={alto - m.b} className="graf__cruz" />
            {series.map((s) => (
              <circle key={s.nombre} cx={x(hover)} cy={y(s.valores[hover] || 0)} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="graf__tip" style={{ left: Math.min(ancho - 170, Math.max(0, x(hover) + 12)), top: 8 }} role="status">
          <span className="graf__tip-titulo">{etiquetas[hover]}</span>
          {series.map((s) => (
            <span key={s.nombre} className="graf__tip-fila">
              <i style={{ background: s.color }} />
              <strong>{fmt(s.valores[hover])}</strong>
              <small>{s.nombre}{s.etiquetas ? ` · ${s.etiquetas[hover]}` : ""}</small>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Columnas de una sola serie (p. ej. demanda por hora). Cada columna es su propio objetivo. */
export function Columnas({ datos, alto = 200, descripcion, unidad = "turnos", destacar }) {
  const [hover, setHover] = useState(null);
  const caja = useRef(null);
  const [ancho, setAncho] = useState(420);
  useEffect(() => {
    const el = caja.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const m = { t: 18, r: 6, b: 24, l: 34 };
  const n = datos.length || 1;
  const banda = (ancho - m.l - m.r) / n;
  const grueso = Math.min(24, Math.max(3, banda - 2));
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const escala = ticks(max, 3);
  const tope = escala[escala.length - 1];
  const h = (v) => (v / tope) * (alto - m.t - m.b);
  const pico = datos.reduce((a, d, i) => (d.valor > (datos[a]?.valor ?? -1) ? i : a), 0);
  const cada = Math.max(1, Math.ceil(n / Math.floor((ancho - m.l) / 34)));

  return (
    <div className="graf" ref={caja}>
      <svg width={ancho} height={alto} role="img" aria-label={descripcion} onPointerLeave={() => setHover(null)}>
        {escala.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={ancho - m.r} y1={alto - m.b - h(t)} y2={alto - m.b - h(t)} className={t ? "graf__grid" : "graf__base"} />
            <text x={m.l - 7} y={alto - m.b - h(t)} className="graf__tick" textAnchor="end" dominantBaseline="middle">{fmt(t)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const cx = m.l + banda * i + banda / 2;
          const alt = Math.max(d.valor ? 2 : 0, h(d.valor));
          const r = Math.min(4, grueso / 2, alt);
          const x0 = cx - grueso / 2;
          const y0 = alto - m.b - alt;
          const ruta = `M${x0},${alto - m.b}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + grueso - r}Q${x0 + grueso},${y0} ${x0 + grueso},${y0 + r}V${alto - m.b}Z`;
          return (
            <g key={d.clave} tabIndex={0} role="img" aria-label={`${d.etiqueta}: ${fmt(d.valor)} ${unidad}`}
              onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="graf__col">
              <rect x={m.l + banda * i} y={m.t} width={banda} height={alto - m.t - m.b} fill="transparent" />
              {alt > 0 && <path d={ruta} fill={destacar?.(d) ? SERIE.actual : "#86b6ef"} opacity={hover == null || hover === i ? 1 : 0.55} style={{ animationDelay: `${i * 18}ms` }} className="graf__barra" />}
              {(i % cada === 0) && <text x={cx} y={alto - 7} className="graf__tick" textAnchor="middle">{d.corta ?? d.etiqueta}</text>}
              {i === pico && d.valor > 0 && hover == null && <text x={cx} y={y0 - 5} className="graf__valor" textAnchor="middle">{fmt(d.valor)}</text>}
            </g>
          );
        })}
      </svg>
      {hover != null && datos[hover] && (
        <div className="graf__tip" style={{ left: Math.min(ancho - 150, Math.max(0, m.l + banda * hover + banda)), top: 4 }} role="status">
          <span className="graf__tip-titulo">{datos[hover].etiqueta}</span>
          <span className="graf__tip-fila"><i style={{ background: SERIE.actual }} /><strong>{fmt(datos[hover].valor)}</strong><small>{unidad}</small></span>
        </div>
      )}
    </div>
  );
}

/** Barra segmentada alta: un todo (equipos) repartido por estado, con leyenda. */
export function Segmentada({ partes, descripcion }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  const [hover, setHover] = useState(null);
  if (!total) return <p className="vacio">Sin equipos registrados.</p>;
  return (
    <div className="seg">
      <div className="seg__barra" role="img" aria-label={`${descripcion}: ${partes.map((p) => `${p.nombre} ${p.valor}`).join(", ")}`}>
        {partes.filter((p) => p.valor > 0).map((p) => {
          const pct = (p.valor / total) * 100;
          return (
            <span key={p.nombre} style={{ flexGrow: p.valor, background: p.color, color: p.tinta || "#fff" }}
              onPointerEnter={() => setHover(p)} onPointerLeave={() => setHover(null)} tabIndex={0}
              onFocus={() => setHover(p)} onBlur={() => setHover(null)}
              title={`${p.nombre}: ${p.valor} (${Math.round(pct)}%)`}>
              {pct >= 9 ? `${Math.round(pct)}%` : ""}
            </span>
          );
        })}
      </div>
      <ul className="leyenda leyenda--seg">
        {partes.map((p) => (
          <li key={p.nombre} className={hover?.nombre === p.nombre ? "activo" : ""}>
            <i style={{ background: p.color }} />{p.nombre}<strong>{fmt(p.valor)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
