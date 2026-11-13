/**
 * Gráficas del tablero ejecutivo en SVG propio (sin librerías).
 * Reglas: marcas delgadas, una sola escala por gráfica, el color identifica la
 * serie y el texto va siempre en tinta; las gráficas responden al puntero con
 * un tooltip, y todo valor existe también en la tabla de datos.
 *
 *   sparkline(valores)                      -> HTML (sin interacción)
 *   segmentada(partes, descripcion)         -> HTML
 *   montarLineas(contenedor, { series, etiquetas, alto, descripcion })
 *   montarColumnas(contenedor, { datos, alto, descripcion, destacar })
 *     -> se redibujan solas al cambiar el ancho; devuelven una función de limpieza
 */
import { crudo, esc, html } from "../../utils/dom.js";

export const SERIE = { actual: "#2a78d6", anterior: "#b9b7ae" };
/** Orden categórico validado (CVD) para estados de equipo. */
export const CATEGORICOS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("es-CO"));

/** Ticks redondos para un eje Y que empieza en 0. */
function ticks(max, n = 4) {
  if (max <= 0) return [0, 1];
  const bruto = max / n;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= bruto) || bruto;
  const tope = Math.ceil(max / paso) * paso;
  return Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso);
}

/** Minigráfica de tendencia para una tarjeta (sin ejes; el valor vive en la tarjeta). */
export function sparkline(valores = [], alto = 30, ancho = 120) {
  if (valores.length < 2) return crudo(`<svg width="${ancho}" height="${alto}" aria-hidden="true"></svg>`);
  const max = Math.max(1, ...valores);
  const x = (i) => (i / (valores.length - 1)) * (ancho - 6) + 3;
  const y = (v) => alto - 3 - (v / max) * (alto - 6);
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const u = valores.length - 1;
  return crudo(`
    <svg class="spark" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" aria-hidden="true">
      <path d="${d}L${x(u)},${alto}L${x(0)},${alto}Z" fill="${SERIE.actual}" opacity="0.1" />
      <path d="${d}" fill="none" stroke="${SERIE.actual}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="spark__linea" pathLength="1" />
      <circle cx="${x(u)}" cy="${y(valores[u])}" r="3.5" fill="${SERIE.actual}" stroke="#fff" stroke-width="2" />
    </svg>`);
}

