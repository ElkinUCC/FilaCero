import { useState } from "react";
import { api, guardarSesion } from "../api";
import { leerLocal } from "../util";
import Icon from "./Icon";
import { Modal } from "./Modal";

const REGLAS = [
  { texto: "8 caracteres o más", ok: (c) => c.length >= 8 },
  { texto: "Letras y números", ok: (c) => /[a-z]/i.test(c) && /\d/.test(c) },
];

function Formulario({ obligatorio, onListo }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [ver, setVer] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const valida = REGLAS.every((r) => r.ok(nueva)) && nueva === confirmar && actual;

  async function guardar(e) {
    e.preventDefault();
    if (!valida) return;
    setGuardando(true);
    setError("");
    try {
      const r = await api.post("/usuarios/me/clave", { actual, nueva });
      // El servidor revoca las sesiones anteriores y entrega un token nuevo.
      guardarSesion(r.access_token || leerLocal("filacero_token"), r.usuario);
      onListo(r.usuario);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  const tipo = ver ? "text" : "password";
  return (
    <form id="form-clave" className="formulario" onSubmit={guardar}>
      <label>
        <span className="etiqueta">{obligatorio ? "Contraseña temporal" : "Contraseña actual"}</span>
        <span className="campo"><Icon name="llave" size={17} /><input type={tipo} value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" /></span>
      </label>
      <label>
        <span className="etiqueta">Nueva contraseña</span>
        <span className="campo campo--accion">
          <Icon name="escudo" size={17} />
          <input type={tipo} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" />
          <button type="button" className="campo__boton" onClick={() => setVer((v) => !v)}>{ver ? "Ocultar" : "Mostrar"}</button>
        </span>
      </label>
      <label>
        <span className="etiqueta">Repite la nueva contraseña</span>
        <span className="campo"><Icon name="escudo" size={17} /><input type={tipo} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" /></span>
      </label>
      <ul className="reglas">
        {REGLAS.map((r) => <li key={r.texto} className={r.ok(nueva) ? "ok" : ""}><Icon name="check" size={14} /> {r.texto}</li>)}
        <li className={nueva && nueva === confirmar ? "ok" : ""}><Icon name="check" size={14} /> Ambas coinciden</li>
      </ul>
      {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      {obligatorio && (
        <button className="btn btn--primario btn--ancho" disabled={!valida || guardando}>
          {guardando ? "Guardando…" : "Guardar y continuar"}
        </button>
      )}
    </form>
  );
}

/** Pantalla completa: se muestra cuando la cuenta tiene una clave temporal. */
export function CambioObligatorio({ usuario, onListo, onSalir }) {
  return (
    <div className="clave-obligatoria">
      <div className="login">
        <span className="marca__logo" aria-hidden="true">F0</span>
        <h2>Crea tu contraseña</h2>
        <p>Hola {usuario.nombre?.split(" ")[0]}. Ingresaste con una contraseña temporal; por seguridad debes cambiarla antes de continuar.</p>
        <Formulario obligatorio onListo={onListo} />
        <button type="button" className="btn btn--fantasma-oscuro" onClick={onSalir}>Salir</button>
      </div>
    </div>
  );
}

/** Ventana "Cambiar mi contraseña" desde el menú del usuario. */
export function CambiarMiClave({ onCerrar, onListo }) {
  return (
    <Modal
      titulo="Cambiar mi contraseña"
      onCerrar={onCerrar}
      ancho={440}
      pie={
        <>
          <button type="button" className="btn btn--suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-clave" className="btn btn--primario">Guardar contraseña</button>
        </>
      }
    >
      <Formulario onListo={(u) => { onListo?.(u); onCerrar(); }} />
    </Modal>
  );
}
