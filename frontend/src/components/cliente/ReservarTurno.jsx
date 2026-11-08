import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as publicoApi from "../../api/publico.api";
import {
  diaMes, diaSemana, ESTADOS_EQUIPO, fechaCorta, fechaLarga, hoyISO, PREP_CLIENTE, soloDigitos,
} from "../../utils/formatters";

/** Franja legible: "10:00 – 10:30". */
const rango = (f) => `${f.hora_inicio} – ${f.hora_fin}`;
/** Parte del día de una franja, para agrupar el desplegable de horas. */
function jornada(f) {
  const h = Number(String(f.hora_inicio).slice(0, 2));
  return h < 6 ? "Madrugada" : h < 12 ? "Mañana" : h < 18 ? "Tarde" : "Noche";
}
const JORNADAS = ["Madrugada", "Mañana", "Tarde", "Noche"];
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";

/**
 * Reserva guiada paso a paso (asistente). Los pasos cambian según el tipo de
 * atención del trámite (tipo_flujo):
 *
 *   GENERAL   Qué necesitas → Tu celular → Cuándo → Confirmar
 *   ENTREGA   Qué necesitas → Tu celular → Tu equipo (listo) → Cuándo → Confirmar
 *   GARANTIA  Qué necesitas → Tu celular → Tu televisor (marca, compra ≤ 1 año) → Cuándo → Confirmar
 *   RECLAMO   Qué necesitas → Tu celular → Tu reclamo → [en línea: radicado] | [en persona: Cuándo → Confirmar]
 *
 * El celular verificado con código es la identidad del ciudadano: con él se
 * consultan sus equipos registrados y su nombre.
 */

const DIAS_VISIBLES = 7;
const GARANTIA_DIAS = 365;

const ICONO_FLUJO = { ENTREGA: "paquete", GARANTIA: "escudo2", RECLAMO: "mensaje" };
function iconoTramite(t) {
  if (ICONO_FLUJO[t.tipo_flujo]) return ICONO_FLUJO[t.tipo_flujo];
  if (/cotiz|repuesto/i.test(t.nombre)) return "ficha";
  if (/diagn|pantalla|televisor|repar/i.test(t.nombre)) return "tv";
  return "servicio";
}

const PASOS = {
  tramite: "Qué necesitas",
  celular: "Tu celular",
  equipo: "Tu equipo",
  garantia: "Tu televisor",
  reclamo: "Tu reclamo",
  horario: "Cuándo",
  confirmar: "Confirmar",
};

function pasosDe(flujo, reclamoEnLinea) {
  const medio = { ENTREGA: ["equipo"], GARANTIA: ["garantia"], RECLAMO: ["reclamo"] }[flujo] || [];
  if (flujo === "RECLAMO" && reclamoEnLinea) return ["tramite", "celular", ...medio];
  return ["tramite", "celular", ...medio, "horario", "confirmar"];
}

/** "15 de junio de 2027" a partir de una fecha ISO. */
function fechaConAnio(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(a, m - 1, d, 12)));
}

/** Fecha ISO de hace n días (para el límite de la garantía). */
function haceDias(n) {
  return hoyISO(-n);
}