/** Barra segmentada: un todo (equipos) repartido por estado, con leyenda. */
export function segmentada(partes, descripcion) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  if (!total) return html`<p class="vacio">Sin equipos registrados.</p>`;
  return html`
    <div class="seg">
      <div class="seg__barra" role="img" aria-label="${descripcion}: ${partes.map((p) => `${p.nombre} ${p.valor}`).join(", ")}">
        ${partes
          .filter((p) => p.valor > 0)
          .map((p) => {
            const pct = (p.valor / total) * 100;
            return html`<span style="flex-grow: ${p.valor}; background: ${p.color}; color: ${p.tinta || "#fff"}" title="${p.nombre}: ${p.valor} (${Math.round(pct)}%)">${pct >= 9 ? `${Math.round(pct)}%` : ""}</span>`;
          })}
      </div>
      <ul class="leyenda leyenda--seg">
        ${partes.map((p) => html`<li><i style="background: ${p.color}"></i>${p.nombre}<strong>${fmt(p.valor)}</strong></li>`)}
      </ul>
    </div>`;
}

/** Mide el ancho del contenedor y redibuja cuando cambia. */
function conAncho(contenedor, minimo, dibujar) {
  let ancho = 0;
  const ro = new ResizeObserver(([e]) => {
    const nuevo = Math.max(minimo, Math.floor(e.contentRect.width));
    if (nuevo !== ancho) {
      ancho = nuevo;
      dibujar(ancho);
    }
  });
  ro.observe(contenedor);
  ancho = Math.max(minimo, Math.floor(contenedor.clientWidth || minimo));
  dibujar(ancho);
  return () => ro.disconnect();
}

/** Líneas sobre un mismo eje (periodo actual vs anterior) con cruz y tooltip. */
export function montarLineas(contenedor, { series, etiquetas, alto = 230, descripcion = "" }) {
  contenedor.classList.add("graf");
  return conAncho(contenedor, 280, (ancho) => {
    const m = { t: 12, r: 14, b: 26, l: 40 };
    const n = etiquetas.length;
    const max = Math.max(1, ...series.flatMap((s) => s.valores));
    const escala = ticks(max);
    const tope = escala[escala.length - 1];
    const x = (i) => m.l + (n <= 1 ? 0.5 : i / (n - 1)) * (ancho - m.l - m.r);
    const y = (v) => m.t + (1 - v / tope) * (alto - m.t - m.b);
    const cada = Math.max(1, Math.ceil(n / Math.floor((ancho - m.l) / 64)));
    const color0 = series[0]?.color;

    const rejilla = escala
      .map((t) => `<line x1="${m.l}" x2="${ancho - m.r}" y1="${y(t)}" y2="${y(t)}" class="${t ? "graf__grid" : "graf__base"}" />
        <text x="${m.l - 8}" y="${y(t)}" class="graf__tick" text-anchor="end" dominant-baseline="middle">${fmt(t)}</text>`)
      .join("");
    const ejeX = etiquetas
      .map((e, i) =>
        (i % cada === 0 && n - 1 - i >= cada * 0.7) || i === n - 1
          ? `<text x="${x(i)}" y="${alto - 8}" class="graf__tick" text-anchor="${i === 0 ? "start" : i === n - 1 ? "end" : "middle"}">${esc(e)}</text>`
          : "",
      )
      .join("");
    const lineas = [...series]
      .reverse()
      .map((s, k) => {
        const d = s.valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
        const principal = k === series.length - 1;
        const area = principal && n > 1 ? `<path d="${d}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z" fill="url(#area-lineas)" />` : "";
        return `${area}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"
          ${principal ? 'class="graf__trazo" pathLength="1"' : 'stroke-dasharray="4 4"'} />`;
      })
      .join("");
    const ultimo = n > 0 ? `<circle data-ultimo cx="${x(n - 1)}" cy="${y(series[0].valores[n - 1] || 0)}" r="4.5" fill="${color0}" stroke="#fff" stroke-width="2" />` : "";

    contenedor.innerHTML = `
      <svg width="${ancho}" height="${alto}" role="img" aria-label="${esc(descripcion)}" tabindex="0">
        <defs><linearGradient id="area-lineas" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color0}" stop-opacity="0.16" /><stop offset="1" stop-color="${color0}" stop-opacity="0" /></linearGradient></defs>
        ${rejilla}${ejeX}${lineas}${ultimo}<g data-cruz pointer-events="none"></g>
      </svg>
      <div class="graf__tip" role="status" hidden></div>`;

    const svg = contenedor.querySelector("svg");
    const cruz = svg.querySelector("[data-cruz]");
    const tip = contenedor.querySelector(".graf__tip");
    const punto = svg.querySelector("[data-ultimo]");
    let actual = null;

    function mostrar(i) {
      actual = i;
      if (i == null) {
        cruz.innerHTML = "";
        tip.hidden = true;
        if (punto) punto.style.display = "";
        return;
      }
      if (punto) punto.style.display = "none";
      cruz.innerHTML =
        `<line x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${alto - m.b}" class="graf__cruz" />` +
        series.map((s) => `<circle cx="${x(i)}" cy="${y(s.valores[i] || 0)}" r="4.5" fill="${s.color}" stroke="#fff" stroke-width="2" />`).join("");
      tip.hidden = false;
      tip.style.left = `${Math.min(ancho - 170, Math.max(0, x(i) + 12))}px`;
      tip.style.top = "8px";
      tip.innerHTML = String(html`
        <span class="graf__tip-titulo">${etiquetas[i]}</span>
        ${series.map((s) => html`<span class="graf__tip-fila"><i style="background: ${s.color}"></i><strong>${fmt(s.valores[i])}</strong><small>${s.nombre}</small></span>`)}`);
    }
    svg.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.round(((e.clientX - r.left - m.l) / (ancho - m.l - m.r)) * (n - 1));
      mostrar(Math.max(0, Math.min(n - 1, i)));
    });
    svg.addEventListener("pointerleave", () => mostrar(null));
    svg.addEventListener("focus", () => mostrar(actual ?? n - 1));
    svg.addEventListener("blur", () => mostrar(null));
    svg.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") mostrar(Math.min(n - 1, (actual ?? -1) + 1));
      if (e.key === "ArrowLeft") mostrar(Math.max(0, (actual ?? n) - 1));
      if (e.key === "Escape") mostrar(null);
    });
  });
}

