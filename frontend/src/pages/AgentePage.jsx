import { useEffect, useMemo, useRef, useState } from "react";
import * as agenteApi from "../api/agente.api";
import { listarSedes } from "../api/publico.api";
import Marca from "../components/layout/Marca";
import { SaltarAlContenido } from "../components/ui/Accesibilidad";
import { anunciar } from "../hooks/useAccesibilidad";
import Equipos from "../components/agente/Equipos";
import FormularioEquipo from "../components/agente/FormularioEquipo";
import Presencia from "../components/agente/Presencia";
import PrepararTurno, { InsigniaPreparacion } from "../components/agente/PrepararTurno";
import Reclamos from "../components/agente/Reclamos";
import VerificarCedula from "../components/agente/VerificarCedula";
import { CambiarMiClave } from "../components/ui/CambiarClave";
import AsistenteIA from "../components/ui/AsistenteIA";
import Dropdown from "../components/ui/Dropdown";
import Icon from "../components/ui/Icon";
import { Confirmar } from "../components/ui/Modal";
import { useToast } from "../hooks/useToast";
import usePolling from "../hooks/usePolling";
import useLlamadoPorVoz, { cambiarLlamadoPorVoz, destinoHablado } from "../hooks/useLlamadoPorVoz";
import {
  codigoTurno, duracion, ESTADOS_EQUIPO, fechaCorta, horaDe, iniciales, PREPARACION, PRESENCIAS,
  primerNombre, textoPreparacion, valorRespuesta, ZONA,
} from "../utils/formatters";
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
  preparar: "paquete",
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
  const modulo = p?.agente?.modulo || "";

  // Llamado por voz: anuncia y repite cada 20 s mientras el turno siga "Llamado".
  const voz = useLlamadoPorVoz({ turno: actual, modulo, asesor: p?.agente?.nombre || usuario.nombre });

  // Preparación previa del pedido (se abre desde la cola, el puesto o el asistente).
  const [preparar, setPreparar] = useState(null);
  // Secciones de la consola y estado de presencia del asesor.
  const [seccion, setSeccion] = useState("atencion");
  const [reclamosVistos, setReclamosPendientes] = useState(null);
  const { datos: bandeja } = usePolling(() => agenteApi.bandejaReclamos(), 12000);
  const reclamosPendientes = (reclamosVistos ?? bandeja?.pendientes ?? 0) + 0;
  const [recibirEquipo, setRecibirEquipo] = useState(null);
  const presencia = p?.agente?.presencia || "DISPONIBLE";
  async function cambiarPresencia(nueva, { silencioso = false } = {}) {
    try {
      const r = await agenteApi.cambiarPresencia(nueva);
      if (!silencioso) avisar(r.mensaje);
      refrescar();
    } catch (e) {
      avisar(e.message, "error");
    }
  }
  function iniciarPausa(segundos) {
    setPausaHasta(ahora + segundos * 1000);
    cambiarPresencia("PAUSA", { silencioso: true });
  }
  function terminarPausa() {
    setPausaHasta(null);
    cambiarPresencia("DISPONIBLE", { silencioso: true });
  }
  // Entregar o recibir un equipo exige verificar la cédula del titular.
  const [cedula, setCedula] = useState(null);
  async function moverEquipo(equipo, estado) {
    if (estado === "ENTREGADO" || (estado === "RECIBIDO" && equipo.estado === "POR_RECIBIR")) {
      setCedula({ equipo, estado });
      return;
    }
    try {
      const r = await agenteApi.cambiarEstadoEquipo(equipo.id, estado);
      avisar(r.mensaje);
      refrescar();
    } catch (e) {
      avisar(e.message, "error");
    }
  }

  const abrirPreparar = (turnoId) => {
    const t = [actual, ...(p?.cola || [])].find((x) => x && x.id === turnoId);
    if (t) setPreparar(t);
  };

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
      agenteApi.cambiarPresencia("DISPONIBLE").catch(() => {});
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
        codigo: codigoTurno(turno),
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

  // ------------------------------------------------ alertas emergentes del asistente
  // Avisan sin que el asesor pierda de vista la cola: fin de franja, siguiente
  // persona atrasada según la proyección y mensajes nuevos de clientes.
  const [alertas, setAlertas] = useState([]);
  const avisadas = useRef(new Set());
  const emitir = (clave, alerta) => {
    if (avisadas.current.has(clave)) return;
    avisadas.current.add(clave);
    setAlertas((xs) => [...xs.slice(-2), { clave, ...alerta }]);
    anunciar(alerta.titulo);
  };
  const cerrarAlerta = (clave) => setAlertas((xs) => xs.filter((x) => x.clave !== clave));
  useEffect(() => {
    if (!alertas.length) return undefined;
    const t = window.setTimeout(() => setAlertas((xs) => xs.slice(1)), 12000);
    return () => window.clearTimeout(t);
  }, [alertas]);
  const pendientesFranja = franja ? Math.max(0, franja.reservados - franja.atendidos) : 0;
  useEffect(() => {
    if (franja && franjaRestante > 0 && franjaRestante <= 300 && pendientesFranja > 0) {
      emitir(`franja-${franja.inicio}`, {
        tono: "riesgo", icono: "reloj",
        titulo: `Quedan ${Math.ceil(franjaRestante / 60)} min de la franja ${franja.inicio}–${franja.fin}`,
        detalle: `${pendientesFranja} persona(s) de esta franja aún sin atender. Prioriza a quien está en riesgo.`,
      });
    }
    const siguiente = p?.cola?.find((t) => t.es_hoy);
    if (siguiente && !actual && ["atrasado", "en_riesgo"].includes(siguiente.puntualidad)) {
      emitir(`tarde-${siguiente.id}-${siguiente.puntualidad}`, {
        tono: siguiente.puntualidad === "atrasado" ? "atrasado" : "riesgo", icono: "megafono",
        titulo: `${primerNombre(siguiente.usuario_nombre)} ${siguiente.puntualidad === "atrasado" ? "ya está fuera de su franja" : "está por salirse de su franja"}`,
        detalle: `Turno ${codigoTurno(siguiente)} · ${siguiente.tramite_nombre}. El asistente recomienda llamarle ya.`,
        accion: { texto: `Llamar a ${primerNombre(siguiente.usuario_nombre)}`, fn: () => llamar(siguiente.id) },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor(franjaRestante / 30), p?.cola, actual]);
  const sinLeer = bandeja?.mensajes_sin_leer || 0;
  const previoSinLeer = useRef(null);
  useEffect(() => {
    if (previoSinLeer.current !== null && sinLeer > previoSinLeer.current) {
      emitir(`chat-${Date.now()}`, {
        tono: "info", icono: "mensaje",
        titulo: "Nuevo mensaje de un cliente",
        detalle: "El asistente ya le respondió lo básico. Revisa si necesita precio, fecha o diagnóstico.",
        accion: { texto: "Abrir reclamos", fn: () => setSeccion("reclamos") },
      });
    }
    previoSinLeer.current = sinLeer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinLeer]);
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
                <small><span className="mono">{codigoTurno(t)}</span> · {t.tramite_nombre} · ~{Math.round(t.duracion_estimada_seg / 60)} min</small>
                {t.respuestas_solicitud?.length > 0 && (
                  <small className="cola__necesidad">
                    {t.respuestas_solicitud.map((respuesta) => `${respuesta.etiqueta}: ${valorRespuesta(respuesta.valor)}`).join(" · ")}
                  </small>
                )}
                {t.detalle_necesidad && <small className="cola__necesidad" title={t.detalle_necesidad}>{t.detalle_necesidad}</small>}
                {t.equipo && <small className="cola__equipo"><Icon name="tv" size={12} /> {t.equipo.marca} {t.equipo.modelo} · <span className="mono">{t.equipo.codigo}</span> · {ESTADOS_EQUIPO[t.equipo.estado]?.texto}</small>}
                {t.reclamo && <small className="cola__equipo"><Icon name="mensaje" size={12} /> Reclamo <span className="mono">{t.reclamo.radicado}</span> · {t.reclamo.categoria_texto}</small>}
                {t.preparacion && <span className="cola__prep"><InsigniaPreparacion preparacion={t.preparacion} flujo={t.tramite_flujo} /></span>}
              </div>
              {t.requiere_preparacion || t.preparacion ? (
                <button className="icono-btn" title="Preparar antes de que llegue" aria-label={`Preparar el pedido de ${t.usuario_nombre}`} onClick={() => setPreparar(t)}>
                  <Icon name="paquete" size={17} />
                </button>
              ) : <span aria-hidden="true" />}
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
    // Siempre por nombre: "Llamar a Juliana". El código queda en el motivo.
    const persona = primerNombre(rec.turno_nombre) || codigoTurno(rec.turno_codigo);
    switch (rec.accion) {
      case "llamar":
        return <button className="btn btn--primario" disabled={ocupado} onClick={() => llamar(turnoId)}><Icon name="megafono" size={17} /> Llamar a {persona}</button>;
      case "pausa":
        return (
          <>
            <button className="btn btn--primario" onClick={() => iniciarPausa(rec.pausa_seg)}><Icon name="reloj" size={17} /> Tomar pausa de {mmss(rec.pausa_seg)}</button>
            <button className="btn btn--borde-claro" disabled={ocupado} onClick={() => llamar(turnoId)}>Llamar ahora</button>
          </>
        );
      case "adelantar":
        return (
          <>
            <button className="btn btn--primario" disabled={ocupado} onClick={() => llamar(turnoId)}><Icon name="derecha" size={17} /> Adelantar a {persona}</button>
            {rec.pausa_seg > 60 && <button className="btn btn--borde-claro" onClick={() => iniciarPausa(Math.min(rec.pausa_seg, 180))}>Pausa {mmss(Math.min(rec.pausa_seg, 180))}</button>}
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
      case "preparar":
        return (
          <>
            <button className="btn btn--primario" onClick={() => abrirPreparar(turnoId)}><Icon name="paquete" size={17} /> Alistar lo de {persona}</button>
            <button className="btn btn--borde-claro" disabled={ocupado} onClick={() => llamar(turnoId)}>Llamar ahora</button>
          </>
        );
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
          <small>{usuario.nombre}{modulo ? ` · ${modulo}` : ""}</small>
        </div>
        <div className="ag__franja-chip">
          {franja ? (
            <>
              <span><span className="ag__franja-etq">Franja </span>{franja.inicio}–{franja.fin}</span>
              <strong className={franjaRestante < 300 ? "urgente" : ""}>quedan {mmss(franjaRestante)}</strong>
            </>
          ) : <span>{p && !p.en_horario ? `Fuera de horario · ${p.horario?.hora_apertura}–${p.horario?.hora_cierre}` : "—"}</span>}
        </div>
        <time className="ag__reloj" aria-label="Hora actual">{reloj(ahora)}</time>
        <Presencia valor={presencia} desde={p?.agente?.presencia_desde} bloqueado={Boolean(actual)} onCambiar={(v) => (v === "DISPONIBLE" && pausaHasta ? terminarPausa() : cambiarPresencia(v))} />
        <button
          type="button"
          className={`ag__voz ${voz.activo ? "ag__voz--on" : ""}`}
          aria-pressed={voz.activo}
          onClick={() => cambiarLlamadoPorVoz(!voz.activo)}
          title={voz.soportado ? "Anunciar por voz el turno llamado (se repite cada 20 s)" : "Este navegador no permite voz"}
          disabled={!voz.soportado}
        >
          <Icon name={voz.activo ? "volumen" : "silencio"} size={17} />
          <span>Voz {voz.activo ? "activada" : "apagada"}</span>
        </button>
        <button className="icono-btn ag__salir" onClick={() => setCambiarClave(true)} title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña"><Icon name="llave" size={18} /></button>
        <button className="icono-btn ag__salir" onClick={onSalir} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="salir" size={19} /></button>
      </header>

      {error && <div className="ag__aviso"><Icon name="alerta" size={16} /> {error} Reintentando…</div>}
      {p?.error && <div className="ag__aviso"><Icon name="alerta" size={16} /> {p.error} Elige tu sede en la parte de arriba.</div>}

      <nav className="ag__tabs" aria-label="Secciones de la consola">
        {[
          ["atencion", "Atención", "atender", p?.resumen?.en_espera_hoy],
          ["equipos", "Equipos", "tv", null],
          ["reclamos", "Reclamos", "mensaje", reclamosPendientes],
        ].map(([id, texto, icono, n]) => (
          <button key={id} type="button" className={seccion === id ? "activo" : ""} aria-current={seccion === id ? "page" : undefined} onClick={() => setSeccion(id)}>
            <Icon name={icono} size={16} /> {texto}{n ? <small>{n}</small> : null}
          </button>
        ))}
      </nav>

      {seccion === "equipos" && <main className="ag__seccion" id="contenido" tabIndex={-1}><Equipos /></main>}
      {seccion === "reclamos" && <main className="ag__seccion" id="contenido" tabIndex={-1}><Reclamos onPendientes={setReclamosPendientes} /></main>}
      {seccion === "atencion" && (
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
                <button className="btn btn--primario" onClick={terminarPausa}>Terminar pausa</button>
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
                  <span className="puesto__avatar" aria-hidden="true">{iniciales(actual.usuario_nombre)}</span>
                  <div>
                    <h2>{actual.usuario_nombre}</h2>
                    <p className="puesto__datos">
                      <span>{actual.tramite_nombre}</span>
                      <span>Turno <b className="mono">{codigoTurno(actual)}</b></span>
                      <span><Icon name="celular" size={13} /> {actual.usuario_celular}</span>
                      {actual.usuario_documento && <span><Icon name="ficha" size={13} /> C.C. {actual.usuario_documento}</span>}
                    </p>
                  </div>
                </div>
                {actual.detalle_necesidad && (
                  <section className="puesto__necesidad" aria-label="Necesidad reportada por el ciudadano">
                    <strong>Necesidad reportada</strong>
                    <p>{actual.detalle_necesidad}</p>
                  </section>
                )}
                {actual.respuestas_solicitud?.length > 0 && (
                  <section className="puesto__necesidad" aria-label="Respuestas del ciudadano">
                    <strong>Respuestas</strong>
                    <dl>
                      {actual.respuestas_solicitud.map((respuesta) => (
                        <div key={respuesta.id}>
                          <dt>{respuesta.etiqueta}</dt>
                          <dd>{valorRespuesta(respuesta.valor)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {actual.equipo && (
                  <section className="puesto__equipo" aria-label="Equipo del cliente">
                    <span className="puesto__equipo-icono"><Icon name="tv" size={20} /></span>
                    <div>
                      <strong>{actual.equipo.marca} {actual.equipo.modelo}</strong>
                      <small><span className="mono">{actual.equipo.codigo}</span> · {actual.equipo.origen_texto}{actual.equipo.falla ? ` · ${actual.equipo.falla}` : ""}</small>
                    </div>
                    <span className={`estado estado--${ESTADOS_EQUIPO[actual.equipo.estado]?.tono}`}>{ESTADOS_EQUIPO[actual.equipo.estado]?.texto}</span>
                    {actual.equipo.estado === "LISTO" && actual.tramite_flujo === "ENTREGA" && (
                      <button type="button" className="btn btn--exito btn--chico" onClick={() => moverEquipo(actual.equipo, "ENTREGADO")}><Icon name="check" size={15} /> Entregar equipo</button>
                    )}
                    {actual.equipo.estado === "POR_RECIBIR" && (
                      <button type="button" className="btn btn--primario btn--chico" onClick={() => moverEquipo(actual.equipo, "RECIBIDO")}><Icon name="paquete" size={15} /> Recibir equipo</button>
                    )}
                  </section>
                )}
                {actual.reclamo && (
                  <section className="puesto__necesidad" aria-label="Reclamo del cliente">
                    <strong>Reclamo <span className="mono">{actual.reclamo.radicado}</span> · {actual.reclamo.categoria_texto}</strong>
                    <p>{actual.reclamo.descripcion}</p>
                    <button type="button" className="enlace" onClick={() => setSeccion("reclamos")}>Responder en Reclamos</button>
                  </section>
                )}
                {!actual.equipo && actual.estado === "EN_ATENCION" && actual.tramite_flujo === "GENERAL" && (
                  <button type="button" className="btn btn--borde btn--chico puesto__recibir" onClick={() => setRecibirEquipo({ cliente_celular: actual.usuario_celular, cliente_nombre: actual.usuario_nombre, cliente_documento: actual.usuario_documento })}>
                    <Icon name="tv" size={15} /> ¿Deja un equipo? Registrarlo
                  </button>
                )}
                {actual.preparacion && actual.equipo?.estado !== "ENTREGADO" && (
                  <section className={`puesto__prep puesto__prep--${PREPARACION[actual.preparacion.estado]?.tono}`} aria-label="Preparación previa">
                    <Icon name="paquete" size={18} />
                    <div>
                      <strong>{textoPreparacion(actual.tramite_flujo, actual.preparacion.estado)}</strong>
                      {actual.preparacion.nota && <p>{actual.preparacion.nota}</p>}
                    </div>
                    <button type="button" className="btn btn--suave btn--chico" onClick={() => setPreparar(actual)}>Actualizar</button>
                  </section>
                )}
                {actual.estado === "LLAMADO" && (
                  <div className={`llamado-voz ${voz.activo ? "" : "llamado-voz--off"}`} role="status">
                    <Icon name={voz.activo ? "volumen" : "silencio"} size={18} />
                    <span>
                      {!voz.soportado
                        ? "Este navegador no permite anunciar por voz."
                        : voz.activo
                          ? voz.restante != null
                            ? <>Anunciando por voz{modulo ? ` ${destinoHablado(modulo)}` : ""} · se repite en <b>{voz.restante} s</b></>
                            : voz.veces ? "Se completaron los anuncios por voz (3 min)." : "Preparando el anuncio por voz…"
                          : "Voz apagada: el turno solo se muestra en la sala."}
                    </span>
                    {voz.soportado && (
                      <>
                        <button type="button" className="btn btn--suave btn--chico" onClick={voz.repetirAhora}><Icon name="megafono" size={15} /> Repetir</button>
                        <button type="button" className="btn btn--fantasma btn--chico" onClick={() => cambiarLlamadoPorVoz(!voz.activo)}>
                          {voz.activo ? "Silenciar" : "Activar voz"}
                        </button>
                      </>
                    )}
                  </div>
                )}
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
                  <p>{cierre.nombre} · <span className="mono">{cierre.codigo}</span>{cierre.seg != null ? ` · ${mmss(cierre.seg)}` : ""}</p>
                </div>
              </div>
            ) : (
              <div className={`puesto__libre ${presencia !== "DISPONIBLE" && !pausaHasta ? "puesto__libre--fuera" : ""}`}>
                <span className="puesto__icono"><Icon name={presencia !== "DISPONIBLE" && !pausaHasta ? PRESENCIAS[presencia]?.icono : "atender"} size={28} /></span>
                <div>
                  {presencia !== "DISPONIBLE" && !pausaHasta ? (
                    <>
                      <h2>{PRESENCIAS[presencia]?.texto}</h2>
                      <p>Desde las {horaDe(p?.agente?.presencia_desde)} · {r.en_espera_hoy ?? 0} para hoy en la cola.</p>
                      <button type="button" className="enlace" onClick={() => cambiarPresencia("DISPONIBLE")}>Volver a disponible</button>
                    </>
                  ) : (
                    <>
                      <h2>Puesto libre</h2>
                      <p>{p?.cola?.length ? `${r.en_espera_hoy ?? 0} para hoy · ${p.cola.length} en total en la cola.` : "Nadie en la cola por ahora."}</p>
                    </>
                  )}
                </div>
                <button className="btn btn--primario btn--grande" disabled={ocupado || !p?.cola?.length || Boolean(pausaHasta)} onClick={() => llamar()}>
                  <Icon name="megafono" size={18} /> Llamar siguiente
                </button>
              </div>
            )}
          </section>

          <section className="jornada" aria-labelledby="titulo-jornada">
            <header className="jornada__cabeza">
              <h2 id="titulo-jornada"><Icon name="grafica" size={16} /> Tu jornada de hoy</h2>
              <span>{p?.agente?.sede || "—"}</span>
            </header>
            <div className="jornada__metricas">
              <div className="jornada__metrica">
                <span className="jornada__icono jornada__icono--ok"><Icon name="finalizado" size={17} /></span>
                <strong><Cifra valor={r.atendidos_hoy} /></strong><span>Atendidos</span>
              </div>
              <div className="jornada__metrica">
                <span className="jornada__icono jornada__icono--mal"><Icon name="ausente" size={17} /></span>
                <strong><Cifra valor={r.no_asistio_hoy} /></strong><span>No asistieron</span>
              </div>
              <div className="jornada__metrica">
                <span className="jornada__icono"><Icon name="reloj" size={17} /></span>
                <strong>{duracion(r.promedio_hoy_segundos)}</strong><span>Tiempo promedio</span>
              </div>
              <div className="jornada__metrica">
                <span className={`jornada__icono ${r.puntualidad_pct == null ? "" : r.puntualidad_pct >= 90 ? "jornada__icono--ok" : "jornada__icono--alerta"}`}><Icon name="calendario" size={17} /></span>
                <strong><Cifra valor={r.puntualidad_pct} sufijo="%" /></strong><span>En su franja</span>
              </div>
              <div className="jornada__metrica">
                <span className={`jornada__icono ${r.dentro_tiempo_max_pct == null ? "" : r.dentro_tiempo_max_pct >= 90 ? "jornada__icono--ok" : "jornada__icono--alerta"}`}><Icon name="rayo" size={17} /></span>
                <strong><Cifra valor={r.dentro_tiempo_max_pct} sufijo="%" /></strong><span>Dentro de {Math.round(maxSeg / 60)} min</span>
              </div>
            </div>
          </section>

          {p?.recientes?.length > 0 && (
            <section className="ag__recientes">
              <h3><Icon name="lista" size={15} /> Últimas atenciones</h3>
              <ul>
                {p.recientes.map((t) => (
                  <li key={t.id}>
                    <span className="ag__reciente-quien"><strong>{t.usuario_nombre}</strong><small className="mono">{codigoTurno(t)}</small></span>
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
            <span>
              {r.en_espera_hoy ?? 0} hoy
              {r.en_riesgo ? <> · <b className="texto-riesgo">{r.en_riesgo} en riesgo</b></> : null}
              {r.por_preparar ? <> · <b className="texto-prep">{r.por_preparar} por preparar</b></> : null}
            </span>
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
      )}
      <div className="alertas" aria-live="assertive">
        {alertas.map((a) => (
          <div key={a.clave} className={`alerta alerta--${a.tono}`} role="alert">
            <span className="alerta__icono"><Icon name={a.icono} size={18} /></span>
            <div>
              <strong>{a.titulo}</strong>
              <p>{a.detalle}</p>
              {a.accion && <button type="button" className="btn btn--primario btn--chico" onClick={() => { a.accion.fn(); cerrarAlerta(a.clave); }}>{a.accion.texto}</button>}
            </div>
            <button type="button" className="icono-btn" aria-label="Cerrar aviso" onClick={() => cerrarAlerta(a.clave)}><Icon name="cerrar" size={15} /></button>
          </div>
        ))}
      </div>
      {recibirEquipo && (
        <FormularioEquipo
          inicial={recibirEquipo}
          onCerrar={() => setRecibirEquipo(null)}
          onGuardado={(r) => { setRecibirEquipo(null); avisar(r.mensaje); refrescar(); }}
        />
      )}
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
      {cedula && (
        <VerificarCedula
          equipo={cedula.equipo}
          estado={cedula.estado}
          nombre={actual?.usuario_nombre}
          onCerrar={() => setCedula(null)}
          onListo={(r) => { setCedula(null); avisar(r.mensaje); refrescar(); }}
        />
      )}
      {preparar && (
        <PrepararTurno
          turno={preparar}
          onCerrar={() => setPreparar(null)}
          onListo={(r) => { setPreparar(null); avisar(r.mensaje); refrescar(); }}
        />
      )}
      <AsistenteIA
        titulo="Copiloto IA"
        subtitulo={p?.agente?.sede ? `Tu cola de ${p.agente.sede} en tiempo real` : undefined}
        onAccion={(a) => {
          if (a.tipo === "llamar") { setSeccion("atencion"); llamar(a.turno_id); }
          else if (a.tipo === "preparar") { setSeccion("atencion"); abrirPreparar(a.turno_id); }
          else if (a.tipo === "seccion") setSeccion(a.destino);
        }}
      />
      {cambiarClave && <CambiarMiClave onCerrar={() => setCambiarClave(false)} onListo={(u) => { onUsuario?.(u); avisar("Tu contraseña fue actualizada."); }} />}
    </div>
  );
}
