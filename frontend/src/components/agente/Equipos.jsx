import { useMemo, useState } from "react";
import * as agenteApi from "../../api/agente.api";
import { useToast } from "../../hooks/useToast";
import usePolling from "../../hooks/usePolling";
import { ESTADOS_EQUIPO, fechaHora, haceTiempo } from "../../utils/formatters";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";
import FormularioEquipo from "./FormularioEquipo";
import VerificarCedula from "./VerificarCedula";

/** Pasos que exigen la cédula del titular (entregar o recibir en sede). */
const CON_CEDULA = ["ENTREGADO", "RECIBIDO"];

/** Columnas del tablero del taller (de izquierda a derecha avanza el equipo). */
const COLUMNAS = [
  { id: "RECIBIR", titulo: "Por revisar", estados: ["POR_RECIBIR", "RECIBIDO"] },
  { id: "EN_REPARACION", titulo: "En reparación", estados: ["EN_REPARACION"] },
  { id: "LISTO", titulo: "Listos para entregar", estados: ["LISTO"] },
  { id: "ENTREGADO", titulo: "Entregados", estados: ["ENTREGADO"] },
];
const SIGUIENTE = {
  POR_RECIBIR: ["RECIBIDO", "Recibir"],
  RECIBIDO: ["EN_REPARACION", "A reparación"],
  EN_REPARACION: ["LISTO", "Marcar listo"],
  LISTO: ["ENTREGADO", "Entregar"],
};

/**
 * Taller de la sede: los equipos de los clientes avanzan por columnas. Cuando
 * un equipo queda "Listo", el cliente lo ve al consultar con su celular y puede
 * reservar la entrega eligiendo ese equipo.
 */
export default function Equipos() {
  const avisar = useToast();
  const [buscar, setBuscar] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [moviendo, setMoviendo] = useState(null);
  const [cedula, setCedula] = useState(null);
  const { datos, error, refrescar, setDatos } = usePolling(() => agenteApi.listarEquipos(), 15000);

  const equipos = useMemo(() => {
    const f = buscar.trim().toLowerCase();
    return (datos?.equipos || []).filter((e) =>
      !f || `${e.codigo} ${e.marca} ${e.modelo || ""} ${e.cliente_nombre} ${e.cliente_celular} ${e.serial || ""}`.toLowerCase().includes(f)
        || (f.replace(/\D/g, "").length >= 4 && (e.cliente_documento || "").endsWith(f.replace(/\D/g, "").slice(-4))));
  }, [datos, buscar]);

  async function mover(equipo, estado, nota) {
    if (CON_CEDULA.includes(estado) && equipo.estado !== estado) {
      setCedula({ equipo, estado });
      return;
    }
    setMoviendo(equipo.id);
    // Optimista: la tarjeta salta de columna de inmediato.
    setDatos((d) => ({ ...d, equipos: d.equipos.map((x) => (x.id === equipo.id ? { ...x, estado, recien: true } : x)) }));
    try {
      const r = await agenteApi.cambiarEstadoEquipo(equipo.id, estado, nota);
      avisar(r.mensaje);
      if (detalle?.id === equipo.id) setDetalle(r.equipo);
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setMoviendo(null);
      refrescar();
    }
  }

  return (
    <section className="taller" aria-label="Equipos de clientes">
      <header className="taller__cabeza">
        <div>
          <h2>Equipos de clientes</h2>
          <p>Lo que los clientes dejan en la sede. Al marcarlo listo, el cliente puede reservar su entrega.</p>
        </div>
        <div className="taller__acciones">
          <label className="campo campo--buscar">
            <Icon name="buscar" size={16} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Cliente, celular, cédula, marca o EQ-" aria-label="Buscar equipo" />
          </label>
          <button type="button" className="btn btn--primario" onClick={() => setNuevo(true)}><Icon name="mas" size={17} /> Recibir equipo</button>
        </div>
      </header>
      {error && <p className="ag__aviso"><Icon name="alerta" size={16} /> {error}</p>}

      <div className="taller__tablero">
        {COLUMNAS.map((c) => {
          const items = equipos.filter((e) => c.estados.includes(e.estado));
          const visibles = c.id === "ENTREGADO" ? items.slice(0, 8) : items;
          return (
            <div key={c.id} className={`taller__col taller__col--${c.id.toLowerCase()}`}>
              <h3>{c.titulo}<small>{items.length}</small></h3>
              <div className="taller__lista">
                {!datos && [1, 2].map((i) => <div key={i} className="esqueleto" style={{ height: 96 }} />)}
                {visibles.map((e) => {
                  const sig = SIGUIENTE[e.estado];
                  return (
                    <article key={e.id} className={`taller__tarjeta ${e.recien ? "taller__tarjeta--movida" : ""}`}>
                      <button type="button" className="taller__abrir" onClick={() => setDetalle(e)}>
                        <span className="taller__marca"><Icon name="tv" size={15} /> {e.marca} {e.modelo}</span>
                        <strong>{e.cliente_nombre}</strong>
                        <small><span className="mono">{e.codigo}</span> · {haceTiempo(e.fecha_actualizacion)}</small>
                        {e.falla && <small className="taller__falla">{e.falla}</small>}
                        {e.origen === "GARANTIA" && <span className="prep prep--llamado">Garantía</span>}
                        {e.estado === "POR_RECIBIR" && <span className="prep prep--espera">El cliente lo trae</span>}
                      </button>
                      {sig && (
                        <button type="button" className="taller__avanzar" disabled={moviendo === e.id} onClick={() => mover(e, sig[0])}>
                          {sig[1]} <Icon name="derecha" size={14} />
                        </button>
                      )}
                    </article>
                  );
                })}
                {datos && !items.length && <p className="taller__vacio">Sin equipos</p>}
              </div>
            </div>
          );
        })}
      </div>

      {nuevo && (
        <FormularioEquipo
          onCerrar={() => setNuevo(false)}
          onGuardado={(r) => { setNuevo(false); avisar(r.mensaje); refrescar(); }}
        />
      )}
      {cedula && (
        <VerificarCedula
          equipo={cedula.equipo}
          estado={cedula.estado}
          onCerrar={() => setCedula(null)}
          onListo={(r) => { setCedula(null); setDetalle(null); avisar(r.mensaje); refrescar(); }}
        />
      )}
      {detalle && <DetalleEquipo equipo={detalle} onCerrar={() => setDetalle(null)} onMover={mover} ocupado={moviendo === detalle.id} />}
    </section>
  );
}

