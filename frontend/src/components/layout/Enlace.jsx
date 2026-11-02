import { navegar } from "../../router/navegacion";

/**
 * Enlace interno: es un <a> real (se puede abrir en otra pestaña, lo anuncian
 * los lectores de pantalla) pero navega sin recargar.
 */
export default function Enlace({ href, onClick, children, ...props }) {
  function alHacerClic(e) {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navegar(href);
  }
  return (
    <a href={href} onClick={alHacerClic} {...props}>
      {children}
    </a>
  );
}
