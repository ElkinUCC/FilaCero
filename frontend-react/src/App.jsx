import { useState } from "react";

import {

  apiRequest,

  guardarSesion,

  cerrarSesion,

  obtenerUsuario,

} from "./api";

import ReservarTurno from "./ReservarTurno";

import AdminCatalogo from "./AdminCatalogo";

import "./App.css";

import AdminDashboard from "./AdminDashboard";

const MENUS = {

  ADMIN: ["Resumen", "Sedes", "Trámites", "Agentes", "Historial"],

  AGENTE: ["Mi cola", "Turno actual"],

  CLIENTE: ["Mis turnos", "Reservar turno"],

};

const RUTAS = {

  Resumen: "/admin/agentes/metricas",

  Sedes: "/sedes/",

  "Trámites": "/tramites/",

  Agentes: "/admin/agentes/",

  Historial: "/admin/agentes/historial",

  "Mi cola": "/agente/cola",

  "Turno actual": "/agente/actual",

  "Mis turnos": "/turnos/mis-turnos",

};

export default function App() {

  const [usuario, setUsuario] = useState(obtenerUsuario);

  const [correo, setCorreo] = useState("");

  const [password, setPassword] = useState("");

  const [mostrarLogin, setMostrarLogin] = useState(false);

  const [seccion, setSeccion] = useState(() => {

    const usuarioInicial = obtenerUsuario();

    return MENUS[usuarioInicial?.rol]?.[0] || "";

  });

  const [datos, setDatos] = useState(null);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [cargando, setCargando] = useState(false);

  const menu = MENUS[usuario?.rol] || [];

  async function cargar(ruta = RUTAS[seccion]) {

    if (!ruta) return;

    setError("");

    setMensaje("");

    setCargando(true);

    try {

      const resultado = await apiRequest(ruta);

      setDatos(resultado);

    } catch (e) {

      setError(e.message);

      setDatos(null);

    } finally {

      setCargando(false);

    }

  }

  async function login(e) {

    e.preventDefault();

    setError("");

    setCargando(true);

    try {

      const r = await apiRequest("/usuarios/login", {

        method: "POST",

        body: JSON.stringify({ correo, password }),

      });

      guardarSesion(r.access_token, r.usuario);

      setUsuario(r.usuario);

      setMostrarLogin(false);

      setSeccion(MENUS[r.usuario.rol]?.[0] || "");

      setDatos(null);

    } catch (e) {

      setError(e.message);

    } finally {

      setCargando(false);

    }

  }

  function logout() {

    cerrarSesion();

    setUsuario(null);

    setMostrarLogin(false);

    setSeccion("");

    setDatos(null);

    setError("");

    setMensaje("");

  }

  function cambiarSeccion(item) {

    setSeccion(item);

    setDatos(null);

    setError("");

    setMensaje("");

  }

  async function accion(ruta) {

    setError("");

    setMensaje("");

    setCargando(true);

    try {

      const resultado = await apiRequest(ruta, {

        method: "POST",

        body: JSON.stringify({}),

      });

      setMensaje(resultado.mensaje || "Acción realizada correctamente.");

      const rutaActual = RUTAS[seccion];

      if (rutaActual) {

        setDatos(await apiRequest(rutaActual));

      } else {

        setDatos(resultado);

      }

    } catch (e) {

      setError(e.message);

    } finally {

      setCargando(false);

    }

  }

  async function cancelarTurno(turnoId) {

    setError("");

    setMensaje("");

    setCargando(true);

    try {

      const r = await apiRequest(`/turnos/${turnoId}/cancelar`, {

        method: "POST",

        body: JSON.stringify({}),

      });

      setMensaje(r.mensaje || "Turno cancelado.");

      await cargar("/turnos/mis-turnos");

    } catch (e) {

      setError(e.message);

    } finally {

      setCargando(false);

    }

  }

  // Página pública: no exige cuenta para iniciar una reserva.*

  if (!usuario) {

    if (mostrarLogin) {

      return (

        <main className="login-page">

          <form className="login-card" onSubmit={login}>

            <div className="brand-mark">F0</div>

            <p className="eyebrow">ACCESO AL PERSONAL</p>

            <h1>Iniciar sesión</h1>

            <p className="muted">

              Acceso exclusivo para agentes y administradores.

            </p>

            <label htmlFor="login-correo">Correo electrónico</label>

            <input

              id="login-correo"

              type="email"

              value={correo}

              onChange={(e) => setCorreo(e.target.value)}

              autoComplete="username"

              required

            />

            <label htmlFor="login-password">Contraseña</label>

            <input

              id="login-password"

              type="password"

              value={password}

              onChange={(e) => setPassword(e.target.value)}

              autoComplete="current-password"

              required

            />

            {error && <p className="error">{error}</p>}

            <button className="primary" disabled={cargando}>

              {cargando ? "Ingresando..." : "Iniciar sesión"}

            </button>

            <button

              type="button"

              className="secondary"

              onClick={() => {

                setMostrarLogin(false);

                setError("");

                setPassword("");

              }}

            >

              Volver al inicio

            </button>

          </form>

        </main>

      );

    }

    return (

      <main className="public-home">

        <header className="public-header">

          <div className="brand">

            <div className="brand-mark">F0</div>

            <div>

              <strong>FilaCero</strong>

              <small>Gestión de turnos</small>

            </div>

          </div>

          <button

            type="button"

            className="staff-login"

            onClick={() => {

              setMostrarLogin(true);

              setError("");

            }}

          >

            <span aria-hidden="true">♙</span> Iniciar sesión

          </button>

        </header>

        <section className="public-content">

          <div className="public-intro">

            <p className="eyebrow">SERVICIOS TECNOLÓGICOS</p>

            <h1>Tu turno, sin filas ni complicaciones</h1>

            <p>

              Ingresa tus datos y reserva el horario que mejor te convenga.

              No necesitas crear una cuenta.

            </p>

          </div>

          <ReservarTurno />

        </section>

      </main>

    );

  }

  const turnoActual = datos?.turno || datos;

  const idTurno = turnoActual?.id;

  return (

    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-mark">F0</div>

          <div>

            <strong>FilaCero</strong>

            <small>Servicios tecnológicos</small>

          </div>

        </div>

        <p className="side-label">MENÚ PRINCIPAL</p>

        {menu.map((item) => (

          <button

            key={item}

            className={`nav-item ${seccion === item ? "selected" : ""}`}

            onClick={() => cambiarSeccion(item)}

          >

            {item}

          </button>

        ))}

        <div className="side-bottom">

          <span>{usuario.nombre}</span>

          <small>{usuario.rol}</small>

          <button className="secondary" onClick={logout}>

            Cerrar sesión

          </button>

        </div>

      </aside>

      <main className="dashboard">

        <header className="dashboard-header">

          <div>

            <p className="eyebrow">PANEL DE CONTROL</p>

            <h1>{seccion}</h1>

            <p className="muted">Bienvenido, {usuario.nombre}</p>

          </div>

          {RUTAS[seccion] &&

            !(usuario.rol === "ADMIN" &&

              ["Sedes", "Trámites"].includes(seccion)) && (

              <button

                className="primary"

                onClick={() => cargar()}

                disabled={cargando}

              >

                {cargando ? "Cargando..." : "Actualizar datos"}

              </button>

            )}

        </header>

        {error && <p className="error">{error}</p>}

        {mensaje && <p className="success">{mensaje}</p>}

        <section className="welcome-card">

          <div>

            <span className="status-dot" />

            <strong> Sistema de turnos</strong>

            <p className="muted">

              Atención técnica organizada para Servicios Tecnológicos.

            </p>

          </div>

        </section>

        {usuario.rol === "ADMIN" && seccion === "Resumen" && (

          <AdminDashboard />

        )}

        {usuario.rol === "ADMIN" &&

          ["Sedes", "Trámites"].includes(seccion) && (

            <AdminCatalogo key={seccion} seccion={seccion} />

          )}

        {seccion === "Reservar turno" && usuario.rol === "CLIENTE" && (

          <ReservarTurno />

        )}

        {seccion === "Mis turnos" && usuario.rol === "CLIENTE" && (

          <section className="data-panel">

            <h2>Mis reservas</h2>

            <p className="muted">Consulta tus turnos registrados.</p>

            <button

              className="primary"

              onClick={() => cargar("/turnos/mis-turnos")}

              disabled={cargando}

            >

              Consultar mis turnos

            </button>

            {datos?.turnos?.length > 0 && (

              <div className="table-wrap">

                <table>

                  <thead>

                    <tr>

                      <th>Código</th>

                      <th>Fecha</th>

                      <th>Horario</th>

                      <th>Estado</th>

                      <th>Acción</th>

                    </tr>

                  </thead>

                  <tbody>

                    {datos.turnos.map((turno) => (

                      <tr key={turno.id}>

                        <td>{turno.codigo}</td>

                        <td>{turno.fecha}</td>

                        <td>{turno.hora_inicio} - {turno.hora_fin}</td>

                        <td>{turno.estado}</td>

                        <td>

                          {turno.estado === "ESPERANDO" && (

                            <button

                              className="secondary"

                              disabled={cargando}

                              onClick={() => cancelarTurno(turno.id)}

                            >

                              Cancelar

                            </button>

                          )}

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}

            {datos?.turnos?.length === 0 && (

              <p className="muted">Todavía no tienes turnos registrados.</p>

            )}

          </section>

        )}

        {usuario.rol === "AGENTE" && seccion === "Mi cola" && (

          <section className="data-panel">

            <h2>Cola de atención</h2>

            <button

              className="primary"

              onClick={() => cargar("/agente/cola")}

              disabled={cargando}

            >

              Consultar cola

            </button>

            <button

              className="primary"

              onClick={() => accion("/agente/llamar-siguiente")}

              disabled={cargando}

            >

              Llamar siguiente turno

            </button>

            {datos?.turnos && (

              <>

                <p className="muted">

                  Turnos en espera: {datos.total_en_espera ?? datos.turnos.length}

                </p>

                <div className="table-wrap">

                  <table>

                    <thead>

                      <tr><th>Código</th><th>Estado</th><th>Fecha</th></tr>

                    </thead>

                    <tbody>

                      {datos.turnos.map((turno) => (

                        <tr key={turno.id}>

                          <td>{turno.codigo}</td>

                          <td>{turno.estado}</td>

                          <td>{turno.fecha}</td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </>

            )}

          </section>

        )}

        {usuario.rol === "AGENTE" && seccion === "Turno actual" && (

          <section className="data-panel">

            <h2>Turno actual</h2>

            <button

              className="primary"

              onClick={() => cargar("/agente/actual")}

              disabled={cargando}

            >

              Consultar turno actual

            </button>

            {turnoActual?.codigo && (

              <div className="current-turn">

                <p className="eyebrow">TURNO ACTUAL</p>

                <h2>{turnoActual.codigo}</h2>

                <p>Estado: {turnoActual.estado}</p>

                {turnoActual.estado === "LLAMADO" && (

                  <button

                    className="primary"

                    onClick={() => accion(`/agente/turnos/${idTurno}/iniciar`)}

                    disabled={cargando}

                  >

                    Iniciar atención

                  </button>

                )}

                {turnoActual.estado === "EN_ATENCION" && (

                  <button

                    className="primary"

                    onClick={() => accion(`/agente/turnos/${idTurno}/finalizar`)}

                    disabled={cargando}

                  >

                    Finalizar atención

                  </button>

                )}

              </div>

            )}

            {datos && !turnoActual?.codigo && (

              <p className="muted">No tienes un turno llamado o en atención.</p>

            )}

          </section>

        )}

        {seccion !== "Resumen" &&
          seccion !== "Reservar turno" &&

          seccion !== "Mis turnos" &&

          seccion !== "Mi cola" &&

          seccion !== "Turno actual" &&

          !(usuario.rol === "ADMIN" &&

            ["Sedes", "Trámites"].includes(seccion)) &&

          RUTAS[seccion] && (

            <section className="data-panel">

              <h2>{seccion}</h2>

              <p className="muted">

                Pulsa “Actualizar datos” para consultar el backend.

              </p>

              {datos !== null && (

                <pre className="result">{JSON.stringify(datos, null, 2)}</pre>

              )}

            </section>

          )}

        <section className="role-grid">

          {menu.map((item, i) => (

            <button

              className="feature-card"

              key={item}

              onClick={() => cambiarSeccion(item)}

            >

              <span>0{i + 1}</span>

              <h2>{item}</h2>

              <p>Accede a {item.toLowerCase()} del sistema.</p>

              <strong>Abrir sección →</strong>

            </button>

          ))}

        </section>

      </main>

    </div>

  );

}
