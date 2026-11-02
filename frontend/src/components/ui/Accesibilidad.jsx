import { useEffect, useRef, useState } from "react";
import { cambiarPreferencia, usePreferencias } from "../../hooks/useAccesibilidad";
import Icon from "./Icon";

/* ------------------------------------------------------------------
   Menú de accesibilidad
   ------------------------------------------------------------------ */

const OPCIONES = [
  { clave: "texto", titulo: "Texto grande", detalle: "Agranda toda la pantalla un 15%" },
  { clave: "contraste", titulo: "Alto contraste", detalle: "Colores más marcados y bordes visibles" },
  { clave: "voz", titulo: "Leer avisos en voz alta", detalle: "Turnos llamados y cambios importantes" },
];

export function MenuAccesibilidad({ className = "", arriba = false }) {
  const prefs = usePreferencias();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => raiz.current && !raiz.current.contains(e.target) && setAbierto(false);
    const esc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const activas = OPCIONES.filter((o) => prefs[o.clave]).length;

  return (
    <div className={`acc ${arriba ? "acc--arriba" : ""} ${className}`} ref={raiz}>
      <button
        type="button"
        className="acc__boton"
        aria-expanded={abierto}
        aria-controls="menu-accesibilidad"
        onClick={() => setAbierto((a) => !a)}
        title="Opciones de accesibilidad"
      >
        <Icon name="accesibilidad" size={18} />
        <span className="acc__texto">Accesibilidad</span>
        {activas > 0 && <span className="acc__cuenta" aria-label={`${activas} activas`}>{activas}</span>}
      </button>
      {abierto && (
        <div className="acc__panel" id="menu-accesibilidad" role="group" aria-label="Opciones de accesibilidad">
          {OPCIONES.map((o) => (
            <label key={o.clave} className="acc__opcion">
              <span>
                <strong>{o.titulo}</strong>
                <small>{o.detalle}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={prefs[o.clave]}
                onChange={(e) => {
                  cambiarPreferencia(o.clave, e.target.checked);
                  if (o.clave === "voz" && e.target.checked) hablar("Avisos por voz activados.", { forzar: true });
                }}
              />
            </label>
          ))}
          {!("speechSynthesis" in window) && <p className="acc__nota">Este navegador no permite lectura en voz alta.</p>}
        </div>
      )}
    </div>
  );
}

/** Enlace para saltar la navegación con teclado o lector de pantalla. */
export function SaltarAlContenido({ destino = "contenido" }) {
  return <a className="saltar" href={`#${destino}`}>Saltar al contenido</a>;
}