/** Columnas de una sola serie (p. ej. demanda por hora). */
export function montarColumnas(contenedor, { datos, alto = 200, descripcion = "", unidad = "turnos", destacar }) {
  contenedor.classList.add("graf");
  return conAncho(contenedor, 240, (ancho) => {
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

    const rejilla = escala
      .map((t) => `<line x1="${m.l}" x2="${ancho - m.r}" y1="${alto - m.b - h(t)}" y2="${alto - m.b - h(t)}" class="${t ? "graf__grid" : "graf__base"}" />
        <text x="${m.l - 7}" y="${alto - m.b - h(t)}" class="graf__tick" text-anchor="end" dominant-baseline="middle">${fmt(t)}</text>`)
      .join("");
    const columnas = datos
      .map((d, i) => {
        const cx = m.l + banda * i + banda / 2;
        const alt = Math.max(d.valor ? 2 : 0, h(d.valor));
        const r = Math.min(4, grueso / 2, alt);
        const x0 = cx - grueso / 2;
        const y0 = alto - m.b - alt;
        const ruta = `M${x0},${alto - m.b}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + grueso - r}Q${x0 + grueso},${y0} ${x0 + grueso},${y0 + r}V${alto - m.b}Z`;
        return `<g class="graf__col" data-i="${i}" tabindex="0" role="img" aria-label="${esc(d.etiqueta)}: ${fmt(d.valor)} ${unidad}">
          <rect x="${m.l + banda * i}" y="${m.t}" width="${banda}" height="${alto - m.t - m.b}" fill="transparent" />
          ${alt > 0 ? `<path d="${ruta}" fill="${destacar?.(d) ? SERIE.actual : "#86b6ef"}" style="animation-delay: ${i * 18}ms" class="graf__barra" />` : ""}
          ${i % cada === 0 ? `<text x="${cx}" y="${alto - 7}" class="graf__tick" text-anchor="middle">${esc(d.corta ?? d.etiqueta)}</text>` : ""}
          ${i === pico && d.valor > 0 ? `<text x="${cx}" y="${y0 - 5}" class="graf__valor" text-anchor="middle" data-pico>${fmt(d.valor)}</text>` : ""}
        </g>`;
      })
      .join("");

    contenedor.innerHTML = `
      <svg width="${ancho}" height="${alto}" role="img" aria-label="${esc(descripcion)}">${rejilla}${columnas}</svg>
      <div class="graf__tip" role="status" hidden></div>`;
    const svg = contenedor.querySelector("svg");
    const tip = contenedor.querySelector(".graf__tip");
    const etiquetaPico = svg.querySelector("[data-pico]");

    function mostrar(i) {
      svg.querySelectorAll(".graf__barra").forEach((b) => {
        b.style.opacity = i == null || b.closest("[data-i]").dataset.i === String(i) ? 1 : 0.55;
      });
      if (etiquetaPico) etiquetaPico.style.display = i == null ? "" : "none";
      if (i == null || !datos[i]) {
        tip.hidden = true;
        return;
      }
      tip.hidden = false;
      tip.style.left = `${Math.min(ancho - 150, Math.max(0, m.l + banda * i + banda))}px`;
      tip.style.top = "4px";
      tip.innerHTML = String(html`
        <span class="graf__tip-titulo">${datos[i].etiqueta}</span>
        <span class="graf__tip-fila"><i style="background: ${SERIE.actual}"></i><strong>${fmt(datos[i].valor)}</strong><small>${unidad}</small></span>`);
    }
    svg.addEventListener("pointerover", (e) => {
      const g = e.target.closest("[data-i]");
      if (g) mostrar(Number(g.dataset.i));
    });
    svg.addEventListener("focusin", (e) => {
      const g = e.target.closest("[data-i]");
      if (g) mostrar(Number(g.dataset.i));
    });
    svg.addEventListener("pointerleave", () => mostrar(null));
    svg.addEventListener("focusout", () => mostrar(null));
  });
}
