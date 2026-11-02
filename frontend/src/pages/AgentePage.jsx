import { useEffect, useMemo, useRef, useState } from "react";
import * as agenteApi from "../api/agente.api";
import { listarSedes } from "../api/publico.api";
import Marca from "../components/layout/Marca";
import { MenuAccesibilidad, SaltarAlContenido } from "../components/ui/Accesibilidad";
import { anunciar } from "../hooks/useAccesibilidad";
import { CambiarMiClave } from "../components/ui/CambiarClave";
import Dropdown from "../components/ui/Dropdown";
import Icon from "../components/ui/Icon";
import { Confirmar } from "../components/ui/Modal";
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
  llamar: "megafono", pausa: "reloj", adelantar: "derecha", iniciar: "atender",
  ausente: "ausente", finalizar: "finalizado", atendiendo: "atender", esperar: "check",
};

const ETAPAS = [
  { estado: "LLAMADO", texto: "Llamado", icono: "megafono" },
  { estado: "EN_ATENCION", texto: "En atención", icono: "atender" },
  { estado: "ATENDIDO", texto: "Finalizado", icono: "finalizado" },
];

/** Progreso del turno en el puesto: Llamado → En atención → Finalizado. */
function Etapas({ estado }) {
  const actual = ETAPAS.findIndex((e) => e.estado === estado);
  return (
    <ol className="etapas" aria-label="Etapa del turno">
      {ETAPAS.map((e, i) => (
        <li
          key={e.estado}
          className={`etapas__paso ${i < actual ? "etapas__paso--hecho" : ""} ${i === actual ? "etapas__paso--actual" : ""}`}
          aria-current={i === actual ? "step" : undefined}
        >
          <span className="etapas__icono"><Icon name={i < actual ? "check" : e.icono} size={16} /></span>
          <span className="etapas__texto">{e.texto}</span>
        </li>
      ))}
    </ol>
  );
}

