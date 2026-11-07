/** Enlace invisible para saltar la navegación con el teclado (Tab). */
export function SaltarAlContenido({ destino = "contenido" }) {
  return <a className="saltar" href={`#${destino}`}>Saltar al contenido</a>;
}
