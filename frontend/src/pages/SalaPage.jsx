import { useEffect, useRef, useState } from "react";
import { pantallaSala } from "../api/publico.api";
import Marca from "../components/layout/Marca";
import { MenuAccesibilidad } from "../components/ui/Accesibilidad";
import { hablar, usePreferencias } from "../hooks/useAccesibilidad";
import usePolling from "../hooks/usePolling";
import { ZONA } from "../utils/formatters";
import "../css/sala.css";

/** Deletrea el código para que la voz lo lea claro: "F 1 1 5 2 3". */
function deletrear(codigo) {
  return String(codigo).split("").join(" ");
}

function reloj() {
  return new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA })
    .format(new Date());
}

/**
 * Pantalla para el televisor de la sala de espera: /sala?sede=ID
 * Muestra el turno llamado. Si en Accesibilidad está activo "Leer avisos en
 * voz alta", además lo anuncia (una sola opción de voz para toda la app).
 */
/** Pantalla de la sala de espera (TV de cada sede), pública. Ruta: /sala?sede=<id> */
export default function SalaPage() {
  const params = new URLSearchParams(window.location.search);
  const [sedeId, setSedeId] = useState(params.get("sede") || "");
  const { voz: sonido } = usePreferencias();
  const [hora, setHora] = useState(reloj);
  const anunciados = useRef(null);

  const { datos, error } = usePolling(
    () => pantallaSala(sedeId),
    4000,
    [sedeId],
  );

  useEffect(() => {
    const t = window.setInterval(() => setHora(reloj()), 10000);
    return () => window.clearInterval(t);
  }, []);

  // Anuncia por voz cada turno nuevo en estado LLAMADO.
  useEffect(() => {
    const llamados = (datos?.llamados || []).filter((t) => t.estado === "LLAMADO");
    if (anunciados.current === null) {
      anunciados.current = new Set(llamados.map((t) => t.id)); // no repetir lo que ya estaba
      return;
    }
    llamados.filter((t) => !anunciados.current.has(t.id)).reverse().forEach((t) => {
      anunciados.current.add(t.id);
      if (sonido) {
        hablar(`Turno ${deletrear(t.codigo)}. ${t.nombre}, por favor acérquese con ${t.asesor}.`);
      }
    });
  }, [datos?.llamados, sonido]);

  function elegirSede(id) {
    setSedeId(id);
    anunciados.current = null;
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
        <MenuAccesibilidad />
        <time className="sala__hora">{hora}</time>
      </header>

      {error && <p className="sala__error" role="alert">Sin conexión con el servidor. Reintentando…</p>}

      <section className="sala__cuerpo">
        <div className={`sala__actual ${actual?.estado === "LLAMADO" ? "sala__actual--llamando" : ""}`} aria-live="assertive" aria-atomic="true">
          {actual ? (
            <>
              <span className="sala__etiqueta">{actual.estado === "LLAMADO" ? "Turno llamado" : "En atención"}</span>
              <strong className="sala__codigo" key={actual.id}>{actual.codigo}</strong>
              <p className="sala__nombre">{actual.nombre}</p>
              <p className="sala__destino">Acérquese con <b>{actual.asesor}</b></p>
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
                <li key={t.id}><b>{t.codigo}</b><span>{t.nombre}</span><span>{t.asesor}</span></li>
              ))}
              {!anteriores.length && <li className="sala__vacio">—</li>}
            </ul>
          </section>
          <section aria-labelledby="sala-siguientes">
            <h2 id="sala-siguientes">Próximos turnos</h2>
            <ul>
              {(datos?.siguientes || []).map((t) => (
                <li key={t.codigo}><b>{t.codigo}</b><span>{t.nombre}</span><span>{t.hora}</span></li>
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