/** Número que se anima al cambiar (respeta "reducir movimiento"). */
function Cifra({ valor, sufijo = "" }) {
  const [mostrado, setMostrado] = useState(valor);
  const previo = useRef(valor);
  useEffect(() => {
    const desde = Number(previo.current);
    const hasta = Number(valor);
    previo.current = valor;
    const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || desde === hasta || reducido) {
      setMostrado(valor);
      return undefined;
    }
    const decimales = String(hasta).includes(".") ? 1 : 0;
    const inicio = performance.now();
    let marco;
    const paso = (t) => {
      const k = Math.min(1, (t - inicio) / 600);
      const suave = 1 - (1 - k) ** 3;
      setMostrado((desde + (hasta - desde) * suave).toFixed(decimales));
      if (k < 1) marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, [valor]);
  if (valor == null) return "—";
  return <span className="cifra">{mostrado}{sufijo}</span>;
}

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

  // Rotación de sede: el asesor elige dónde atiende hoy.
  const [sedes, setSedes] = useState([]);
  const [nuevaSede, setNuevaSede] = useState(null);
  const [cambio, setCambio] = useState({ ocupado: false, error: "" });
  useEffect(() => {
    listarSedes().then((r) => setSedes(r?.puntos || [])).catch(() => {});
  }, []);

  async function confirmarCambioSede() {
    setCambio({ ocupado: true, error: "" });
    try {
      const r = await agenteApi.cambiarSede(nuevaSede.id);
      setNuevaSede(null);
      setCambio({ ocupado: false, error: "" });
      setPausaHasta(null);
      avisar(r.mensaje);
      anunciar(r.mensaje);
      refrescar();
    } catch (e) {
      setCambio({ ocupado: false, error: e.message });
    }
  }
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
  async function ejecutar(accion, exito, alTerminar) {
    setOcupado(true);
    try {
      const r = await accion();
      avisar(exito || r.mensaje);
      setPausaHasta(null);
      alTerminar?.(r);
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(false);
      refrescar();
    }
  }

  // Al finalizar se muestra un cierre breve (2,4 s) antes de liberar el puesto.
  const [cierre, setCierre] = useState(null);
  useEffect(() => {
    if (!cierre) return undefined;
    const t = window.setTimeout(() => setCierre(null), 2400);
    return () => window.clearTimeout(t);
  }, [cierre]);
  const finalizar = (turno) =>
    ejecutar(() => agenteApi.finalizar(turno.id), "Atención finalizada.", () =>
      setCierre({
        nombre: turno.usuario_nombre,
        codigo: turno.codigo.slice(-6),
        seg: turno.fecha_inicio ? (ahora - Date.parse(turno.fecha_inicio)) / 1000 : null,
      }),
    );

  // Turnos que acaban de llegar a la cola: se resaltan unos segundos.
  const vistos = useRef(null);
  const [recienLlegados, setRecienLlegados] = useState(() => new Set());
  useEffect(() => {
    if (!p?.cola) return undefined;
    const ids = p.cola.map((t) => t.id);
    if (vistos.current === null) {
      vistos.current = new Set(ids);
      return undefined;
    }
    const nuevos = ids.filter((id) => !vistos.current.has(id));
    ids.forEach((id) => vistos.current.add(id));
    if (!nuevos.length) return undefined;
    setRecienLlegados(new Set(nuevos));
    const t = window.setTimeout(() => setRecienLlegados(new Set()), 4000);
    return () => window.clearTimeout(t);
  }, [p?.cola]);

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
            <div key={t.id} className={`cola__item ${recomendado ? "cola__item--rec" : ""} ${recienLlegados.has(t.id) ? "cola__item--nuevo" : ""}`}>
              <span className="cola__hora" title="Hora proyectada de inicio">{t.es_hoy ? t.inicio_proyectado : t.hora_inicio}</span>
              <div className="cola__info">
                <strong>{t.usuario_nombre}</strong>
                <small>{t.codigo.slice(-6)} · {t.tramite_nombre} · ~{Math.round(t.duracion_estimada_seg / 60)} min</small>
              </div>
              <span className={`punt punt--${pu.tono}`}>{pu.texto}</span>
              <button className="icono-btn" title="Llamar a esta persona" aria-label={`Llamar a ${t.usuario_nombre}`} disabled={Boolean(actual) || ocupado} onClick={() => llamar(t.id)}>
                <Icon name="megafono" size={17} />
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
        return <button className="btn btn--primario" disabled={ocupado} onClick={() => llamar(turnoId)}><Icon name="megafono" size={17} /> Llamar {codigo}</button>;
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
        return <button className="btn btn--primario" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.iniciar(turnoId))}><Icon name="atender" size={17} /> Iniciar atención</button>;
      case "ausente":
        return (
          <>
            <button className="btn btn--primario" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.noAsistio(turnoId))}><Icon name="ausente" size={17} /> Marcar no asistió</button>
            <button className="btn btn--borde-claro" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.iniciar(turnoId))}>Ya llegó, iniciar</button>
          </>
        );
      case "finalizar":
        return <button className="btn btn--primario" disabled={ocupado || !actual} onClick={() => finalizar(actual)}><Icon name="finalizado" size={17} /> Finalizar atención</button>;
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
          <Dropdown
            className="dd--barra"
            icon="edificio"
            ariaLabel="Sede donde atiendes"
            placeholder="Elige tu sede"
            value={p?.agente?.sede_id ?? ""}
            options={sedes.map((s) => ({ value: s.id, label: s.nombre, hint: s.direccion }))}
            onChange={(id) => {
              const sede = sedes.find((s) => String(s.id) === String(id));
              if (sede && sede.id !== p?.agente?.sede_id) setNuevaSede(sede);
            }}
            disabled={!sedes.length}
          />
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
      {p?.error && <div className="ag__aviso"><Icon name="alerta" size={16} /> {p.error} Elige tu sede en la parte de arriba.</div>}

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

          <section className={`puesto ${actual ? `puesto--${actual.estado.toLowerCase()}` : cierre ? "puesto--cierre" : ""}`}>
            {actual ? (
              <div className="puesto__contenido" key={`${actual.id}-${actual.estado}`}>
                <div className="puesto__cabeza">
                  <Etapas estado={actual.estado} />
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
                      <button className="btn btn--primario btn--grande" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.iniciar(actual.id))}><Icon name="atender" size={18} /> Iniciar atención</button>
                      <button className="btn btn--borde" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.noAsistio(actual.id))}><Icon name="ausente" size={17} /> No asistió</button>
                      <button className="btn btn--fantasma" disabled={ocupado} onClick={() => ejecutar(() => agenteApi.devolver(actual.id))}><Icon name="deshacer" size={17} /> Devolver a la cola</button>
                    </>
                  ) : (
                    <button className="btn btn--exito btn--grande" disabled={ocupado} onClick={() => finalizar(actual)}><Icon name="finalizado" size={18} /> Finalizar atención</button>
                  )}
                </div>
              </div>
            ) : cierre ? (
              <div className="puesto__cierre" role="status">
                <svg className="sello" viewBox="0 0 52 52" aria-hidden="true">
                  <circle className="sello__circulo" cx="26" cy="26" r="23" />
                  <path className="sello__check" d="m15 27 7.5 7.5L38 19" />
                </svg>
                <div>
                  <h2>Atención finalizada</h2>
                  <p><span className="mono">{cierre.codigo}</span> · {cierre.nombre}{cierre.seg != null ? ` · ${mmss(cierre.seg)}` : ""}</p>
                </div>
              </div>
            ) : (
              <div className="puesto__libre">
                <span className="puesto__icono"><Icon name="atender" size={28} /></span>
                <div>
                  <h2>Puesto libre</h2>
                  <p>{p?.cola?.length ? `${p.cola.length} persona(s) en la cola.` : "Nadie en la cola por ahora."}</p>
                </div>
                <button className="btn btn--primario btn--grande" disabled={ocupado || !p?.cola?.length || Boolean(pausaHasta)} onClick={() => llamar()}>
                  <Icon name="megafono" size={18} /> Llamar siguiente
                </button>
              </div>
            )}
          </section>

          <section className="ag__dia" aria-label="Mi jornada">
            <div><span>Atendidos hoy</span><strong><Cifra valor={r.atendidos_hoy} /></strong></div>
            <div><span>No asistieron</span><strong><Cifra valor={r.no_asistio_hoy} /></strong></div>
            <div><span>Promedio</span><strong>{duracion(r.promedio_hoy_segundos)}</strong></div>
            <div><span>En su franja</span><strong><Cifra valor={r.puntualidad_pct} sufijo="%" /></strong></div>
            <div><span>Dentro de {Math.round(maxSeg / 60)} min</span><strong><Cifra valor={r.dentro_tiempo_max_pct} sufijo="%" /></strong></div>
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
      {nuevaSede && (
        <Confirmar
          titulo="Cambiar de sede"
          mensaje={`Vas a atender en ${nuevaSede.nombre}. Tu cola cambia a la de esa sede y el cupo de ambas sedes se recalcula (3 personas por asesor cada 30 min).`}
          textoConfirmar={`Atender en ${nuevaSede.nombre}`}
          peligro={false}
          ocupado={cambio.ocupado}
          error={cambio.error}
          onConfirmar={confirmarCambioSede}
          onCerrar={() => { setNuevaSede(null); setCambio({ ocupado: false, error: "" }); }}
        />
      )}
      {cambiarClave && <CambiarMiClave onCerrar={() => setCambiarClave(false)} onListo={(u) => { onUsuario?.(u); avisar("Tu contraseña fue actualizada."); }} />}
    </div>
  );
}
