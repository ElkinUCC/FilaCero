import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelarTurno,
  consultarTurno,
  consultarTurnosPorCelular,
  misEquipos,
  misReclamos,
  solicitarCodigo,
  verificarCodigo,
} from "../../api/publico.api";
import { anunciar } from "../../hooks/useAccesibilidad";
import Icon from "../ui/Icon";
import {
  codigoTurno, ESTADOS, ESTADOS_EQUIPO, ESTADOS_RECLAMO, fechaCorta, fechaHora, fechaLarga, FLUJOS_CON_PREPARACION,
  PREPARACION, soloDigitos,
} from "../../utils/formatters";

/**
 * Lo que ve el ciudadano sobre la preparación previa. Solo aplica a la entrega
 * de un equipo reparado y a la garantía; los demás servicios no la muestran.
 */
const TEXTO_PREPARACION = {
  ENTREGA: {
    PENDIENTE: "Alistaremos tu equipo antes de que llegues.",
    EN_PREPARACION: "Estamos probando y empacando tu equipo.",
    LISTO: "¡Tu equipo está listo! Trae tu cédula para recibirlo.",
    NOVEDAD: "Hay una novedad con tu equipo. Revisa el mensaje antes de ir.",
  },
  GARANTIA: {
    PENDIENTE: "Revisaremos tu garantía antes de que llegues.",
    EN_PREPARACION: "Estamos revisando tu garantía.",
    LISTO: "Garantía revisada. Trae el televisor, la factura y tu cédula.",
    NOVEDAD: "Hay una novedad con tu garantía. Revisa el mensaje antes de ir.",
  },
};

const MENSAJES = {
  ESPERANDO: "Te llamaremos en la sede. Llega unos minutos antes de tu hora.",
  LLAMADO: "¡Es tu turno! Acércate al punto de atención.",
  EN_ATENCION: "Estás siendo atendido.",
  ATENDIDO: "Tu atención finalizó. Gracias por usar FilaCero.",
  CANCELADO: "Este turno fue cancelado.",
  NO_ASISTIO: "El turno se cerró porque no te presentaste al ser llamado.",
};

