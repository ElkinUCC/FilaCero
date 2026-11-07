import { useEffect, useState } from "react";
import { pantallaSala } from "../api/publico.api";
import Marca from "../components/layout/Marca";
import usePolling from "../hooks/usePolling";
import { articuloModulo } from "../hooks/useLlamadoPorVoz";
import { ZONA } from "../utils/formatters";
import "../css/sala.css";

function reloj() {
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA })
    .format(new Date());
}

/**
 * Pantalla para el televisor de la sala de espera: /sala?sede=ID
 * Muestra el turno llamado, el módulo y los próximos turnos. La voz del
 * llamado la emite la consola del asesor (ADR-009).
 */
/** Pantalla de la sala de espera (TV de cada sede), pública. Ruta: /sala?sede=<id> */
export default function SalaPage() {
  const params = new URLSearchParams(window.location.search);
  const [sedeId, setSedeId] = useState(params.get("sede") || "");
  const [hora, setHora] = useState(reloj);

  const { datos, error } = usePolling(
    () => pantallaSala(sedeId),
    4000,
    [sedeId],
  );

  useEffect(() => {
    const t = window.setInterval(() => setHora(reloj()), 10000);
    return () => window.clearInterval(t);
  }, []);

  function elegirSede(id) {
    setSedeId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("sede", id);
    window.history.replaceState(null, "", url);
  }

  if (datos && !datos.sede) {
    return (
      <main className="sala sala--elegir">
        <h1>Pantalla de sala de espera</h1>
        <p>Elige la sede que mostrará este televisor.</p>
        <div className="sala__sedes">
          {(datos.sedes || []).map((s) => (
            <button key={s.id} className="btn btn--primario btn--grande" onClick={() => elegirSede(String(s.id))}>
              {s.nombre}
            </button>
          ))}
        </div>
      </main>
    );
  }

  const actual = datos?.llamados?.[0];
  const anteriores = (datos?.llamados || []).slice(1, 5);

  return (
    <main className="sala">
      <header className="sala__barra">
        <Marca />
        <h1 className="sala__sede">{datos?.sede?.nombre || "Cargando…"}</h1>
        <time className="sala__hora">{hora}</time>
      </header>

      {error && <p className="sala__error" role="alert">Sin conexión con el servidor. Reintentando…</p>}

      <section className="sala__cuerpo">
        <div className={`sala__actual ${actual?.estado === "LLAMADO" ? "sala__actual--llamando" : ""}`} aria-live="assertive" aria-atomic="true">
          {actual ? (
            <>
              <span className="sala__etiqueta">{actual.estado === "LLAMADO" ? "Turno llamado" : "En atención"}</span>
              <strong className="sala__codigo" key={actual.id}><Codigo c={actual.codigo} /></strong>
              <p className="sala__nombre">{actual.nombre}</p>
              <p className="sala__destino">
                {actual.modulo ? <>Acérquese {articuloModulo(actual.modulo)} <b>{actual.modulo}</b></> : <>Acérquese con <b>{actual.asesor}</b></>}
              </p>
              {actual.modulo && <p className="sala__asesor">Le atiende {actual.asesor}</p>}
            </>
          ) : (
            <>
              <span className="sala__etiqueta">Sala de espera</span>
              <p className="sala__nombre">Pronto llamaremos al siguiente turno.</p>
              <p className="sala__destino">Ten a mano el código de tu reserva.</p>
            </>
          )}
        </div>

        <div className="sala__lado">
          <section aria-labelledby="sala-anteriores">
            <h2 id="sala-anteriores">Llamados recientes</h2>
            <ul>
              {anteriores.map((t) => (
                <li key={t.id}><b><Codigo c={t.codigo} /></b><span className="sala__persona">{t.nombre}</span><span>{t.modulo || t.asesor}</span></li>
              ))}
              {!anteriores.length && <li className="sala__vacio">—</li>}
            </ul>
          </section>
          <section aria-labelledby="sala-siguientes">
            <h2 id="sala-siguientes">Próximos turnos</h2>
            <ul>
              {(datos?.siguientes || []).map((t) => (
                <li key={t.codigo}><b><Codigo c={t.codigo} /></b><span className="sala__persona">{t.nombre}</span><span>{t.hora}</span></li>
              ))}
              {!datos?.siguientes?.length && <li className="sala__vacio">No hay más turnos hoy</li>}
            </ul>
          </section>
        </div>
      </section>

      <footer className="sala__pie">
        Reserva tu turno en línea y llega a tu hora · Atención {datos?.horario?.todos_los_dias ? "todos los días" : ""} {datos?.horario?.hora_apertura}–{datos?.horario?.hora_cierre}
      </footer>
    </main>
  );
}

/** "TU-3AB745": el prefijo va pequeño para que el código no se parta en la pantalla. */
function Codigo({ c }) {
  const texto = String(c || "");
  if (!texto.startsWith("TU-")) return texto;
  return <><small className="sala__prefijo">TU-</small>{texto.slice(3)}</>;
}