export default function ReservarTurno({ onResumen, onConfirmado }) {
  // ------------------------------------------------------------ catálogo
  const [sedes, setSedes] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [categorias, setCategorias] = useState({});
  const [cargando, setCargando] = useState(true);

  // ------------------------------------------------------------ selección
  const [paso, setPaso] = useState("tramite");
  const [direccion, setDireccion] = useState(1);
  const [tramiteId, setTramiteId] = useState("");
  const [sede, setSede] = useState("");

  // ------------------------------------------------------------ identidad
  const [celular, setCelular] = useState("");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoPrueba, setCodigoPrueba] = useState("");
  const [token, setToken] = useState("");
  const [conocido, setConocido] = useState(false);
  const [equipos, setEquipos] = useState([]);

  // ------------------------------------------------------------ por flujo
  const [equipoId, setEquipoId] = useState("");
  const [garantia, setGarantia] = useState({ marca: "", modelo: "", fecha_compra: "", falla: "" });
  const [reclamo, setReclamo] = useState({ categoria: "", descripcion: "", equipo_id: "", presencial: null });
  const [reclamoCreado, setReclamoCreado] = useState(null);

  // ------------------------------------------------------------ horario
  const [fecha, setFecha] = useState(hoyISO());
  const [inicioDias, setInicioDias] = useState(0);
  const [franjas, setFranjas] = useState([]);
  const [franja, setFranja] = useState("");
  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const consulta = useRef(0);

  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    Promise.all([
      publicoApi.listarSedes(), publicoApi.listarTramites(),
      publicoApi.catalogoEquipos().catch(() => null), publicoApi.catalogoReclamos().catch(() => null),
    ])
      .then(([s, t, ce, cr]) => {
        if (!vigente) return;
        setSedes(s?.puntos || []);
        setTramites(t?.tramites || []);
        setMarcas(ce?.marcas || []);
        setCategorias(cr?.categorias || {});
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, []);

  const tramite = tramites.find((t) => String(t.id) === String(tramiteId));
  const flujo = tramite?.tipo_flujo || "GENERAL";
  const sedeSel = sedes.find((s) => String(s.id) === String(sede));
  const equipoSel = equipos.find((e) => String(e.id) === String(equipoId));
  const franjaSel = franjas.find((f) => String(f.franja_id) === String(franja));
  const pasos = pasosDe(flujo, reclamo.presencial === false);
  const indice = Math.max(0, pasos.indexOf(paso));

  // ------------------------------------------------------------ resumen para la ficha
  useEffect(() => {
    onResumen?.({
      sede: sedeSel?.nombre,
      tramite: tramite?.nombre,
      fecha: franjaSel ? fecha : null,
      hora: franjaSel ? rango(franjaSel) : null,
      nombre: token ? nombre.trim() || null : null,
    });
  }, [sedeSel, tramite, franjaSel, fecha, nombre, token, onResumen]);

  // ------------------------------------------------------------ franjas
  useEffect(() => {
    if (paso !== "horario" || !sede || !tramiteId) return undefined;
    const id = ++consulta.current;
    const t = window.setTimeout(() => {
      setCargandoFranjas(true);
      publicoApi.franjasDisponibles({ sedeId: sede, tramiteId, fecha })
        .then((r) => id === consulta.current && setFranjas(r?.franjas || []))
        .catch(() => id === consulta.current && setFranjas([]))
        .finally(() => id === consulta.current && setCargandoFranjas(false));
    }, 0);
    return () => window.clearTimeout(t);
  }, [paso, sede, tramiteId, fecha]);

  const dias = useMemo(
    () => Array.from({ length: DIAS_VISIBLES }, (_, i) => hoyISO(inicioDias + i)),
    [inicioDias],
  );

  // ------------------------------------------------------------ navegación
  const ir = useCallback((destino, sentido = 1) => {
    setDireccion(sentido);
    setError("");
    setPaso(destino);
  }, []);
  const siguiente = () => ir(pasos[indice + 1], 1);
  const atras = () => ir(pasos[Math.max(0, indice - 1)], -1);

  function elegirTramite(t) {
    setTramiteId(String(t.id));
    setEquipoId("");
    setReclamo({ categoria: "", descripcion: "", equipo_id: "", presencial: null });
    setFranja("");
    ir(token ? pasosDe(t.tipo_flujo, false)[2] : "celular");
  }

  // ------------------------------------------------------------ verificación
  const celularValido = /^3\d{9}$/.test(celular);

  async function enviarCodigo() {
    setOcupado(true);
    setError("");
    try {
      const r = await publicoApi.solicitarCodigo(celular);
      setCodigoEnviado(true);
      setCodigoPrueba(r.codigo_prueba || "");
      setCodigo("");
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function verificar(valor) {
    setOcupado(true);
    setError("");
    try {
      const r = await publicoApi.verificarCodigo(celular, valor);
      setToken(r.token_verificacion);
      setCodigoEnviado(false);
      // Con el celular verificado buscamos lo que ya tiene registrado con nosotros.
      const mios = await publicoApi.misEquipos(celular, r.token_verificacion).catch(() => null);
      setEquipos(mios?.equipos || []);
      if (mios?.cliente?.nombre) {
        setNombre(mios.cliente.nombre);
        setConocido(true);
      }
    } catch (e) {
      setError(e.message);
      setCodigo("");
    } finally {
      setOcupado(false);
    }
  }

  function cambiarCodigo(valor) {
    const limpio = soloDigitos(valor, 6);
    setCodigo(limpio);
    if (limpio.length === 6) verificar(limpio);
  }

  function cambiarCelular(valor) {
    setCelular(soloDigitos(valor, 10));
    setToken("");
    setCodigoEnviado(false);
    setCodigo("");
    setConocido(false);
    setEquipos([]);
  }

  const nombreValido = nombre.trim().split(/\s+/).join(" ").length >= 3;

  // ------------------------------------------------------------ validaciones de flujo
  const garantiaVence = garantia.fecha_compra
    ? new Date(new Date(`${garantia.fecha_compra}T12:00:00`).getTime() + GARANTIA_DIAS * 86400000)
      .toISOString().slice(0, 10)
    : null;
  const garantiaVigente = Boolean(garantia.fecha_compra)
    && garantia.fecha_compra <= hoyISO() && garantia.fecha_compra >= haceDias(GARANTIA_DIAS);
  const garantiaLista = garantia.marca && garantiaVigente && garantia.falla.trim().length >= 3;
  const reclamoListo = reclamo.categoria && sede && reclamo.descripcion.trim().length >= 15
    && reclamo.presencial !== null;

  // ------------------------------------------------------------ acciones finales
  async function radicarReclamo() {
    setOcupado(true);
    setError("");
    try {
      const r = await publicoApi.radicarReclamo(celular, token, {
        nombre: nombre.trim(),
        categoria: reclamo.categoria,
        descripcion: reclamo.descripcion.trim(),
        punto_id: Number(sede),
        equipo_id: reclamo.equipo_id ? Number(reclamo.equipo_id) : null,
        presencial: Boolean(reclamo.presencial),
      });
      setReclamoCreado({ ...r.reclamo, id: r.reclamo_id });
      if (reclamo.presencial) ir("horario");
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    setOcupado(true);
    setError("");
    try {
      const r = await publicoApi.reservarTurno({
        nombre: nombre.trim(),
        celular,
        token_verificacion: token,
        punto_id: Number(sede),
        tramite_id: Number(tramiteId),
        franja_id: Number(franja),
        ...(flujo === "ENTREGA" ? { equipo_id: Number(equipoId) } : {}),
        ...(flujo === "GARANTIA" ? { garantia } : {}),
        ...(flujo === "RECLAMO" && reclamoCreado ? { reclamo_id: reclamoCreado.id } : {}),
      });
      onConfirmado?.(r.turno, celular, r.espera, r.token_consulta);
    } catch (e) {
      setError(e.message);
      if (/cupo|comenzaron/i.test(e.message)) { setFranja(""); ir("horario", -1); }
    } finally {
      setOcupado(false);
    }
  }

  function reiniciar() {
    setReclamoCreado(null);
    setTramiteId("");
    setReclamo({ categoria: "", descripcion: "", equipo_id: "", presencial: null });
    ir("tramite", -1);
  }

  // ------------------------------------------------------------ vistas por paso
  function vistaTramite() {
    return (
      <>
        <h2 className="wz__titulo">¿Qué necesitas hoy?</h2>
        <div className="wz__opciones">
          {cargando && [1, 2, 3, 4].map((i) => <div key={i} className="wz__opcion esqueleto" />)}
          {tramites.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`wz__opcion ${String(t.id) === tramiteId ? "activo" : ""}`}
              style={{ animationDelay: `${i * 45}ms` }}
              onClick={() => elegirTramite(t)}
            >
              <span className="wz__opcion-icono"><Icon name={iconoTramite(t)} size={22} /></span>
              <span className="wz__opcion-texto">
                <strong>{t.nombre}</strong>
                <small>{t.tipo_flujo === "RECLAMO" ? "En línea o en persona" : `${t.tiempo_estimado} min aprox.`}</small>
              </span>
              <Icon name="derecha" size={18} className="wz__opcion-flecha" />
            </button>
          ))}
        </div>
      </>
    );
  }

  function vistaCelular() {
    return (
      <>
        <h2 className="wz__titulo">{token ? (conocido ? `¡Hola de nuevo, ${nombre.split(" ")[0]}!` : "¡Listo! ¿Cómo te llamas?") : "Verifica tu celular"}</h2>
        <p className="wz__texto">
          {token
            ? conocido ? "Encontramos tus datos. Revisa que tu nombre esté bien." : "Así te llamaremos cuando sea tu turno."
            : "Te enviamos un código para confirmar que eres tú. No necesitas crear cuenta."}
        </p>
        {!token && (
          <>
            <div className="wz__celular">
              <label className="campo campo--grande">
                <Icon name="celular" size={18} />
                <input
                  type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus
                  value={celular} onChange={(e) => cambiarCelular(e.target.value)}
                  placeholder="300 123 4567" aria-label="Número de celular"
                />
              </label>
              <button type="button" className="btn btn--primario" disabled={!celularValido || ocupado} onClick={enviarCodigo}>
                {codigoEnviado ? "Reenviar" : "Enviar código"}
              </button>
            </div>
            {codigoEnviado && (
              <div className="wz__codigo">
                <input
                  className="wz__codigo-input" inputMode="numeric" autoComplete="one-time-code" autoFocus
                  value={codigo} onChange={(e) => cambiarCodigo(e.target.value)} maxLength={6}
                  placeholder="······" aria-label="Código de verificación" disabled={ocupado}
                />
                <p className="rv__nota">
                  {ocupado ? "Verificando…" : codigoPrueba ? (
                    <>Modo prueba: tu código es <button type="button" className="enlace" onClick={() => cambiarCodigo(codigoPrueba)}>{codigoPrueba}</button></>
                  ) : `Te enviamos un SMS al ${celular}.`}
                </p>
              </div>
            )}
          </>
        )}
        {token && (
          <>
            <div className="wz__verificado"><Icon name="check" size={16} /> {celular} verificado</div>
            <label className="campo campo--grande">
              <Icon name="usuario" size={18} />
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" autoComplete="name" maxLength={100} aria-label="Nombre completo" autoFocus={!conocido} />
            </label>
            {equipos.length > 0 && flujo === "GENERAL" && (
              <p className="wz__pista"><Icon name="tv" size={16} /> Tienes {equipos.length} equipo(s) registrado(s) con nosotros. Puedes ver su estado en “Consultar mi turno”.</p>
            )}
          </>
        )}
        <div className="wz__pie">
          <button type="button" className="btn btn--suave" onClick={atras}>Atrás</button>
          <button type="button" className="btn btn--primario" disabled={!token || !nombreValido} onClick={siguiente}>Continuar</button>
        </div>
      </>
    );
  }

  function vistaEquipo() {
    const activos = equipos.filter((e) => e.estado !== "ENTREGADO");
    return (
      <>
        <h2 className="wz__titulo">¿Qué equipo vas a recoger?</h2>
        <p className="wz__texto">Estos son los equipos registrados con tu celular. Puedes reservar la entrega de los que ya están listos.</p>
        <div className="wz__equipos">
          {activos.map((e, i) => {
            const est = ESTADOS_EQUIPO[e.estado] || {};
            const listo = e.estado === "LISTO";
            return (
              <button
                key={e.id} type="button" disabled={!listo}
                className={`wz__equipo ${String(e.id) === equipoId ? "activo" : ""} ${listo ? "wz__equipo--listo" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => { setEquipoId(String(e.id)); setSede(String(e.punto_id)); }}
              >
                <span className="wz__equipo-icono"><Icon name="tv" size={24} /></span>
                <span className="wz__equipo-info">
                  <strong>{e.marca} {e.modelo}</strong>
                  <small>{e.codigo} · {e.sede}</small>
                  <span className="wz__progreso" aria-label={est.texto}>
                    {["Recibido", "En reparación", "Listo"].map((p, k) => (
                      <i key={p} className={est.paso >= k + 1 ? "hecho" : ""} />
                    ))}
                  </span>
                  {e.nota && <small className="wz__equipo-nota">{e.nota}</small>}
                </span>
                <span className={`estado estado--${est.tono}`}>{est.texto}</span>
              </button>
            );
          })}
          {!activos.length && (
            <div className="wz__vacio">
              <Icon name="tv" size={28} />
              <strong>No encontramos equipos pendientes con este celular</strong>
              <span>Si trajiste un equipo, revisa que sea el mismo número. También puedes elegir otro servicio.</span>
              <button type="button" className="btn btn--borde" onClick={() => ir("tramite", -1)}>Elegir otro servicio</button>
            </div>
          )}
        </div>
        {equipoSel && <p className="rv__prep" role="note"><Icon name="paquete" size={17} /><span><strong>Lo alistamos antes de que llegues.</strong> Tu {equipoSel.marca} te espera probado en {equipoSel.sede}. Trae tu cédula para recibirlo.</span></p>}
        <div className="wz__pie">
          <button type="button" className="btn btn--suave" onClick={atras}>Atrás</button>
          <button type="button" className="btn btn--primario" disabled={!equipoSel} onClick={siguiente}>Continuar</button>
        </div>
      </>
    );
  }

  function vistaGarantia() {
    const g = garantia;
    const cambiar = (campo) => (e) => setGarantia((x) => ({ ...x, [campo]: e.target.value }));
    return (
      <>
        <h2 className="wz__titulo">Cuéntanos de tu televisor</h2>
        <p className="wz__texto">La garantía cubre televisores con máximo 1 año desde la compra.</p>
        <span className="etiqueta">Marca</span>
        <div className="wz__chips">
          {(marcas.length ? marcas : ["Samsung", "LG", "Sony", "TCL", "Hisense", "Otra"]).map((m) => (
            <button key={m} type="button" className={`wz__chip ${g.marca === m ? "activo" : ""}`} onClick={() => setGarantia((x) => ({ ...x, marca: m }))}>{m}</button>
          ))}
        </div>
        <div className="rv__fila rv__fila--2">
          <label>
            <span className="etiqueta">Fecha de compra</span>
            <span className={`campo ${g.fecha_compra ? (garantiaVigente ? "campo--ok" : "campo--error") : ""}`}>
              <Icon name="calendario" size={17} />
              <input type="date" value={g.fecha_compra} max={hoyISO()} onChange={cambiar("fecha_compra")} aria-label="Fecha de compra" />
            </span>
          </label>
          <label>
            <span className="etiqueta">Modelo o tamaño (opcional)</span>
            <span className="campo"><Icon name="tv" size={17} /><input value={g.modelo} onChange={cambiar("modelo")} maxLength={60} placeholder='Ej. 55" 4K' /></span>
          </label>
        </div>
        {g.fecha_compra && (
          <p className={`wz__garantia ${garantiaVigente ? "wz__garantia--ok" : "wz__garantia--no"}`} role="status">
            <Icon name={garantiaVigente ? "escudo2" : "alerta"} size={17} />
            <span>
              {garantiaVigente
                ? <>En garantía hasta el <strong>{fechaConAnio(garantiaVence)}</strong>.</>
                : g.fecha_compra > hoyISO() ? "La fecha de compra no puede ser futura."
                  : <>La garantía venció el {fechaConAnio(garantiaVence)}. Puedes reservar un <button type="button" className="enlace" onClick={() => ir("tramite", -1)}>diagnóstico</button>.</>}
            </span>
          </p>
        )}
        <label>
          <span className="etiqueta">¿Qué le pasa?</span>
          <span className="campo"><textarea rows={2} maxLength={300} value={g.falla} onChange={cambiar("falla")} placeholder="Ej. No enciende, la luz parpadea" /></span>
        </label>
        <div className="wz__pie">
          <button type="button" className="btn btn--suave" onClick={atras}>Atrás</button>
          <button type="button" className="btn btn--primario" disabled={!garantiaLista} onClick={siguiente}>Continuar</button>
        </div>
      </>
    );
  }

  function vistaReclamo() {
    if (reclamoCreado && !reclamoCreado.presencial) {
      return (
        <div className="wz__exito">
          <span className="listo__icono"><Icon name="check" size={26} strokeWidth={2.4} /></span>
          <h2>Reclamo radicado</h2>
          <div className="listo__codigo">{reclamoCreado.radicado}</div>
          <p>Un asesor de {reclamoCreado.sede} lo gestionará y verás la respuesta en <strong>Consultar mi turno → Por celular</strong>. No necesitas desplazarte.</p>
          <button type="button" className="btn btn--primario" onClick={reiniciar}>Hacer otra solicitud</button>
        </div>
      );
    }
    const r = reclamo;
    const set = (campo, valor) => setReclamo((x) => ({ ...x, [campo]: valor }));
    return (
      <>
        <h2 className="wz__titulo">Cuéntanos qué pasó</h2>
        <span className="etiqueta">Motivo</span>
        <div className="wz__chips">
          {Object.entries(categorias).map(([k, v]) => (
            <button key={k} type="button" className={`wz__chip ${r.categoria === k ? "activo" : ""}`} onClick={() => set("categoria", k)}>{v}</button>
          ))}
        </div>
        <div className="rv__fila rv__fila--2">
          <Dropdown label="Sede" icon="pin" value={sede} placeholder="¿En qué sede?" onChange={(v) => setSede(String(v))}
            options={sedes.map((s) => ({ value: s.id, label: s.nombre, hint: s.direccion }))} />
          <Dropdown label="Equipo relacionado (opcional)" icon="tv" value={r.equipo_id} placeholder={equipos.length ? "Ninguno" : "Sin equipos registrados"}
            disabled={!equipos.length} onChange={(v) => set("equipo_id", String(v))}
            options={[{ value: "", label: "Ninguno" }, ...equipos.map((e) => ({ value: e.id, label: `${e.marca} ${e.modelo || ""}`, hint: e.codigo }))]} />
        </div>
        <label>
          <span className="etiqueta">Tu reclamo</span>
          <span className="campo"><textarea rows={3} maxLength={1500} value={r.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Escribe con tus palabras qué pasó y qué esperas que hagamos." /></span>
          <small className="formulario__ayuda">{r.descripcion.trim().length < 15 ? `Mínimo 15 caracteres (${r.descripcion.trim().length}/15)` : `${r.descripcion.length}/1500`}</small>
        </label>
        <span className="etiqueta">¿Cómo quieres seguirlo?</span>
        <div className="wz__modos">
          <button type="button" className={`wz__modo ${r.presencial === false ? "activo" : ""}`} onClick={() => set("presencial", false)}>
            <Icon name="enviar" size={20} />
            <strong>En línea</strong>
            <small>Lo radicamos ya y ves la respuesta en “Consultar mi turno”.</small>
          </button>
          <button type="button" className={`wz__modo ${r.presencial === true ? "activo" : ""}`} onClick={() => set("presencial", true)}>
            <Icon name="usuario" size={20} />
            <strong>En persona</strong>
            <small>Lo radicamos y reservas un turno para hablar con un asesor.</small>
          </button>
        </div>
        <div className="wz__pie">
          <button type="button" className="btn btn--suave" onClick={atras}>Atrás</button>
          {reclamoCreado?.presencial ? (
            <button type="button" className="btn btn--primario" onClick={siguiente}>Elegir horario</button>
          ) : (
            <button type="button" className="btn btn--primario" disabled={!reclamoListo || ocupado} onClick={radicarReclamo}>
              {ocupado ? "Enviando…" : r.presencial ? "Radicar y elegir horario" : "Radicar reclamo"}
            </button>
          )}
        </div>
      </>
    );
  }

  function vistaHorario() {
    const sedeFija = (flujo === "ENTREGA" && equipoSel) || (flujo === "RECLAMO" && reclamoCreado);
    // Desplegable agrupado por parte del día: sin cuadrícula ni scroll de página.
    const opciones = JORNADAS.flatMap((j) => franjas
      .filter((f) => jornada(f) === j)
      .map((f) => ({
        value: f.franja_id,
        label: rango(f),
        group: j,
        hint: f.disponibles === 1 ? "Último cupo" : f.disponibles != null ? `${f.disponibles} cupos` : undefined,
      })));
    const primera = franjas[0];
    return (
      <>
        <h2 className="wz__titulo">¿Cuándo vienes?</h2>
        {sedeFija ? (
          <p className="wz__pista"><Icon name="pin" size={16} /> {sedeSel?.nombre} · {sedeSel?.direccion}</p>
        ) : (
          <Dropdown label="Sede" icon="pin" value={sede} placeholder="¿Dónde te atendemos?" onChange={(v) => { setSede(String(v)); setFranja(""); }}
            options={sedes.map((s) => ({ value: s.id, label: s.nombre, hint: s.direccion }))} />
        )}
        <div className={`rv__dias ${sede ? "" : "rv__bloque--espera"}`}>
          <button type="button" className="rv__flecha" onClick={() => setInicioDias((d) => Math.max(0, d - DIAS_VISIBLES))} disabled={inicioDias === 0} aria-label="Días anteriores"><Icon name="izquierda" size={16} /></button>
          {dias.map((d, i) => (
            <button key={d} type="button" className={`rv__dia ${fecha === d ? "rv__dia--activo" : ""}`} aria-pressed={fecha === d} aria-label={fechaCorta(d)}
              onClick={() => { setFecha(d); setFranja(""); }} disabled={!sede}>
              <small>{inicioDias + i === 0 ? "Hoy" : diaSemana(d)}</small>
              <strong>{diaMes(d)}</strong>
            </button>
          ))}
          <button type="button" className="rv__flecha" onClick={() => setInicioDias((d) => Math.min(28, d + DIAS_VISIBLES))} disabled={inicioDias >= 28} aria-label="Días siguientes"><Icon name="derecha" size={16} /></button>
        </div>
        <div className="wz__hora-sel" aria-live="polite">
          <Dropdown
            label={`Hora · ${fechaLarga(fecha)}`}
            icon="reloj"
            value={franja}
            placeholder={!sede ? "Primero elige la sede" : cargandoFranjas ? "Buscando horarios…" : franjas.length ? `${franjas.length} horarios disponibles` : "Sin horarios este día"}
            loading={cargandoFranjas}
            disabled={!sede || cargandoFranjas || !franjas.length}
            options={opciones}
            emptyText="No quedan horarios ese día"
            onChange={(v) => setFranja(String(v))}
          />
          {sede && !cargandoFranjas && primera && !franjaSel && (
            <button type="button" className="wz__sugerida" onClick={() => setFranja(String(primera.franja_id))}>
              <Icon name="rayo" size={15} /> Lo más pronto: <strong>{rango(primera)}</strong>
            </button>
          )}
          {sede && !cargandoFranjas && !franjas.length && <p className="rv__nota">No quedan horarios ese día. Prueba con otra fecha.</p>}
          {franjaSel && (
            <p className="wz__hora-elegida"><Icon name="check" size={15} /> {fechaLarga(fecha)} · <strong>{rango(franjaSel)}</strong></p>
          )}
        </div>
        <div className="wz__pie">
          <button type="button" className="btn btn--suave" onClick={atras}>Atrás</button>
          <button type="button" className="btn btn--primario" disabled={!franjaSel} onClick={siguiente}>Continuar</button>
        </div>
      </>
    );
  }

  function vistaConfirmar() {
    const filas = [
      ["Servicio", tramite?.nombre],
      flujo === "ENTREGA" && equipoSel && ["Equipo", `${equipoSel.marca} ${equipoSel.modelo || ""} · ${equipoSel.codigo}`],
      flujo === "GARANTIA" && ["Televisor", `${garantia.marca}${garantia.modelo ? ` ${garantia.modelo}` : ""} · compra ${fechaCorta(garantia.fecha_compra)}`],
      flujo === "RECLAMO" && reclamoCreado && ["Reclamo", reclamoCreado.radicado],
      ["Sede", sedeSel?.nombre],
      ["Cuándo", franjaSel ? `${fechaLarga(fecha)}, ${rango(franjaSel)}` : ""],
      ["A nombre de", nombre.trim()],
      ["Celular", celular],
    ].filter(Boolean);
    return (
      <>
        <h2 className="wz__titulo">Revisa y confirma</h2>
        <dl className="wz__resumen">
          {filas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
        {PREP_CLIENTE[flujo] && (
          <p className="rv__prep" role="note"><Icon name={PREP_CLIENTE[flujo].icono} size={17} /><span><strong>{PREP_CLIENTE[flujo].titulo}</strong> {PREP_CLIENTE[flujo].texto}</span></p>
        )}
        {flujo === "RECLAMO" && reclamoCreado && (
          <p className="rv__prep" role="note"><Icon name="mensaje" size={17} /><span><strong>Tu reclamo {reclamoCreado.radicado} ya está radicado.</strong> El asesor lo tendrá a la mano cuando llegues.</span></p>
        )}
        <div className="wz__pie">
          <button type="button" className="btn btn--suave" onClick={atras}>Atrás</button>
          <button type="button" className="btn btn--primario btn--grande" disabled={ocupado} onClick={confirmar}>
            {ocupado ? "Reservando…" : "Confirmar turno"}
          </button>
        </div>
      </>
    );
  }

  const vistas = {
    tramite: vistaTramite, celular: vistaCelular, equipo: vistaEquipo, garantia: vistaGarantia,
    reclamo: vistaReclamo, horario: vistaHorario, confirmar: vistaConfirmar,
  };

  return (
    <div className="wz">
      <ol className="wz__pasos" aria-label="Pasos de la reserva">
        {pasos.map((p, i) => (
          <li key={p} className={`${i < indice ? "hecho" : ""} ${i === indice ? "actual" : ""}`} aria-current={i === indice ? "step" : undefined}>
            <span>{i < indice ? <Icon name="check" size={12} strokeWidth={3} /> : i + 1}</span>
            <small>{PASOS[p]}</small>
          </li>
        ))}
      </ol>
      <div className="wz__barra" aria-hidden="true"><span style={{ width: `${(indice / Math.max(1, pasos.length - 1)) * 100}%` }} /></div>
      <section key={paso} className={`wz__paso ${direccion < 0 ? "wz__paso--atras" : ""}`}>
        {vistas[paso]()}
      </section>
      {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
    </div>
  );
}
