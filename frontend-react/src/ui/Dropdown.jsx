import { useEffect, useId, useMemo, useRef, useState } from "react";
import Icon from "./Icon";

/**
 * Selector desplegable accesible.
 * options: [{ value, label, hint, group, disabled }]
 */
export default function Dropdown({
  label,
  icon,
  value,
  options = [],
  onChange,
  placeholder = "Selecciona",
  disabled = false,
  loading = false,
  emptyText = "No hay opciones",
  searchable = false,
  className = "",
  ariaLabel,
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [filtro, setFiltro] = useState("");
  const raiz = useRef(null);
  const lista = useRef(null);
  const id = useId();

  const visibles = useMemo(() => {
    const f = filtro.trim().toLowerCase();
    return f ? options.filter((o) => String(o.label).toLowerCase().includes(f)) : options;
  }, [options, filtro]);

  const seleccionada = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!abierto) return undefined;
    function fuera(e) {
      if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  useEffect(() => {
    if (!abierto || activo < 0 || !lista.current) return;
    lista.current.querySelector(`[data-indice="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo, abierto]);

  function abrir() {
    if (disabled) return;
    setFiltro("");
    setActivo(Math.max(0, visibles.findIndex((o) => String(o.value) === String(value))));
    setAbierto(true);
  }

  function elegir(opcion) {
    if (!opcion || opcion.disabled) return;
    onChange?.(opcion.value, opcion);
    setAbierto(false);
  }

  function teclado(e) {
    if (!abierto && ["ArrowDown", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      abrir();
      return;
    }
    if (!abierto) return;
    if (e.key === "Escape") { e.preventDefault(); setAbierto(false); }
    if (e.key === "ArrowDown") { e.preventDefault(); setActivo((i) => Math.min(visibles.length - 1, i + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActivo((i) => Math.max(0, i - 1)); }
    if (e.key === "Enter") { e.preventDefault(); elegir(visibles[activo]); }
  }

  return (
    <div className={`dd ${abierto ? "dd--abierto" : ""} ${disabled ? "dd--inactivo" : ""} ${className}`} ref={raiz}>
      {label && <span className="dd__label" id={`${id}-label`}>{label}</span>}
      <button
        type="button"
        className="dd__boton"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-lista` : undefined}
        aria-activedescendant={abierto && activo >= 0 && visibles[activo] ? `${id}-op-${activo}` : undefined}
        aria-labelledby={label ? `${id}-label ${id}-valor` : undefined}
        aria-label={label ? undefined : `${ariaLabel || placeholder}: ${seleccionada ? seleccionada.label : "sin seleccionar"}`}
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={teclado}
      >
        {icon && <Icon name={icon} size={17} className="dd__icono" />}
        <span className={`dd__valor ${seleccionada ? "" : "dd__valor--vacio"}`} id={`${id}-valor`}>
          {loading ? "Cargando…" : seleccionada ? seleccionada.label : placeholder}
          {seleccionada?.hint && !loading && <small>{seleccionada.hint}</small>}
        </span>
        <Icon name="abajo" size={16} className="dd__flecha" />
      </button>

      {abierto && (
        <div className="dd__panel">
          {searchable && (
            <div className="dd__buscar">
              <Icon name="buscar" size={15} />
              <input
                autoFocus
                value={filtro}
                onChange={(e) => { setFiltro(e.target.value); setActivo(0); }}
                onKeyDown={teclado}
                placeholder="Buscar"
                aria-label="Buscar opción"
              />
            </div>
          )}
          <ul className="dd__lista" role="listbox" id={`${id}-lista`} ref={lista} aria-labelledby={label ? `${id}-label` : undefined} aria-label={label ? undefined : ariaLabel || placeholder}>
            {visibles.length === 0 && <li className="dd__vacio">{emptyText}</li>}
            {visibles.map((o, i) => {
              const cabecera = o.group && o.group !== visibles[i - 1]?.group ? o.group : null;
              const elegida = String(o.value) === String(value);
              return (
                <li key={o.value} role="presentation">
                  {cabecera && <div className="dd__grupo">{cabecera}</div>}
                  <div
                    role="option"
                    id={`${id}-op-${i}`}
                    aria-selected={elegida}
                    aria-disabled={o.disabled || undefined}
                    data-indice={i}
                    className={`dd__opcion ${i === activo ? "dd__opcion--activa" : ""} ${elegida ? "dd__opcion--elegida" : ""}`}
                    onPointerEnter={() => setActivo(i)}
                    onClick={() => elegir(o)}
                  >
                    <span>{o.label}</span>
                    {o.hint && <small>{o.hint}</small>}
                    {elegida && <Icon name="check" size={15} className="dd__check" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
