import { useEffect, useRef, useState } from "react";
import { horaDe, PRESENCIAS } from "../../utils/formatters";
import Icon from "../ui/Icon";

/**
 * Selector de lo que está haciendo el asesor: Disponible, En pausa, En almuerzo
 * o Fuera de turno. El panel administrativo lo muestra como su estado actual.
 */
export default function Presencia({ valor = "DISPONIBLE", desde, onCambiar, bloqueado }) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);
  const actual = PRESENCIAS[valor] || PRESENCIAS.DISPONIBLE;

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

  return (
    <div className="presencia" ref={raiz}>
      <button
        type="button"
        className={`presencia__boton presencia--${actual.tono}`}
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        title={desde ? `Desde las ${horaDe(desde)}` : "Tu estado"}
      >
        <i aria-hidden="true" />
        <span>{actual.texto}</span>
        <Icon name="abajo" size={14} />
      </button>
      {abierto && (
        <div className="presencia__menu" role="menu">
          {Object.entries(PRESENCIAS).map(([clave, p]) => (
            <button
              key={clave}
              type="button"
              role="menuitemradio"
              aria-checked={clave === valor}
              disabled={bloqueado && clave !== "DISPONIBLE"}
              className={`presencia__op presencia--${p.tono} ${clave === valor ? "activo" : ""}`}
              onClick={() => { setAbierto(false); if (clave !== valor) onCambiar(clave); }}
            >
              <i aria-hidden="true" />
              <Icon name={p.icono} size={16} />
              <span>{p.texto}</span>
              {clave === valor && <Icon name="check" size={15} className="presencia__check" />}
            </button>
          ))}
          {bloqueado && <p className="presencia__nota">Termina el turno en curso para salir a pausa.</p>}
        </div>
      )}
    </div>
  );
}
