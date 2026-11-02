export default function Switch({ activo, onChange, disabled, etiqueta }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={etiqueta}
      className={`switch ${activo ? "switch--on" : ""}`}
      onClick={() => onChange(!activo)}
      disabled={disabled}
    >
      <span />
    </button>
  );
}
