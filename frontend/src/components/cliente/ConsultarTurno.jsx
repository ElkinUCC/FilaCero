import { useCallback, useEffect, useState } from "react";
import { cancelarTurno, consultarTurno } from "../../api/publico.api";
import { anunciar } from "../../hooks/useAccesibilidad";
import Icon from "../ui/Icon";
import { ESTADOS, fechaLarga, soloDigitos } from "../../utils/formatters";

const MENSAJES = {
  ESPERANDO: "Te llamaremos en la sede. Llega unos minutos antes de tu hora.",
  LLAMADO: "¡Es tu turno! Acércate al punto de atención.",
  EN_ATENCION: "Estás siendo atendido.",
  ATENDIDO: "Tu atención finalizó. Gracias por usar FilaCero.",
  CANCELADO: "Este turno fue cancelado.",
  NO_ASISTIO: "El turno se cerró porque no te presentaste al ser llamado.",
};

export default function ConsultarTurno({ inicial, onResultado }) {
  const [codigo, setCodigo] = useState(inicial?.codigo || "");
  const [celular, setCelular] = useState(inicial?.celular || "");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [error, setError] = useState("");

  const consultar = useCallback(async (silencioso = false, c = codigo, cel = celular) => {
    if (!c.trim() || !/^3\d{9}$/.test(cel)) {
      if (!silencioso) setError("Escribe el código del turno y el celular con el que reservaste.");
      return;
    }
    if (!silencioso) { setCargando(true); setError(""); }
    try {
      const r = await consultarTurno(c.trim(), cel);
      setResultado(r);
      onResultado?.(r.turno);
    } catch (e) {
      if (!silencioso) { setResultado(null); onResultado?.(null); setError(e.message); }
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [codigo, celular, onResultado]);

  // Consulta inmediata cuando viene de una reserva recién hecha.
  useEffect(() => {
    if (inicial?.codigo && inicial?.celular) consultar(false, inicial.codigo, inicial.celular);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  // Actualización automática mientras el turno siga activo.
  const activo = ["ESPERANDO", "LLAMADO", "EN_ATENCION"].includes(resultado?.turno?.estado);
  useEffect(() => {
    if (!activo) return undefined;
    const t = window.setInterval(() => consultar(true), 20000);
    return () => window.clearInterval(t);
  }, [activo, consultar]);

  async function cancelar() {
    setCargando(true);
    setError("");
    try {
      await cancelarTurno(codigo.trim(), celular);
      setConfirmarCancelar(false);
      await consultar(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  const turno = resultado?.turno;

  // Cuando el asesor llama el turno se avisa: en pantalla siempre, y en voz
  // alta solo si la persona activó "Leer avisos en voz alta" en Accesibilidad.
  const [estadoPrevio, setEstadoPrevio] = useState(null);
  if (turno && turno.estado !== estadoPrevio) {
    if (estadoPrevio && turno.estado === "LLAMADO") {
      anunciar(`Tu turno ${turno.codigo.slice(-6).split("").join(" ")} fue llamado. Acércate al punto de atención.`);
    }
    setEstadoPrevio(turno.estado);
  }
  const espera = resultado?.espera;
  const estado = ESTADOS[turno?.estado] || {};

  return (
    <div className="ct">
      <form className="rv__fila ct__form" onSubmit={(e) => { e.preventDefault(); consultar(); }}>
        <label className="campo">
          <Icon name="ficha" size={17} />
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 30))}
            placeholder="Código del turno (FC-…)"
            aria-label="Código del turno"
          />
        </label>
        <label className="campo">
          <Icon name="celular" size={17} />
          <input
            type="tel"
            inputMode="numeric"
            value={celular}
            onChange={(e) => setCelular(soloDigitos(e.target.value, 10))}
            placeholder="Celular de la reserva"
            aria-label="Celular de la reserva"
          />
        </label>
        <button className="btn btn--primario" disabled={cargando}>
          {cargando && !turno ? "Buscando…" : "Consultar"}
        </button>
      </form>

      {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}

      {!turno && !error && (
        <p className="ct__ayuda">
          El código aparece en la confirmación de tu reserva. Solo se muestra el turno si el celular coincide.
        </p>
      )}

      {turno && (
        <section className={`ct__resultado tono-${estado.tono}`} aria-live="polite">
          <header className="ct__cabeza">
            <div>
              <span className="ct__codigo">{turno.codigo}</span>
              <h2>{fechaLarga(turno.fecha)}, {turno.hora_inicio}</h2>
            </div>
            <span className={`estado estado--${estado.tono}`}>{estado.texto}</span>
          </header>

          {turno.estado === "ESPERANDO" && espera && (
            <div className="ct__espera">
              <div>
                <strong>{espera.turnos_antes}</strong>
                <span>{espera.turnos_antes === 1 ? "persona antes que tú" : "personas antes que tú"}</span>
              </div>
              <div>
                <strong>~{espera.tiempo_estimado_minutos} min</strong>
                <span>de espera estimada en sede</span>
              </div>
            </div>
          )}

          <div className="ct__fila-mensaje">
            <p className="ct__mensaje">{MENSAJES[turno.estado]}</p>
          </div>

          <dl className="ct__datos">
            <div><dt>Sede</dt><dd>{turno.sede}{turno.direccion ? ` · ${turno.direccion}` : ""}</dd></div>
            <div><dt>Servicio</dt><dd>{turno.tramite}</dd></div>
            <div><dt>A nombre de</dt><dd>{turno.nombre} ({turno.celular})</dd></div>
          </dl>

          {turno.estado === "ESPERANDO" && (
            <div className="ct__acciones">
              {confirmarCancelar ? (
                <>
                  <span>¿Cancelar este turno? Liberarás el cupo.</span>
                  <button type="button" className="btn btn--peligro" onClick={cancelar} disabled={cargando}>Sí, cancelar</button>
                  <button type="button" className="btn btn--suave" onClick={() => setConfirmarCancelar(false)}>No</button>
                </>
              ) : (
                <>
                  <span className="ct__auto">Se actualiza solo cada 20 segundos</span>
                  <button type="button" className="btn btn--suave" onClick={() => setConfirmarCancelar(true)}>Cancelar turno</button>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
