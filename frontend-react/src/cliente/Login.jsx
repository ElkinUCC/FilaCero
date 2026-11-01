import { useEffect, useRef, useState } from "react";
import { api, guardarSesion } from "../api";
import Icon from "../ui/Icon";

export default function Login({ onCerrar, onIngresar }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const primerCampo = useRef(null);

  useEffect(() => {
    primerCampo.current?.focus();
    const esc = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "Tab") {
        const caja = primerCampo.current?.closest("form");
        const enfocables = caja ? [...caja.querySelectorAll("button:not(:disabled), input:not(:disabled)")] : [];
        if (!enfocables.length) return;
        const [primero, ultimo] = [enfocables[0], enfocables[enfocables.length - 1]];
        if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
      }
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  async function ingresar(e) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      const r = await api.post("/usuarios/login", { correo: correo.trim(), password }, { sinToken: true });
      if (!["ADMIN", "SUPERVISOR", "AGENTE"].includes(r.usuario?.rol)) {
        throw new Error("Este acceso es solo para el personal de FilaCero.");
      }
      guardarSesion(r.access_token, r.usuario);
      onIngresar(r.usuario);
    } catch (err) {
      setError(err.message);
      setPassword("");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="velo" role="dialog" aria-modal="true" aria-labelledby="login-titulo" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <form className="login" onSubmit={ingresar}>
        <button type="button" className="login__cerrar" onClick={onCerrar} aria-label="Cerrar">
          <Icon name="cerrar" size={18} />
        </button>
        <span className="marca__logo" aria-hidden="true">F0</span>
        <h2 id="login-titulo">Acceso del personal</h2>
        <p>Para asesores, supervisores y administradores.</p>

        <label className="campo">
          <Icon name="usuario" size={17} />
          <input
            ref={primerCampo}
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="Correo"
            autoComplete="username"
            aria-label="Correo"
            required
          />
        </label>
        <label className="campo campo--accion">
          <Icon name="llave" size={17} />
          <input
            type={ver ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            aria-label="Contraseña"
            required
          />
          <button type="button" className="campo__boton" onClick={() => setVer((v) => !v)}>
            {ver ? "Ocultar" : "Mostrar"}
          </button>
        </label>

        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}

        <button className="btn btn--primario btn--ancho" disabled={cargando || !correo || !password}>
          {cargando ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
