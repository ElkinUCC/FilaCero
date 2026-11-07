import { useCallback, useEffect, useState } from "react";
import { obtenerHorario } from "../api/publico.api";
import ConsultarTurno from "../components/cliente/ConsultarTurno";
import Ficha from "../components/cliente/Ficha";
import Login from "../components/cliente/Login";
import ReservarTurno from "../components/cliente/ReservarTurno";
import Marca from "../components/layout/Marca";
import { SaltarAlContenido } from "../components/ui/Accesibilidad";
import { teclasPestanas } from "../hooks/useAccesibilidad";
import Icon from "../components/ui/Icon";
import { codigoTurno } from "../utils/formatters";
import "../css/cliente.css";

/** Portal del ciudadano: reservar y consultar turno sin crear cuenta. Ruta: / */
export default function PortalPage({ onIngresar }) {
  const [vista, setVista] = useState("reservar");
  const [horario, setHorario] = useState(null);
  const [resumen, setResumen] = useState({});
  const [confirmado, setConfirmado] = useState(null);
  const [consultaInicial, setConsultaInicial] = useState(null);
  const [turnoConsultado, setTurnoConsultado] = useState(null);
  // /?ingresar=1 abre directamente el acceso del personal (lo usa la guarda de rutas).
  const [login, setLogin] = useState(() => new URLSearchParams(window.location.search).has("ingresar"));

  useEffect(() => {
    obtenerHorario().then(setHorario).catch(() => {});
  }, []);

  const alResumir = useCallback((r) => setResumen(r), []);

  function alConfirmar(turno, celular, espera, tokenConsulta) {
    setConfirmado({ turno, celular, espera, tokenConsulta });
  }

  function verEstado() {
    setConsultaInicial({
      codigo: confirmado.turno.codigo,
      celular: confirmado.celular,
      token_verificacion: confirmado.tokenConsulta,
    });
    setConfirmado(null);
    setVista("consultar");
  }

  const textoHorario = horario
    ? `${horario.todos_los_dias ? "Todos los días" : "Lunes a viernes"}, ${horario.hora_apertura} a ${horario.hora_cierre}`
    : "Consultando horario…";

  return (
    <div className="portal">
      <SaltarAlContenido />
      <header className="portal__barra">
        <Marca />
        <span className="portal__horario">
          <Icon name="reloj" size={15} /> {textoHorario}
        </span>
        <button type="button" className="portal__personal" onClick={() => setLogin(true)}>
          <Icon name="llave" size={15} /> Acceso personal
        </button>
      </header>

      <main className="portal__cuerpo" id="contenido" tabIndex={-1}>
        <aside className="portal__lado">
          <div className="portal__intro">
            <h1>Reserva tu turno y llega a tu hora.</h1>
            <p>
              Elige sede, servicio y horario. Verificamos tu celular y te damos un código para
              presentarte en el punto de atención. No necesitas crear cuenta.
            </p>
          </div>
          <Ficha
            resumen={vista === "reservar" ? resumen : {}}
            turno={vista === "reservar" ? confirmado?.turno : turnoConsultado}
          />
        </aside>

        <section className="portal__panel" aria-label="Turnos">
          <div className="pestanas" role="tablist" aria-label="Opciones de turno" onKeyDown={teclasPestanas}>
            <button
              role="tab"
              id="tab-reservar"
              aria-controls="panel-turnos"
              tabIndex={vista === "reservar" ? 0 : -1}
              aria-selected={vista === "reservar"}
              className={vista === "reservar" ? "activa" : ""}
              onClick={() => setVista("reservar")}
            >
              <Icon name="calendario" size={16} /> Reservar turno
            </button>
            <button
              role="tab"
              id="tab-consultar"
              aria-controls="panel-turnos"
              tabIndex={vista === "consultar" ? 0 : -1}
              aria-selected={vista === "consultar"}
              className={vista === "consultar" ? "activa" : ""}
              onClick={() => setVista("consultar")}
            >
              <Icon name="buscar" size={16} /> Consultar mi turno
            </button>
          </div>

          <div className="portal__contenido" role="tabpanel" id="panel-turnos" aria-labelledby={`tab-${vista}`}>
            {vista === "reservar" && confirmado && (
              <div className="listo" role="status">
                <span className="listo__icono"><Icon name="check" size={26} strokeWidth={2.4} /></span>
                <h2>Turno reservado</h2>
                <p>
                  Guarda este código. Lo necesitas para consultar o cancelar tu turno.
                </p>
                <div className="listo__codigo">{codigoTurno(confirmado.turno)}</div>
                <Ficha turno={confirmado.turno} />
                <div className="listo__acciones">
                  <button className="btn btn--primario" onClick={verEstado}>Ver estado del turno</button>
                  <button className="btn btn--suave" onClick={() => { setConfirmado(null); setResumen({}); }}>
                    Reservar otro
                  </button>
                </div>
              </div>
            )}
            {vista === "reservar" && !confirmado && (
              <ReservarTurno onResumen={alResumir} onConfirmado={alConfirmar} />
            )}
            {vista === "consultar" && (
              <ConsultarTurno inicial={consultaInicial} onResultado={setTurnoConsultado} />
            )}
          </div>
        </section>
      </main>

      {login && <Login onCerrar={() => setLogin(false)} onIngresar={onIngresar} />}
    </div>
  );
}
