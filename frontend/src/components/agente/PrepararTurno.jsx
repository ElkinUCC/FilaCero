import { useState } from "react";
import * as agenteApi from "../../api/agente.api";
import { codigoTurno, fechaCorta, PREPARACION, textoPreparacion, valorRespuesta } from "../../utils/formatters";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";

const DETALLES = {
  ENTREGA: {
    EN_PREPARACION: "Lo estoy probando y empacando.",
    LISTO: "Probado y empacado: solo verificar cédula y entregar.",
    NOVEDAD: "Falta algo: avisa antes de que se desplace.",
  },
  GARANTIA: {
    EN_PREPARACION: "Estoy revisando la compra y la cobertura.",
    LISTO: "Cobertura verificada: al llegar se recibe el televisor.",
    NOVEDAD: "Algo no cuadra: avisa antes de que se desplace.",
  },
};
const OPCIONES = [
  { estado: "EN_PREPARACION", icono: "reloj" },
  { estado: "LISTO", icono: "check" },
  { estado: "NOVEDAD", icono: "alerta" },
  { estado: "PENDIENTE", icono: "deshacer", detalle: "Deshacer y dejarlo sin preparar." },
];

/** Mensaje sugerido para el ciudadano según el tipo de atención. */
const SUGERENCIAS = {
  ENTREGA: {
    LISTO: "Tu televisor ya fue probado y está empacado. Trae tu cédula para recibirlo.",
    NOVEDAD: "Falta un repuesto para terminar. Te contactaremos para reprogramar la entrega.",
  },
  GARANTIA: {
    LISTO: "Tu garantía está vigente. Trae el televisor, la factura y tu cédula.",
    NOVEDAD: "No encontramos la compra con esos datos. Trae la factura original.",
  },
};

/**
 * Preparación previa del turno: el asesor alista lo que el ciudadano pidió
 * (equipo, garantía, factura…) para que la atención en el módulo sea mínima.
 * El mensaje lo verá el ciudadano al consultar su turno.
 */
export default function PrepararTurno({ turno, onCerrar, onListo }) {
  const flujo = turno.tramite_flujo === "GARANTIA" ? "GARANTIA" : "ENTREGA";
  const actual = turno.preparacion?.estado || "PENDIENTE";
  const [estado, setEstado] = useState(actual === "PENDIENTE" ? "EN_PREPARACION" : actual);
  const [nota, setNota] = useState(turno.preparacion?.nota || "");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");

  async function guardar(e) {
    e.preventDefault();
    if (estado === "NOVEDAD" && !nota.trim()) return setError("Describe la novedad para avisarle al ciudadano.");
    setOcupado(true);
    setError("");
    try {
      const r = await agenteApi.preparar(turno.id, estado, estado === "PENDIENTE" ? "" : nota.trim());
      onListo(r);
    } catch (err) {
      setError(err.message);
      setOcupado(false);
    }
  }

  function elegir(nuevo) {
    setEstado(nuevo);
    const sugerida = SUGERENCIAS[flujo][nuevo];
    if (sugerida && (!nota.trim() || Object.values(SUGERENCIAS[flujo]).includes(nota))) setNota(sugerida);
  }

  return (
    <Modal
      titulo={`${flujo === "GARANTIA" ? "Revisar la garantía" : "Alistar el equipo"} de ${turno.usuario_nombre}`}
      descripcion={`Turno ${codigoTurno(turno)} · ${turno.tramite_nombre} · ${turno.es_hoy === false ? fechaCorta(turno.fecha) : "hoy"} ${turno.hora_inicio}`}
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <button type="button" className="btn btn--suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-preparar" className="btn btn--primario" disabled={ocupado}>
            {ocupado ? "Guardando…" : "Guardar preparación"}
          </button>
        </>
      }
    >
      <form id="form-preparar" className="formulario" onSubmit={guardar}>
        {turno.equipo && (
          <section className="puesto__equipo" aria-label="Equipo">
            <span className="puesto__equipo-icono"><Icon name="tv" size={18} /></span>
            <div>
              <strong>{turno.equipo.marca} {turno.equipo.modelo}</strong>
              <small><span className="mono">{turno.equipo.codigo}</span>{turno.equipo.falla ? ` · ${turno.equipo.falla}` : ""}</small>
            </div>
          </section>
        )}
        {turno.equipo ? null : (turno.respuestas_solicitud?.length > 0 || turno.detalle_necesidad) ? (
          <section className="puesto__necesidad" aria-label="Lo que pidió el ciudadano">
            <strong>Lo que pidió al reservar</strong>
            <dl>
              {(turno.respuestas_solicitud || []).map((r) => (
                <div key={r.id}><dt>{r.etiqueta}</dt><dd>{valorRespuesta(r.valor)}</dd></div>
              ))}
              {turno.detalle_necesidad && <div><dt>Necesidad</dt><dd>{turno.detalle_necesidad}</dd></div>}
            </dl>
          </section>
        ) : (
          <p className="tenue">El ciudadano no dejó respuestas adicionales; prepara según el trámite.</p>
        )}

        <div className="preparar__opciones" role="radiogroup" aria-label="Estado de la preparación">
          {OPCIONES.map((o) => (
            <button
              key={o.estado}
              type="button"
              role="radio"
              aria-checked={estado === o.estado}
              className={`preparar__opcion preparar__opcion--${PREPARACION[o.estado].tono} ${estado === o.estado ? "activo" : ""}`}
              onClick={() => elegir(o.estado)}
            >
              <Icon name={o.icono} size={18} />
              <span><strong>{o.estado === "PENDIENTE" ? "Pendiente" : textoPreparacion(flujo, o.estado)}</strong><small>{o.detalle || DETALLES[flujo][o.estado]}</small></span>
            </button>
          ))}
        </div>

        {estado !== "PENDIENTE" && (
          <label>
            <span className="etiqueta">Mensaje para el ciudadano {estado === "NOVEDAD" ? "(obligatorio)" : "(opcional)"}</span>
            <span className="campo">
              <textarea rows={3} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Tu televisor ya fue probado y está empacado." />
            </span>
            <small className="formulario__ayuda">{nota.length}/500 · Lo verá al consultar su turno con el código.</small>
          </label>
        )}
        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      </form>
    </Modal>
  );
}

/** Insignia corta de preparación para la cola y el puesto. */
export function InsigniaPreparacion({ preparacion, flujo }) {
  if (!preparacion) return null;
  const p = PREPARACION[preparacion.estado];
  if (!p) return null;
  return (
    <span className={`prep prep--${p.tono}`}>
      <Icon name={flujo === "GARANTIA" ? "escudo2" : "paquete"} size={12} /> {flujo ? textoPreparacion(flujo, preparacion.estado) : p.corto}
    </span>
  );
}
