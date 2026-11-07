import { useEffect, useRef } from "react";
import Icon from "./Icon";

/**
 * Panel lateral de detalle ("otra vista corta ahí mismo").
 *
 * Las tablas del panel muestran solo lo esencial; al hacer clic en el
 * registro se abre este panel con la información completa y sus acciones.
 * Accesible: Esc cierra, el foco queda atrapado y vuelve al origen al cerrar.
 */
export default function PanelDetalle({ titulo, subtitulo, insignia, onCerrar, acciones, children }) {
  const caja = useRef(null);

  useEffect(() => {
    const anterior = document.activeElement;
    caja.current?.querySelector(".detalle__cerrar")?.focus();
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "Tab" && caja.current) {
        const enfocables = [...caja.current.querySelectorAll(
          'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])'
        )];
        if (!enfocables.length) return;
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    window.addEventListener("keydown", tecla);
    return () => {
      window.removeEventListener("keydown", tecla);
      anterior?.focus?.();
    };
  }, [onCerrar]);

  return (
    <div className="detalle-velo" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <aside className="detalle" ref={caja} role="dialog" aria-modal="true" aria-labelledby="detalle-titulo">
        <header className="detalle__cabeza">
          <div>
            <h2 id="detalle-titulo">{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
            {insignia && <div className="detalle__insignia">{insignia}</div>}
          </div>
          <button type="button" className="icono-btn detalle__cerrar" onClick={onCerrar} aria-label="Cerrar detalle">
            <Icon name="cerrar" size={18} />
          </button>
        </header>
        <div className="detalle__cuerpo">{children}</div>
        {acciones && <footer className="detalle__pie">{acciones}</footer>}
      </aside>
    </div>
  );
}

/** Bloque de datos del detalle: [["Etiqueta", valor], ...]. */
export function Datos({ titulo, filas }) {
  const visibles = filas.filter(Boolean);
  return (
    <section className="detalle__bloque">
      {titulo && <h3>{titulo}</h3>}
      <dl className="detalle__datos">
        {visibles.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor === null || valor === undefined || valor === "" ? <span className="tenue">—</span> : valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
