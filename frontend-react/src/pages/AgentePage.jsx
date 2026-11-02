import { useEffect, useMemo, useRef, useState } from "react";
import * as agenteApi from "../api/agente.api";
import Marca from "../components/layout/Marca";
import { MenuAccesibilidad, SaltarAlContenido } from "../components/ui/Accesibilidad";
import { anunciar } from "../hooks/useAccesibilidad";
import { CambiarMiClave } from "../components/ui/CambiarClave";
import Icon from "../components/ui/Icon";
import { useToast } from "../hooks/useToast";
import usePolling from "../hooks/usePolling";
import { duracion, fechaCorta, ZONA } from "../utils/formatters";
import "../css/agente.css";

const LLEGADA_MAX_SEG = 180;

const PUNTUALIDAD = {
  a_tiempo: { texto: "A tiempo", tono: "ok" },
  en_riesgo: { texto: "En riesgo", tono: "riesgo" },
  atrasado: { texto: "Atrasado", tono: "atrasado" },
  proxima: { texto: "Próxima franja", tono: "proxima" },
};

const ICONO_ACCION = {
  llamar: "campana", pausa: "reloj", adelantar: "derecha", iniciar: "play",
  ausente: "ausente", finalizar: "detener", atendiendo: "usuario", esperar: "check",
};

function reloj(ms, conSegundos = true) {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit", minute: "2-digit", second: conSegundos ? "2-digit" : undefined,
    hour12: false, timeZone: ZONA,
  }).format(new Date(ms));
}

function mmss(seg) {
  const s = Math.max(0, Math.round(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Hora del servidor sincronizada (evita relojes desfasados del PC). */
function useAhora(servidorISO) {
  const desfase = useRef(0);
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (servidorISO) desfase.current = Date.parse(servidorISO) - Date.now();
  }, [servidorISO]);
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now() + desfase.current), 1000);
    return () => window.clearInterval(t);
  }, []);
  return ahora;
}