export default function ConsultarTurno({ inicial, onResultado }) {
  const [modoConsulta, setModoConsulta] = useState("codigo");
  const [turnosEncontrados, setTurnosEncontrados] = useState([]);
  const [misDatos, setMisDatos] = useState({ equipos: [], reclamos: [] });
  const [codigo, setCodigo] = useState(inicial?.codigo || "");
  const [celular, setCelular] = useState(inicial?.celular || "");
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [tokenConsulta, setTokenConsulta] = useState(inicial?.token_verificacion || "");
  const [codigoConsulta, setCodigoConsulta] = useState("");
  const [codigoPruebaConsulta, setCodigoPruebaConsulta] = useState("");
  const [consultaEnviada, setConsultaEnviada] = useState(false);
  const [codigoCancelacion, setCodigoCancelacion] = useState("");
  const [codigoPruebaCancelacion, setCodigoPruebaCancelacion] = useState("");
  const [cancelacionEnviada, setCancelacionEnviada] = useState(false);
  const [error, setError] = useState("");
  // "Por código" no pide celular: el SMS llega al celular registrado en el turno.
  const [celularMasc, setCelularMasc] = useState("");
  const [tokenCelular, setTokenCelular] = useState("");
  const porCodigo = modoConsulta === "codigo";
  const celularDe = () => (porCodigo ? (inicial?.codigo === codigo ? celular : "") : celular);

  const consultar = useCallback(async (
    silencioso = false,
    c = codigo,
    cel = celular,
    token = tokenConsulta
  ) => {
    if (modoConsulta === "codigo" ? !c.trim() : !/^3\d{9}$/.test(cel)) {
      if (!silencioso) setError(modoConsulta === "codigo" ? "Escribe el código de tu turno (TU-…)." : "Escribe el celular de la reserva.");
      return;
    }
    if (!token) {
      if (silencioso || consultaEnviada) return;
      setCargando(true);
      setError("");
      try {
        const r = modoConsulta === "codigo" ? await solicitarCodigo(cel || null, c.trim()) : await solicitarCodigo(cel);
        setCelularMasc(r.celular_enmascarado || cel);
        setCodigoConsulta("");
        setCodigoPruebaConsulta(r.codigo_prueba || "");
        setConsultaEnviada(true);
      } catch (e) {
        setError(e.message);
      } finally {
        setCargando(false);
      }
      return;
    }
    if (!silencioso) { setCargando(true); setError(""); }
    try {
      const r = await consultarTurno(c.trim(), modoConsulta === "codigo" && !inicial?.celular ? "" : cel, token);
      setResultado(r);
      onResultado?.(r.turno);
    } catch (e) {
      if (silencioso) {
        if (e.status === 400) {
          setTokenConsulta("");
          setError("La verificación expiró. Verifica tu celular nuevamente para consultar.");
        }
      } else {
        if (e.status === 400) setTokenConsulta("");
        setResultado(null);
        onResultado?.(null);
        setError(e.message);
      }
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [codigo, celular, tokenConsulta, consultaEnviada, onResultado, modoConsulta]);

  // Consulta inmediata cuando viene de una reserva recién hecha.
  useEffect(() => {
    if (inicial?.codigo && inicial?.celular) {
      setCodigo(inicial.codigo);
      setCelular(inicial.celular);
      setTokenConsulta(inicial.token_verificacion || "");
      if (inicial.token_verificacion) {
        consultar(false, inicial.codigo, inicial.celular, inicial.token_verificacion);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial]);

  // Actualización automática mientras el turno siga activo.
  const activo = ["ESPERANDO", "LLAMADO", "EN_ATENCION"].includes(resultado?.turno?.estado);
  useEffect(() => {
    if (!activo || !tokenConsulta) return undefined;
    const t = window.setInterval(() => consultar(true), 20000);
    return () => window.clearInterval(t);
  }, [activo, consultar, tokenConsulta]);

  function cambiarModo(modo) {
    setModoConsulta(modo);
    setTokenConsulta("");
    setTokenCelular("");
    setConsultaEnviada(false);
    setCodigoConsulta("");
    setError("");
    setTurnosEncontrados([]);
    setMisDatos({ equipos: [], reclamos: [] });
    setResultado(null);
    setDesdeLista(false);
    onResultado?.(null);
  }

  function cambiarCodigoTurno(valor) {
    setCodigo(valor.toUpperCase().slice(0, 30));
    setTokenConsulta("");
    setConsultaEnviada(false);
    setCodigoConsulta("");
    setResultado(null);
    setTurnosEncontrados([]);
    setMisDatos({ equipos: [], reclamos: [] });
    onResultado?.(null);
  }

  function cambiarCelularTurno(valor) {
    setCelular(soloDigitos(valor, 10));
    setTokenConsulta("");
    setConsultaEnviada(false);
    setCodigoConsulta("");
    setResultado(null);
    setTurnosEncontrados([]);
    setMisDatos({ equipos: [], reclamos: [] });
    onResultado?.(null);
  }

  async function verificarConsulta() {
    setCargando(true);
    setError("");
    try {
      const verificacion = await verificarCodigo(
        celularDe(),
        codigoConsulta,
        modoConsulta === "codigo" ? "consulta" : "consulta_celular",
        modoConsulta === "codigo" ? codigo.trim() : undefined
      );
      const token = verificacion.token_verificacion;
      setConsultaEnviada(false);
      setCodigoConsulta("");
      if (modoConsulta === "celular") {
        const [r, eq, rc] = await Promise.all([
          consultarTurnosPorCelular(celular, token),
          misEquipos(celular, token).catch(() => null),
          misReclamos(celular, token).catch(() => null),
        ]);
        setTokenCelular(token);
        setTurnosEncontrados(r.turnos || []);
        setMisDatos({ equipos: eq?.equipos || [], reclamos: rc?.reclamos || [] });
        setPestanaCel(r.turnos?.length ? "turnos" : eq?.equipos?.length ? "equipos" : "reclamos");
        setDesdeLista(false);
        setResultado(null);
        setTokenConsulta("");
        onResultado?.(null);
        if (!r.turnos?.length && !eq?.equipos?.length && !rc?.reclamos?.length) {
          setError("No encontramos turnos, equipos ni reclamos asociados a ese celular.");
        }
      } else {
        setTokenConsulta(token);
        const r = await consultarTurno(codigo.trim(), celularDe(), token);
        setResultado(r);
        onResultado?.(r.turno);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function enviarCodigoCancelacion() {
    setCargando(true);
    setError("");
    try {
      const r = await solicitarCodigo(celularDe() || null, codigo.trim());
      setCelularMasc(r.celular_enmascarado || celular);
      setCodigoPruebaCancelacion(r.codigo_prueba || "");
      setCodigoCancelacion("");
      setCancelacionEnviada(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function cancelar() {
    setCargando(true);
    setError("");
    try {
      const verificacion = await verificarCodigo(
        celularDe(),
        codigoCancelacion,
        "cancelacion",
        codigo.trim()
      );
      const r = await cancelarTurno(
        codigo.trim(),
        celularDe(),
        verificacion.token_verificacion
      );
      setResultado({ turno: r.turno, espera: null });
      onResultado?.(r.turno);
      setConfirmarCancelar(false);
      setCancelacionEnviada(false);
      setCodigoCancelacion("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  // Consulta por celular: se ve una lista a la vez (turnos, equipos o reclamos)
  // y al elegir un turno su detalle reemplaza la lista, arriba, sin desplazarse.
  const [pestanaCel, setPestanaCel] = useState("turnos");
  const [desdeLista, setDesdeLista] = useState(false);
  const detalleRef = useRef(null);
  const verificadoCelular = Boolean(tokenCelular) && modoConsulta === "celular";

  function abrirTurnoDeLista(item) {
    setCodigo(item.turno.codigo);
    setResultado(item);
    setTokenConsulta("");
    setConfirmarCancelar(false);
    setDesdeLista(true);
    onResultado?.(item.turno);
  }
  function volverALista() {
    setResultado(null);
    setDesdeLista(false);
    setConfirmarCancelar(false);
    onResultado?.(null);
  }
  useEffect(() => {
    if (desdeLista && resultado && detalleRef.current) {
      detalleRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      detalleRef.current.focus({ preventScroll: true });
    }
  }, [desdeLista, resultado]);

  const turno = resultado?.turno;

  // Cuando el asesor llama el turno se avisa en pantalla (y al lector de pantalla).
  const [estadoPrevio, setEstadoPrevio] = useState(null);
  if (turno && turno.estado !== estadoPrevio) {
    if (estadoPrevio && turno.estado === "LLAMADO") {
      anunciar(`${turno.nombre ? `${turno.nombre.split(" ")[0]}, tu` : "Tu"} turno fue llamado. Acércate al punto de atención.`);
    }
    setEstadoPrevio(turno.estado);
  }
  const espera = resultado?.espera;
  const estado = ESTADOS[turno?.estado] || {};

  return (
    <div className="ct">
      {!(desdeLista && turno) && (
        <>
          <div className="ct__modos" role="group" aria-label="Método de consulta">
            <button type="button" aria-pressed={porCodigo} className={porCodigo ? "activo" : ""} onClick={() => cambiarModo("codigo")}>
              <Icon name="ficha" size={15} /> Por código
            </button>
            <button type="button" aria-pressed={!porCodigo} className={!porCodigo ? "activo" : ""} onClick={() => cambiarModo("celular")}>
              <Icon name="celular" size={15} /> Por celular
            </button>
          </div>
          {verificadoCelular ? (
            <div className="ct__verificado">
              <span><Icon name="check" size={15} /> Celular <b>{celularMasc || celular}</b> verificado</span>
              <button type="button" className="enlace" onClick={() => cambiarModo("celular")}>Cambiar</button>
            </div>
          ) : (
          <form className="rv__fila ct__form" onSubmit={(e) => { e.preventDefault(); consultar(); }}>
            {modoConsulta === "codigo" && <label className="campo">
              <Icon name="ficha" size={17} />
              <input
                value={codigo}
                onChange={(e) => cambiarCodigoTurno(e.target.value)}
                placeholder="Código del turno (TU-…)"
                aria-label="Código del turno"
              />
            </label>}
            {modoConsulta === "celular" && <label className="campo">
              <Icon name="celular" size={17} />
              <input
                type="tel"
                inputMode="numeric"
                value={celular}
                onChange={(e) => cambiarCelularTurno(e.target.value)}
                placeholder="Celular de la reserva"
                aria-label="Celular de la reserva"
              />
            </label>}
            <button className="btn btn--primario" disabled={cargando || consultaEnviada}>
              {cargando ? "Procesando…" : tokenConsulta ? "Consultar" : "Enviar código"}
            </button>
          </form>
          )}
        </>
      )}

      {consultaEnviada && (
        <div className="rv__codigo">
          <label className="campo campo--codigo">
            <Icon name="llave" size={17} />
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigoConsulta}
              onChange={(e) => setCodigoConsulta(soloDigitos(e.target.value, 6))}
              placeholder="Código de 6 dígitos"
              aria-label="Código para consultar el turno"
              disabled={cargando}
            />
          </label>
          <p className="rv__nota">
            {codigoPruebaConsulta ? (
              <>Modo prueba: tu código es <button type="button" className="enlace" onClick={() => setCodigoConsulta(codigoPruebaConsulta)}>{codigoPruebaConsulta}</button></>
            ) : `Te enviamos un SMS al ${celularMasc || celular}.`}
          </p>
          <button
            type="button"
            className="btn btn--primario"
            onClick={verificarConsulta}
            disabled={cargando || codigoConsulta.length !== 6}
          >
            Verificar y consultar
          </button>
        </div>
      )}

      {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}

      {verificadoCelular && !desdeLista && (turnosEncontrados.length > 0 || misDatos.equipos.length > 0 || misDatos.reclamos.length > 0) && (
        <section className="ct__cel" aria-label="Lo que tienes con nosotros">
          <div className="ct__pestanas" role="tablist" aria-label="Tus registros">
            {[
              ["turnos", "Turnos", "calendario", turnosEncontrados.length],
              ["equipos", "Equipos", "tv", misDatos.equipos.length],
              ["reclamos", "Reclamos", "mensaje", misDatos.reclamos.length],
            ].map(([id, texto, icono, n]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestanaCel === id}
                className={pestanaCel === id ? "activa" : ""}
                onClick={() => setPestanaCel(id)}
              >
                <Icon name={icono} size={15} /> {texto} <small>{n}</small>
              </button>
            ))}
          </div>

          {pestanaCel === "turnos" && (
            <div className="ct__lista-turnos" role="tabpanel">
              {turnosEncontrados.length === 0 && <p className="ct__vacio">No tienes turnos con este celular.</p>}
              {turnosEncontrados.map((item) => {
                const est = ESTADOS[item.turno.estado] || {};
                return (
                  <button type="button" className="ct__turno-encontrado" key={item.turno.codigo} onClick={() => abrirTurnoDeLista(item)}>
                    <span className="ct__turno-fecha">
                      <strong>{item.turno.hora_inicio}</strong>
                      <small>{fechaCorta(item.turno.fecha)}</small>
                    </span>
                    <span className="ct__turno-info">
                      <strong>{item.turno.tramite}</strong>
                      <small><span className="mono">{codigoTurno(item.turno)}</span> · {item.turno.sede}</small>
                    </span>
                    <span className={`estado estado--${est.tono}`}>{est.texto || item.turno.estado}</span>
                    <Icon name="derecha" size={16} className="ct__turno-flecha" />
                  </button>
                );
              })}
            </div>
          )}

          {pestanaCel === "equipos" && (
            <div className="ct__lista-turnos" role="tabpanel">
              {misDatos.equipos.length === 0 && <p className="ct__vacio">No tienes equipos registrados con nosotros.</p>}
              {misDatos.equipos.map((e) => {
                const est = ESTADOS_EQUIPO[e.estado] || {};
                return (
                  <div className="ct__equipo" key={e.codigo}>
                    <span className="ct__equipo-icono"><Icon name="tv" size={20} /></span>
                    <div>
                      <strong>{e.marca} {e.modelo}</strong>
                      <small><span className="mono">{e.codigo}</span> · {e.sede}{e.origen === "GARANTIA" ? " · Garantía" : ""}</small>
                      <span className="wz__progreso" aria-hidden="true">{[1, 2, 3].map((k) => <i key={k} className={est.paso >= k ? "hecho" : ""} />)}</span>
                      {e.nota && <small className="ct__nota">{e.nota}</small>}
                    </div>
                    <span className={`estado estado--${est.tono}`}>{est.texto}</span>
                  </div>
                );
              })}
            </div>
          )}

          {pestanaCel === "reclamos" && (
            <div className="ct__lista-turnos" role="tabpanel">
              {misDatos.reclamos.length === 0 && <p className="ct__vacio">No tienes reclamos radicados.</p>}
              {misDatos.reclamos.map((r) => {
                const est = ESTADOS_RECLAMO[r.estado] || {};
                const ultima = [...(r.mensajes || [])].reverse().find((m) => m.autor === "ASESOR");
                return (
                  <article className="ct__reclamo" key={r.radicado}>
                    <header>
                      <span><strong className="mono">{r.radicado}</strong><small>{r.categoria_texto} · {fechaHora(r.fecha)}</small></span>
                      <span className={`estado estado--${est.tono}`}>{est.texto}</span>
                    </header>
                    <p className="ct__reclamo-texto">{r.descripcion}</p>
                    {ultima ? (
                      <p className="ct__respuesta"><Icon name="check" size={15} /><span><b>{ultima.autor_nombre || "Asesor"}:</b> {ultima.texto}</span></p>
                    ) : (
                      <p className="ct__nota">Un asesor de {r.sede} lo revisará y te contactará por este medio o en la sede.</p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {desdeLista && turno && (
        <button type="button" className="ct__volver" onClick={volverALista}>
          <Icon name="izquierda" size={16} /> Volver a mis turnos
        </button>
      )}

      {!turno && !error && turnosEncontrados.length === 0 && misDatos.equipos.length === 0 && misDatos.reclamos.length === 0 && (
        <p className="ct__ayuda">
          {modoConsulta === "codigo" ? "Escribe el código de tu turno (TU-…). Te enviaremos un SMS al celular con el que reservaste." : "Ingresa tu celular registrado. Te enviaremos un SMS y mostraremos tus turnos, equipos y reclamos después de verificarlo."}
        </p>
      )}

      {turno && (
        <section ref={detalleRef} tabIndex={-1} className={`ct__resultado tono-${estado.tono}`} aria-live="polite">
          <header className="ct__cabeza">
            <div>
              <span className="ct__codigo">{codigoTurno(turno)}</span>
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

          {turno.equipo && (
            <div className="ct__equipo">
              <span className="ct__equipo-icono"><Icon name="tv" size={20} /></span>
              <div>
                <strong>{turno.equipo.marca} {turno.equipo.modelo}</strong>
                <small><span className="mono">{turno.equipo.codigo}</span> · {ESTADOS_EQUIPO[turno.equipo.estado]?.texto}</small>
              </div>
            </div>
          )}
          {turno.reclamo && (
            <p className="ct__nota"><Icon name="mensaje" size={14} /> Reclamo <span className="mono">{turno.reclamo.radicado}</span> · {turno.reclamo.estado_texto}. El asesor lo tendrá a la mano.</p>
          )}
          {turno.preparacion && FLUJOS_CON_PREPARACION.includes(turno.tramite_flujo)
            && ["ESPERANDO", "LLAMADO", "EN_ATENCION"].includes(turno.estado) && (
            <div className={`ct__prep ct__prep--${PREPARACION[turno.preparacion.estado]?.tono}`} role="status">
              <Icon name={turno.tramite_flujo === "GARANTIA" ? "escudo2" : "paquete"} size={20} />
              <div>
                <strong>{TEXTO_PREPARACION[turno.tramite_flujo][turno.preparacion.estado]}</strong>
                {turno.preparacion.nota && <p>{turno.preparacion.nota}</p>}
              </div>
            </div>
          )}

          <dl className="ct__datos">
            <div><dt>Sede</dt><dd>{turno.sede}{turno.direccion ? ` · ${turno.direccion}` : ""}</dd></div>
            <div><dt>Servicio</dt><dd>{turno.tramite}</dd></div>
            <div><dt>A nombre de</dt><dd>{turno.nombre} ({turno.celular})</dd></div>
          </dl>

          {turno.estado === "ESPERANDO" && (
            <div className="ct__acciones">
              {confirmarCancelar ? (
                <>
                  {cancelacionEnviada ? (
                    <>
                      <span>Ingresa el código enviado a tu celular para cancelar.</span>
                      <label className="campo campo--codigo">
                        <Icon name="llave" size={17} />
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={codigoCancelacion}
                          onChange={(e) => setCodigoCancelacion(soloDigitos(e.target.value, 6))}
                          placeholder="Código de 6 dígitos"
                          aria-label="Código para cancelar el turno"
                          disabled={cargando}
                        />
                      </label>
                      {codigoPruebaCancelacion && (
                        <p className="rv__nota">
                          Modo prueba: tu código es{" "}
                          <button
                            type="button"
                            className="enlace"
                            onClick={() => setCodigoCancelacion(codigoPruebaCancelacion)}
                          >
                            {codigoPruebaCancelacion}
                          </button>
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn btn--peligro"
                        onClick={cancelar}
                        disabled={cargando || codigoCancelacion.length !== 6}
                      >
                        Verificar y cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <span>Verifica tu celular para liberar el cupo.</span>
                      <button
                        type="button"
                        className="btn btn--peligro"
                        onClick={enviarCodigoCancelacion}
                        disabled={cargando}
                      >
                        Enviar código
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="btn btn--suave"
                    onClick={() => {
                      setConfirmarCancelar(false);
                      setCancelacionEnviada(false);
                      setCodigoCancelacion("");
                    }}
                  >
                    No
                  </button>
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
