import { useEffect, useRef, useState } from "react";

export const SERIE = { actual: "#2a78d6", anterior: "#b9b7ae" };
/** Orden categórico validado (CVD) para estados de equipo. */
export const CATEGORICOS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

/** Número que cuenta hasta su valor (respeta "reducir movimiento"). */
export function useConteo(valor, ms = 700) {
  const [v, setV] = useState(valor ?? 0);
  const previo = useRef(valor ?? 0);
  useEffect(() => {
    if (valor == null) return undefined;
    const desde = Number(previo.current) || 0;
    previo.current = valor;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducido || desde === valor) {
      const t = window.setTimeout(() => setV(valor), 0);
      return () => window.clearTimeout(t);
    }
    const inicio = performance.now();
    let marco;
    const paso = (t) => {
      const k = Math.min(1, (t - inicio) / ms);
      setV(desde + (valor - desde) * (1 - (1 - k) ** 3));
      if (k < 1) marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [valor, ms]);
  return valor == null ? null : v;
}