function Cronometro({ desde, limite, etiqueta, ahora }) {
  const transcurrido = desde ? (ahora - Date.parse(desde)) / 1000 : 0;
  const pct = Math.min(100, (transcurrido / limite) * 100);
  const tono = pct >= 100 ? "rojo" : pct >= 80 ? "ambar" : "verde";
  return (
    <div className={`crono crono--${tono}`}>
      <div className="crono__cifras">
        <strong>{mmss(transcurrido)}</strong>
        <span>{etiqueta} · máximo {mmss(limite)}</span>
      </div>
      <div className="crono__pista"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Consola del asesor con asistente de despacho. Ruta: /agente (rol AGENTE) */
export default function AgentePage({ usuario, onSalir, onUsuario }) {
  const avisar = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [pausaHasta, setPausaHasta] = useState(null);
  const [cambiarClave, setCambiarClave] = useState(false);
  const { datos: p, error, refrescar } = usePolling(agenteApi.obtenerPanel, 5000);
  const ahora = useAhora(p?.ahora);

  const actual = p?.actual;
  const rec = p?.recomendacion;
  const franja = p?.franja_actual;
  const maxSeg = p?.max_atencion_seg || 600;

  // Aviso cuando llega una reserva nueva para hoy (visual, lector de pantalla y voz).
  const conocidos = useRef(null);
  useEffect(() => {
    const hoy = (p?.cola || []).filter((t) => t.es_hoy);
    if (!p) return;
    if (conocidos.current === null) {
      conocidos.current = new Set(hoy.map((t) => t.id));
      return;
    }
    const nuevos = hoy.filter((t) => !conocidos.current.has(t.id));
    hoy.forEach((t) => conocidos.current.add(t.id));
    if (nuevos.length === 1) {
      const t = nuevos[0];
      avisar(`Nuevo turno: ${t.usuario_nombre} a las ${t.hora_inicio}`);
      anunciar(`Nuevo turno para las ${t.hora_inicio}: ${t.usuario_nombre}, ${t.tramite_nombre}.`);
    } else if (nuevos.length > 1) {
      avisar(`${nuevos.length} turnos nuevos en la cola de hoy`);
      anunciar(`Llegaron ${nuevos.length} turnos nuevos a la cola.`);
    }
  }, [p, avisar]);

  // Fin de la pausa activa.
  const restantePausa = pausaHasta ? (pausaHasta - ahora) / 1000 : 0;
  useEffect(() => {
    if (pausaHasta && restantePausa <= 0) {
      setPausaHasta(null);
      avisar("Pausa terminada. El siguiente turno te espera.");
    }
  }, [pausaHasta, restantePausa, avisar]);

  /** accion: función de agente.api.js que ejecuta el cambio de estado del turno. */
  async function ejecutar(accion, exito) {
    setOcupado(true);
    try {
      const r = await accion();
      avisar(exito || r.mensaje);
      setPausaHasta(null);
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(false);
      refrescar();
    }
  }

  const llamar = (turnoId) =>
    turnoId && p?.cola?.[0]?.id !== turnoId
      ? ejecutar(() => agenteApi.llamar(turnoId), "Turno llamado.")
      : ejecutar(agenteApi.llamarSiguiente, "Turno llamado.");

  const [verProximos, setVerProximos] = useState(false);
  const agrupar = (lista) => {
    const mapa = new Map();
    lista.forEach((t) => {
      const clave = `${t.fecha} ${t.hora_inicio}`;
      if (!mapa.has(clave)) mapa.set(clave, { clave, t, items: [] });
      mapa.get(clave).items.push(t);
    });
    return [...mapa.values()];
  };
  const grupos = useMemo(() => agrupar((p?.cola || []).filter((t) => t.es_hoy)), [p?.cola]);
  const proximos = useMemo(() => agrupar((p?.cola || []).filter((t) => !t.es_hoy)), [p?.cola]);
  const totalProximos = proximos.reduce((n, g) => n + g.items.length, 0);

  const franjaRestante = franja ? franja.restante_seg - (ahora - Date.parse(p.ahora)) / 1000 : 0;
  const r = p?.resumen || {};

  function pintarGrupo(g) {
    return (
      <div key={g.clave} className="cola__grupo">
        <h3>{g.t.es_hoy ? "Hoy" : fechaCorta(g.t.fecha)} · {g.t.hora_inicio}–{g.t.hora_fin}<small>{g.items.length}</small></h3>
        {g.items.map((t) => {
          const pu = PUNTUALIDAD[t.puntualidad] || {};
          const recomendado = rec?.turno_id === t.id && !actual;
          return (
            <div key={t.id} className={`cola__item ${recomendado ? "cola__item--rec" : ""}`}>
              <span className="cola__hora" title="Hora proyectada de inicio">{t.es_hoy ? t.inicio_proyectado : t.hora_inicio}</span>
              <div className="cola__info">
                <strong>{t.usuario_nombre}</strong>
                <small>{t.codigo.slice(-6)} · {t.tramite_nombre} · ~{Math.round(t.duracion_estimada_seg / 60)} min</small>
              </div>
              <span className={`punt punt--${pu.tono}`}>{pu.texto}</span>
              <button className="icono-btn" title="Llamar a esta persona" aria-label={`Llamar a ${t.usuario_nombre}`} disabled={Boolean(actual) || ocupado} onClick={() => llamar(t.id)}>
                <Icon name="campana" size={17} />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // --------------------------------------------------------------- acciones del asistente
  function botonesAsistente() {
    if (!rec || pausaHasta) return null;
    const turnoId = rec.turno_id;
    const codigo = rec.turno_codigo?.slice(-6);
    switch (rec.accion) {
      case "llamar":
        return <button className="btn btn--primario" disabled={ocupado} onClick={() => llamar(turnoId)}><Icon name="campana" size={17} /> Llamar {codigo}</button>;
      case "pausa":
        return (
          <>
            <button className="btn btn--primario" onClick={() => setPausaHasta(ahora + rec.pausa_seg * 1000)}><Icon name="reloj" size={17} /> Tomar pausa de {mmss(rec.pausa_seg)}</button>
            <button className="btn btn--borde-claro" disabled={ocupado} onClick={() => llamar(turnoId)}>Llamar ahora</button>
          </>
        );
      case "adelantar":
        return (
          <>
            <button className="btn btn--primario" disabled={ocupado} onClick={() => llamar(turnoId)}><Icon name="derecha" size={17} /> Adelantar {codigo}</button>
            {rec.pausa_seg > 60 && <button className="btn btn--borde-claro" onClick={() => setPausaHasta(ahora + Math.min(rec.pausa_seg, 180) * 1000)}>Pausa {mmss(Math.min(rec.pausa_seg, 180))}</button>}
          </>
        );
      case "iniciar":
        return <button className="btn btn--primario" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.iniciar(turnoId))}><Icon name="play" size={17} /> Iniciar atención</button>;
      case "ausente":
        return (
          <>
            <button className="btn btn--primario" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.noAsistio(turnoId))}><Icon name="ausente" size={17} /> Marcar no asistió</button>
            <button className="btn btn--borde-claro" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.iniciar(turnoId))}>Ya llegó, iniciar</button>
          </>
        );
      case "finalizar":
        return <button className="btn btn--primario" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.finalizar(turnoId))}><Icon name="detener" size={17} /> Finalizar atención</button>;
      default:
        return null;
    }
  }

  return (
    <div className="ag">
      <SaltarAlContenido />
      {/* ---------------- Barra superior ---------------- */}
      <header className="ag__barra">
        <Marca />
        <div className="ag__sede">
          <strong>{p?.agente?.sede || "Sin sede asignada"}</strong>
          <small>{usuario.nombre}</small>
        </div>
        <div className="ag__franja-chip">
          {franja ? (
            <>
              <span>Franja {franja.inicio}–{franja.fin}</span>
              <strong className={franjaRestante < 300 ? "urgente" : ""}>quedan {mmss(franjaRestante)}</strong>
            </>
          ) : <span>{p && !p.en_horario ? `Fuera de horario · ${p.horario?.hora_apertura}–${p.horario?.hora_cierre}` : "—"}</span>}
        </div>
        <time className="ag__reloj" aria-label="Hora actual">{reloj(ahora)}</time>
        <MenuAccesibilidad />
        <button className="icono-btn ag__salir" onClick={() => setCambiarClave(true)} title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña"><Icon name="llave" size={18} /></button>
        <button className="icono-btn ag__salir" onClick={onSalir} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="salir" size={19} /></button>
      </header>

      {error && <div className="ag__aviso"><Icon name="alerta" size={16} /> {error} Reintentando…</div>}
      {p?.error && <div className="ag__aviso"><Icon name="alerta" size={16} /> {p.error} Pide al administrador que te asigne una sede.</div>}

      <main className="ag__cuerpo" id="contenido" tabIndex={-1}>
        <h1 className="sr">Consola de atención{p?.agente?.sede ? ` · ${p.agente.sede}` : ""}</h1>
        {/* ---------------- Columna principal ---------------- */}
        <div className="ag__principal">
          {pausaHasta ? (
            <section className="asistente asistente--pausa" aria-live="polite">
              <Icon name="reloj" size={22} />
              <div className="asistente__texto">
                <span className="asistente__tag">Pausa activa</span>
                <h2>{mmss(restantePausa)}</h2>
                <p>Levántate, estira cuello y espalda, toma agua. La franja va a tiempo.</p>
              </div>
              <div className="asistente__acciones">
                <button className="btn btn--primario" onClick={() => setPausaHasta(null)}>Terminar pausa</button>
              </div>
            </section>
          ) : rec ? (
            <section className={`asistente asistente--${rec.nivel}`} aria-live="polite">
              <Icon name={ICONO_ACCION[rec.accion] || "campana"} size={22} />
              <div className="asistente__texto">
                <span className="asistente__tag">Asistente de despacho</span>
                <h2>{rec.titulo}</h2>
                <p>{rec.motivo}</p>
              </div>
              <div className="asistente__acciones">{botonesAsistente()}</div>
            </section>
          ) : (
            <section className="asistente"><div className="esqueleto" style={{ height: 60, width: "100%" }} /></section>
          )}

          <section className={`puesto ${actual ? `puesto--${actual.estado.toLowerCase()}` : ""}`}>
            {actual ? (
              <>
                <div className="puesto__cabeza">
                  <span className={`estado estado--${actual.estado === "EN_ATENCION" ? "atencion" : "llamado"}`}>
                    {actual.estado === "EN_ATENCION" ? "En atención" : "Llamado"}
                  </span>
                  <span className="puesto__franja">Reservó {actual.hora_inicio}–{actual.hora_fin}</span>
                </div>
                <div className="puesto__turno">
                  <span className="puesto__codigo">{actual.codigo.slice(-6)}</span>
                  <div>
                    <h2>{actual.usuario_nombre}</h2>
                    <p>{actual.tramite_nombre} · {actual.usuario_celular}</p>
                  </div>
                </div>
                {actual.estado === "EN_ATENCION" ? (
                  <Cronometro desde={actual.fecha_inicio} limite={maxSeg} etiqueta="Atendiendo" ahora={ahora} />
                ) : (
                  <Cronometro desde={actual.fecha_llamado} limite={LLEGADA_MAX_SEG} etiqueta="Esperando que llegue" ahora={ahora} />
                )}
                <div className="puesto__acciones">
                  {actual.estado === "LLAMADO" ? (
                    <>
                      <button className="btn btn--primario btn--grande" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.iniciar(actual.id))}><Icon name="play" size={18} /> Iniciar atención</button>
                      <button className="btn btn--borde" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.noAsistio(actual.id))}><Icon name="ausente" size={17} /> No asistió</button>
                      <button className="btn btn--fantasma" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.devolver(actual.id))}><Icon name="deshacer" size={17} /> Devolver a la cola</button>
                    </>
                  ) : (
                    <button className="btn btn--primario btn--grande" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.finalizar(actual.id))}><Icon name="detener" size={18} /> Finalizar atención</button>
                  )}
                </div>
              </>
            ) : (
              <div className="puesto__libre">
                <span className="puesto__icono"><Icon name="usuario" size={28} /></span>
                <div>
                  <h2>Puesto libre</h2>
                  <p>{p?.cola?.length ? `${p.cola.length} persona(s) en la cola.` : "Nadie en la cola por ahora."}</p>
                </div>
                <button className="btn btn--primario btn--grande" disabled={ocupado || !p?.cola?.length || Boolean(pausaHasta)} onClick={() => llamar()}>
                  <Icon name="campana" size={18} /> Llamar siguiente
                </button>
              </div>
            )}
          </section>

          <section className="ag__dia" aria-label="Mi jornada">
            <div><span>Atendidos hoy</span><strong>{r.atendidos_hoy ?? "—"}</strong></div>
            <div><span>No asistieron</span><strong>{r.no_asistio_hoy ?? "—"}</strong></div>
            <div><span>Promedio</span><strong>{duracion(r.promedio_hoy_segundos)}</strong></div>
            <div><span>En su franja</span><strong>{r.puntualidad_pct != null ? `${r.puntualidad_pct}%` : "—"}</strong></div>
            <div><span>Dentro de {Math.round(maxSeg / 60)} min</span><strong>{r.dentro_tiempo_max_pct != null ? `${r.dentro_tiempo_max_pct}%` : "—"}</strong></div>
          </section>

          {p?.recientes?.length > 0 && (
            <section className="ag__recientes">
              <h3>Últimas atenciones</h3>
              <ul>
                {p.recientes.map((t) => (
                  <li key={t.id}>
                    <span className="mono">{t.codigo.slice(-6)}</span>
                    <span>{t.usuario_nombre}</span>
                    <span className={`estado estado--${t.estado === "ATENDIDO" ? "ok" : "ausente"}`}>{t.estado === "ATENDIDO" ? duracion((Date.parse(t.fecha_fin) - Date.parse(t.fecha_inicio)) / 1000) : "No asistió"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ---------------- Cola ---------------- */}
        <aside className="cola" aria-label="Cola de turnos">
          <header className="cola__cabeza">
            <h2>Cola</h2>
            <span>{r.en_espera_hoy ?? 0} hoy{r.en_riesgo ? <> · <b className="texto-riesgo">{r.en_riesgo} en riesgo</b></> : null}</span>
          </header>

          {franja && (
            <div className="cola__franja">
              <div className="cola__franja-fila">
                <span>Franja actual {franja.inicio}–{franja.fin}</span>
                <span>{franja.atendidos}/{franja.reservados} atendidos · cupo {franja.capacidad}</span>
              </div>
              <div className="cola__tiempo"><span style={{ width: `${Math.min(100, 100 - (franjaRestante / franja.total_seg) * 100)}%` }} /></div>
            </div>
          )}

          <div className="cola__lista">
            {!p && [1, 2, 3].map((i) => <div key={i} className="esqueleto" style={{ height: 54, margin: "8px 0" }} />)}
            {p && !grupos.length && <p className="vacio">No hay más turnos para hoy.</p>}
            {grupos.map(pintarGrupo)}
            {totalProximos > 0 && (
              <div className="cola__proximos">
                <button type="button" className="cola__desplegar" aria-expanded={verProximos} onClick={() => setVerProximos((v) => !v)}>
                  <Icon name="abajo" size={16} className={verProximos ? "girado" : ""} />
                  Próximos días <small>{totalProximos}</small>
                </button>
                {verProximos && proximos.map(pintarGrupo)}
              </div>
            )}
          </div>
        </aside>
      </main>
      {cambiarClave && <CambiarMiClave onCerrar={() => setCambiarClave(false)} onListo={(u) => { onUsuario?.(u); avisar("Tu contraseña fue actualizada."); }} />}
    </div>
  );
}
