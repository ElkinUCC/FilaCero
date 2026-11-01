import { useEffect, useRef } from "react";
import Icon from "./Icon";

/** Ventana emergente accesible: Esc cierra, foco inicial y fondo bloqueado. */
export function Modal({ titulo, descripcion, onCerrar, children, pie, ancho = 480 }) {
  const caja = useRef(null);

  useEffect(() => {
    const anterior = document.activeElement;
    const primero = caja.current?.querySelector("input, select, textarea, button:not(.modal__cerrar)");
    primero?.focus();
    const tecla = (e) => {
      if (e.key === "Escape") onCerrar();
      // Tab no se escapa de la ventana mientras está abierta.
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
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
      anterior?.focus?.();
    };
  }, [onCerrar]);

  return (
    <div className="velo" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" ref={caja} role="dialog" aria-modal="true" aria-labelledby="modal-titulo" style={{ width: `min(${ancho}px, 100%)` }}>
        <header className="modal__cabeza">
          <div>
            <h2 id="modal-titulo">{titulo}</h2>
            {descripcion && <p>{descripcion}</p>}
          </div>
          <button type="button" className="icono-btn modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
            <Icon name="cerrar" size={18} />
          </button>
        </header>
        <div className="modal__cuerpo">{children}</div>
        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

/** Confirmación para acciones destructivas. */
export function Confirmar({ titulo, mensaje, textoConfirmar = "Confirmar", peligro = true, ocupado, error, extra, onConfirmar, onCerrar }) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      ancho={480}
      pie={
        <>
          {extra}
          <button type="button" className="btn btn--suave" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
          <button type="button" className={`btn ${peligro ? "btn--peligro" : "btn--primario"}`} onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? "Procesando…" : textoConfirmar}
          </button>
        </>
      }
    >
      <p className="modal__texto">{mensaje}</p>
      {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
    </Modal>
  );
}
