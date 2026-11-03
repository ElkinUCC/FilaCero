import { useEffect, useMemo, useRef, useState } from "react";
import * as publicoApi from "../../api/publico.api";
import { diaMes, diaSemana, fechaCorta, hoyISO, soloDigitos } from "../../utils/formatters";
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";

const DIAS_VISIBLES = 7;

/**
 * Formulario de reserva en una sola vista.
 * - onResumen(resumen): informa la selección en vivo (para la ficha).
 * - onConfirmado(turno, celular, espera, tokenConsulta): reserva creada.
 */
export default function ReservarTurno({ onResumen, onConfirmado }) {
  const [sedes, setSedes] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);

  const [sede, setSede] = useState("");
  const [tramite, setTramite] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [inicioDias, setInicioDias] = useState(0);
  const [franjas, setFranjas] = useState([]);
  const [franja, setFranja] = useState("");
  const [cargandoFranjas, setCargandoFranjas] = useState(false);

  const [nombre, setNombre] = useState("");
  const [detalleNecesidad, setDetalleNecesidad] = useState("");
  const [respuestasSolicitud, setRespuestasSolicitud] = useState({});
  const [celular, setCelular] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoPrueba, setCodigoPrueba] = useState("");
  const [verificacion, setVerificacion] = useState("");
  const [verificando, setVerificando] = useState(false);

  const [reservando, setReservando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const consultaFranjas = useRef(0);
  const [recarga, setRecarga] = useState(0);

  // ---------------------------------------------------------- catálogo
  useEffect(() => {
    let vigente = true;
    Promise.all([publicoApi.listarSedes(), publicoApi.listarTramites()])
      .then(([s, t]) => {
        if (!vigente) return;
        setSedes(s?.puntos || []);
        setTramites(t?.tramites || []);
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargandoCatalogo(false));
    return () => { vigente = false; };
  }, []);

  // ---------------------------------------------------------- franjas (automático)
  useEffect(() => {
    setFranja("");
    if (!sede || !tramite || !fecha) {
      setFranjas([]);
      return;
    }
    const id = ++consultaFranjas.current;
    setCargandoFranjas(true);
    setAviso("");
    publicoApi.franjasDisponibles({ sedeId: sede, tramiteId: tramite, fecha })
      .then((r) => {
        if (id !== consultaFranjas.current) return;
        const lista = r?.franjas || [];
        setFranjas(lista);
        if (!lista.length) setAviso("No quedan horarios ese día. Prueba con otra fecha.");
      })
      .catch((e) => {
        if (id !== consultaFranjas.current) return;
        setFranjas([]);
        setAviso(e.message);
      })
      .finally(() => id === consultaFranjas.current && setCargandoFranjas(false));
  }, [sede, tramite, fecha, recarga]);

  const sedeSel = sedes.find((s) => String(s.id) === String(sede));
  const tramiteSel = tramites.find((t) => String(t.id) === String(tramite));
  const franjaSel = franjas.find((f) => String(f.franja_id) === String(franja));
  const camposSolicitud = tramiteSel?.campos_solicitud || [];
  const requiereDetalle = Boolean(tramiteSel?.instrucciones_preparacion?.trim());

  function respuestaObligatoriaCompleta(campo) {
    const valor = respuestasSolicitud[campo.id];
    return campo.tipo === "si_no" ? typeof valor === "boolean" : Boolean(String(valor || "").trim());
  }
  const respuestasObligatoriasCompletas = camposSolicitud
    .filter((campo) => campo.obligatorio)
    .every(respuestaObligatoriaCompleta);
  const camposOpcionales = camposSolicitud.filter((campo) => !campo.obligatorio);

  useEffect(() => {
    onResumen?.({
      sede: sedeSel?.nombre,
      direccion: sedeSel?.direccion,
      tramite: tramiteSel?.nombre,
      duracion: tramiteSel?.tiempo_estimado,
      fecha: franjaSel ? fecha : sede && tramite ? fecha : null,
      hora: franjaSel ? `${franjaSel.hora_inicio} – ${franjaSel.hora_fin}` : null,
      nombre: nombre.trim() || null,
    });
  }, [sedeSel, tramiteSel, franjaSel, fecha, sede, tramite, nombre, onResumen]);

  // ---------------------------------------------------------- opciones
  const opcionesSede = sedes.map((s) => ({ value: s.id, label: s.nombre, hint: s.direccion }));
  const opcionesTramite = tramites.map((t) => ({
    value: t.id, label: t.nombre, hint: t.tiempo_estimado ? `${t.tiempo_estimado} min aprox.` : undefined,
  }));
  const opcionesFranja = franjas.map((f) => ({
    value: f.franja_id,
    label: `${f.hora_inicio} – ${f.hora_fin}`,
    hint: f.disponibles === 1 ? "Último cupo" : `${f.disponibles} cupos`,
    group: f.jornada === "tarde" ? "Tarde" : "Mañana",
  }));

  const dias = useMemo(
    () => Array.from({ length: DIAS_VISIBLES }, (_, i) => hoyISO(inicioDias + i)),
    [inicioDias]
  );

  // ---------------------------------------------------------- verificación
  const celularValido = /^3\d{9}$/.test(celular);

  function cambiarCelular(valor) {
    setCelular(soloDigitos(valor, 10));
    setCodigo("");
    setCodigoEnviado(false);
    setCodigoPrueba("");
    setVerificacion("");
  }

  async function enviarCodigo() {
    if (!celularValido) {
      setError("Escribe un celular de 10 dígitos que empiece por 3.");
      return;
    }
    setError("");
    setVerificando(true);
    try {
      const r = await publicoApi.solicitarCodigo(celular);
      setCodigoEnviado(true);
      setCodigoPrueba(r.codigo_prueba || "");
      setCodigo("");
    } catch (e) {
      setError(e.message);
    } finally {
      setVerificando(false);
    }
  }

  async function verificar(valor) {
    setVerificando(true);
    setError("");
    try {
      const r = await publicoApi.verificarCodigo(celular, valor);
      setVerificacion(r.token_verificacion);
      setCodigoEnviado(false);
    } catch (e) {
      setError(e.message);
      setCodigo("");
    } finally {
      setVerificando(false);
    }
  }

  function cambiarCodigo(valor) {
    const limpio = soloDigitos(valor, 6);
    setCodigo(limpio);
    if (limpio.length === 6) verificar(limpio);
  }

  // ---------------------------------------------------------- reservar
  const nombreValido = nombre.trim().split(/\s+/).join(" ").length >= 3;
  const listo = sedeSel && tramiteSel && franjaSel && nombreValido && verificacion
    && respuestasObligatoriasCompletas;

  async function confirmar(e) {
    e.preventDefault();
    if (!listo) return;
    setReservando(true);
    setError("");
    try {
      const r = await publicoApi.reservarTurno({
        nombre: nombre.trim(),
        celular,
        token_verificacion: verificacion,
        punto_id: Number(sede),
        tramite_id: Number(tramite),
        franja_id: Number(franja),
        detalle_necesidad: detalleNecesidad.trim(),
        respuestas_solicitud: respuestasSolicitud,
      });
      onConfirmado?.(r.turno, celular, r.espera, r.token_consulta);
      setSede(""); setTramite(""); setFranja(""); setFecha(hoyISO()); setInicioDias(0);
      setNombre(""); setDetalleNecesidad(""); setRespuestasSolicitud({});
      setCelular(""); setVerificacion(""); setCodigo("");
    } catch (e) {
      setError(e.message);
      if (/cupo|comenzaron/i.test(e.message)) setRecarga((n) => n + 1); // refresca horarios
    } finally {
      setReservando(false);
    }
  }

  const faltante = !sedeSel ? "Elige una sede"
    : !tramiteSel ? "Elige un servicio"
      : !franjaSel ? "Elige un horario"
        : !respuestasObligatoriasCompletas ? "Responde las preguntas obligatorias"
      : !nombreValido ? "Escribe tu nombre"
          : !verificacion ? "Verifica tu celular" : null;

  return (
    <form className="rv" onSubmit={confirmar} noValidate>
      <div className="rv__fila rv__fila--2">
        <Dropdown
          label="Sede"
          icon="pin"
          value={sede}
          options={opcionesSede}
          onChange={(v) => { setSede(String(v)); setError(""); }}
          placeholder="¿Dónde te atendemos?"
          loading={cargandoCatalogo}
          emptyText="No hay sedes disponibles"
        />
        <Dropdown
          label="Servicio"
          icon="servicio"
          value={tramite}
          options={opcionesTramite}
          onChange={(v) => {
            setTramite(String(v));
            setDetalleNecesidad("");
            setRespuestasSolicitud({});
            setError("");
          }}
          placeholder="¿Qué necesitas?"
          loading={cargandoCatalogo}
          emptyText="No hay servicios disponibles"
        />
      </div>

      <fieldset className={`rv__bloque ${sede && tramite ? "" : "rv__bloque--espera"}`} disabled={!sede || !tramite}>
        <legend className="rv__label">Día</legend>
        <div className="rv__dias">
          <button
            type="button"
            className="rv__flecha"
            onClick={() => setInicioDias((d) => Math.max(0, d - DIAS_VISIBLES))}
            disabled={inicioDias === 0}
            aria-label="Días anteriores"
          >
            <Icon name="izquierda" size={16} />
          </button>
          {dias.map((d, i) => {
            const etiqueta = inicioDias + i === 0 ? "Hoy" : diaSemana(d);
            return (
              <button
                key={d}
                type="button"
                className={`rv__dia ${fecha === d ? "rv__dia--activo" : ""}`}
                aria-pressed={fecha === d}
                aria-label={fechaCorta(d)}
                onClick={() => setFecha(d)}
              >
                <small>{etiqueta}</small>
                <strong>{diaMes(d)}</strong>
              </button>
            );
          })}
          <button
            type="button"
            className="rv__flecha"
            onClick={() => setInicioDias((d) => Math.min(28, d + DIAS_VISIBLES))}
            disabled={inicioDias >= 28}
            aria-label="Días siguientes"
          >
            <Icon name="derecha" size={16} />
          </button>
        </div>

        <Dropdown
          label="Hora"
          icon="reloj"
          value={franja}
          options={opcionesFranja}
          onChange={(v) => { setFranja(String(v)); setError(""); }}
          placeholder={
            !sede || !tramite ? "Primero elige sede y servicio"
              : franjas.length ? `${franjas.length} horarios disponibles` : "Sin horarios este día"
          }
          loading={cargandoFranjas}
          disabled={!sede || !tramite || cargandoFranjas || !franjas.length}
        />
        {aviso && !cargandoFranjas && <p className="rv__nota">{aviso}</p>}
      </fieldset>

      {franjaSel && (requiereDetalle || camposSolicitud.length > 0) && (
        <fieldset className="rv__bloque">
          <legend className="rv__label">Información para el asesor</legend>
          {camposSolicitud.filter((campo) => campo.obligatorio).map((campo) => {
            const valor = respuestasSolicitud[campo.id];
            const actualizar = (respuesta) =>
              setRespuestasSolicitud((actual) => ({ ...actual, [campo.id]: respuesta }));
            return (
              <label key={campo.id}>
                <span className="etiqueta">
                  {campo.etiqueta} *
                </span>
                <span className="campo">
                  {campo.tipo === "parrafo" ? (
                    <textarea
                      value={valor || ""}
                      onChange={(e) => actualizar(e.target.value)}
                      maxLength={1000}
                      rows={2}
                    />
                  ) : campo.tipo === "seleccion" ? (
                    <select value={valor || ""} onChange={(e) => actualizar(e.target.value)}>
                      <option value="">Elige una opción</option>
                      {campo.opciones.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                    </select>
                  ) : campo.tipo === "si_no" ? (
                    <select
                      value={typeof valor === "boolean" ? String(valor) : ""}
                      onChange={(e) => actualizar(e.target.value === "" ? null : e.target.value === "true")}
                    >
                      <option value="">Elige una opción</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <input
                      value={valor || ""}
                      onChange={(e) => actualizar(e.target.value)}
                      maxLength={150}
                    />
                  )}
                </span>
              </label>
            );
          })}
          {(requiereDetalle || camposOpcionales.length > 0) && (
            <details className="rv__opcionales">
              <summary>Agregar información opcional</summary>
              {requiereDetalle && (
                <>
                  <p className="rv__nota">{tramiteSel.instrucciones_preparacion}</p>
                  <label>
                    <span className="etiqueta">Cuéntanos brevemente qué necesitas</span>
                    <span className="campo">
                      <textarea
                        value={detalleNecesidad}
                        onChange={(e) => setDetalleNecesidad(e.target.value)}
                        maxLength={1000}
                        rows={2}
                        placeholder="Así el asesor puede prepararse para atenderte."
                      />
                    </span>
                  </label>
                </>
              )}
              {camposOpcionales.map((campo) => {
                const valor = respuestasSolicitud[campo.id];
                const actualizar = (respuesta) =>
                  setRespuestasSolicitud((actual) => ({ ...actual, [campo.id]: respuesta }));
                return (
                  <label key={campo.id}>
                    <span className="etiqueta">{campo.etiqueta} (opcional)</span>
                    <span className="campo">
                      {campo.tipo === "parrafo" ? (
                        <textarea value={valor || ""} onChange={(e) => actualizar(e.target.value)} maxLength={1000} rows={2} />
                      ) : campo.tipo === "seleccion" ? (
                        <select value={valor || ""} onChange={(e) => actualizar(e.target.value)}>
                          <option value="">Elige una opción</option>
                          {campo.opciones.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                        </select>
                      ) : campo.tipo === "si_no" ? (
                        <select
                          value={typeof valor === "boolean" ? String(valor) : ""}
                          onChange={(e) => actualizar(e.target.value === "" ? null : e.target.value === "true")}
                        >
                          <option value="">Elige una opción</option>
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input value={valor || ""} onChange={(e) => actualizar(e.target.value)} maxLength={150} />
                      )}
                    </span>
                  </label>
                );
              })}
            </details>
          )}
        </fieldset>
      )}

      <fieldset className={`rv__bloque ${franjaSel ? "" : "rv__bloque--espera"}`} disabled={!franjaSel}>
        <legend className="rv__label">Tus datos</legend>
        <div className="rv__fila rv__fila--2">
          <label className="campo">
            <Icon name="usuario" size={17} />
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre completo"
              autoComplete="name"
              maxLength={100}
              aria-label="Nombre completo"
            />
          </label>
          <div className={`campo campo--accion ${verificacion ? "campo--ok" : ""}`}>
            <Icon name="celular" size={17} />
            <input
              type="tel"
              inputMode="numeric"
              value={celular}
              onChange={(e) => cambiarCelular(e.target.value)}
              placeholder="Celular"
              autoComplete="tel-national"
              aria-label="Número de celular"
            />
            {verificacion ? (
              <span className="campo__ok"><Icon name="check" size={15} /> Verificado</span>
            ) : (
              <button
                type="button"
                className="campo__boton"
                onClick={enviarCodigo}
                disabled={!celularValido || verificando}
              >
                {codigoEnviado ? "Reenviar" : "Enviar código"}
              </button>
            )}
          </div>
        </div>

        {codigoEnviado && !verificacion && (
          <div className="rv__codigo">
            <label className="campo campo--codigo">
              <Icon name="llave" size={17} />
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigo}
                onChange={(e) => cambiarCodigo(e.target.value)}
                placeholder="Código de 6 dígitos"
                aria-label="Código de verificación"
                disabled={verificando}
              />
            </label>
            <p className="rv__nota">
              {verificando ? "Verificando…" : codigoPrueba ? (
                <>Modo prueba: tu código es <button type="button" className="enlace" onClick={() => cambiarCodigo(codigoPrueba)}>{codigoPrueba}</button></>
              ) : `Te enviamos un SMS al ${celular}.`}
            </p>
          </div>
        )}
      </fieldset>

      {error && (
        <p className="rv__error" role="alert">
          <Icon name="alerta" size={16} /> {error}
        </p>
      )}

      <div className="rv__pie">
        <span className="rv__estado">{faltante || "Todo listo"}</span>
        <button type="submit" className="btn btn--primario" disabled={!listo || reservando}>
          {reservando ? "Reservando…" : "Confirmar turno"}
        </button>
      </div>
    </form>
  );
}