function DetalleEquipo({ equipo: e, onCerrar, onMover, ocupado }) {
  const [nota, setNota] = useState(e.nota || "");
  const est = ESTADOS_EQUIPO[e.estado] || {};
  const sig = SIGUIENTE[e.estado];
  return (
    <Modal
      titulo={`${e.cliente_nombre} · ${e.marca} ${e.modelo || ""}`}
      descripcion={`Equipo ${e.codigo} · celular ${e.cliente_celular}${e.cliente_documento ? ` · cédula ${e.cliente_documento}` : ""}`}
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <button type="button" className="btn btn--suave" disabled={ocupado} onClick={() => onMover(e, e.estado, nota)}>Guardar nota</button>
          {sig && (
            <button type="button" className="btn btn--primario" disabled={ocupado} onClick={() => onMover(e, sig[0], nota)}>
              {CON_CEDULA.includes(sig[0]) && <Icon name="escudo2" size={15} />} {sig[1]}
            </button>
          )}
        </>
      }
    >
      <div className="formulario">
        <ol className="etapas etapas--equipo">
          {["Recibido", "En reparación", "Listo", "Entregado"].map((p, i) => (
            <li key={p} className={`etapas__paso ${est.paso > i + 1 ? "etapas__paso--hecho" : ""} ${est.paso === i + 1 ? "etapas__paso--actual" : ""}`}>
              <span className="etapas__icono"><Icon name={est.paso > i + 1 ? "check" : "tv"} size={14} /></span>
              <span className="etapas__texto">{p}</span>
            </li>
          ))}
        </ol>
        <dl className="detalle__datos">
          <div><dt>Falla</dt><dd>{e.falla || "—"}</dd></div>
          <div><dt>Serial</dt><dd>{e.serial || "—"}</dd></div>
          <div><dt>Ingreso</dt><dd>{e.origen_texto}{e.fecha_compra ? ` · compra ${e.fecha_compra}` : ""}</dd></div>
          <div><dt>Recibió</dt><dd>{e.registrado_por || "Registro del cliente"}</dd></div>
          <div><dt>Registrado</dt><dd>{fechaHora(e.fecha_registro)}</dd></div>
          <div><dt>Última novedad</dt><dd>{fechaHora(e.fecha_actualizacion)}</dd></div>
        </dl>
        <label>
          <span className="etiqueta">Nota para el cliente</span>
          <span className="campo"><textarea rows={2} maxLength={300} value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="Ej. Se cambia la fuente de poder; queda listo mañana." /></span>
          <small className="formulario__ayuda">El cliente la ve al consultar con su celular.</small>
        </label>
      </div>
    </Modal>
  );
}
