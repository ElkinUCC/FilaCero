import { useState } from "react";
import * as agenteApi from "../../api/agente.api";
import { useToast } from "../../hooks/useToast";
import usePolling from "../../hooks/usePolling";
import { ESTADOS_RECLAMO, fechaHora, haceTiempo } from "../../utils/formatters";
import Chat from "../ui/Chat";
import Icon from "../ui/Icon";

const FILTROS = [
  { id: "pendientes", texto: "Pendientes" },
  { id: "RESUELTO", texto: "Resueltos" },
  { id: "", texto: "Todos" },
];

/**
 * Bandeja de reclamos de la sede. Los que llegan "en línea" se responden aquí
 * y la respuesta la ve el ciudadano al consultar con su celular; los
 * "presenciales" además tienen un turno reservado.
 */
export default function Reclamos({ onPendientes }) {
  const avisar = useToast();
  const [filtro, setFiltro] = useState("pendientes");
  const [abierto, setAbierto] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const { datos, error, refrescar } = usePolling(async () => {
    const r = await agenteApi.bandejaReclamos();
    onPendientes?.(r.pendientes);
    return r;
  }, 15000);

  const lista = (datos?.reclamos || []).filter((r) =>
    filtro === "pendientes" ? r.estado !== "RESUELTO" : !filtro || r.estado === filtro);

  async function escribir(r, texto) {
    try {
      await agenteApi.escribirReclamo(r.id, texto);
      refrescar();
    } catch (e) {
      avisar(e.message, "error");
      throw e;
    }
  }
  function abrir(r) {
    const open = abierto === r.id;
    setAbierto(open ? null : r.id);
    if (!open && r.sin_leer) agenteApi.leerReclamo(r.id).then(refrescar).catch(() => {});
  }
  // Al resolver, la respuesta oficial es lo último que escribió el asesor en el chat.
  const ultimaDelAsesor = (r) => [...(r.mensajes || [])].reverse().find((m) => m.autor === "ASESOR")?.texto;

  async function gestionar(r, estado) {
    setOcupado(r.id);
    try {
      const res = await agenteApi.gestionarReclamo(r.id, estado, estado === "RESUELTO" ? (ultimaDelAsesor(r) || r.respuesta || "Caso resuelto por el chat.") : undefined);
      avisar(res.mensaje);
      if (estado === "RESUELTO") setAbierto(null);
      refrescar();
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="taller" aria-label="Reclamos">
      <header className="taller__cabeza">
        <div>
          <h2>Reclamos de la sede</h2>
          <p>Reclamos y consultas de clientes. Tu última respuesta es la que el cliente ve en “Consultar mi turno”.</p>
        </div>
        <div className="segmentos" role="tablist" aria-label="Filtrar reclamos">
          {FILTROS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filtro === f.id} className={filtro === f.id ? "activo" : ""} onClick={() => setFiltro(f.id)}>
              {f.texto}{f.id === "pendientes" && datos ? <small>{datos.pendientes}</small> : null}
            </button>
          ))}
        </div>
      </header>
      {error && <p className="ag__aviso"><Icon name="alerta" size={16} /> {error}</p>}

      <div className="bandeja">
        {!datos && [1, 2, 3].map((i) => <div key={i} className="esqueleto" style={{ height: 64 }} />)}
        {datos && !lista.length && <p className="taller__vacio">No hay reclamos en esta vista.</p>}
        {lista.map((r) => {
          const est = ESTADOS_RECLAMO[r.estado] || {};
          const open = abierto === r.id;
          return (
            <article key={r.id} className={`bandeja__item ${open ? "abierto" : ""}`}>
              <button type="button" className="bandeja__cabeza" onClick={() => abrir(r)} aria-expanded={open}>
                <span className={`bandeja__icono bandeja__icono--${est.tono}`}><Icon name="mensaje" size={18} /></span>
                <span className="bandeja__texto">
                  <strong>{r.categoria_texto}</strong>
                  <small>{r.radicado} · {r.cliente_nombre} · {haceTiempo(r.fecha)}</small>
                </span>
                {r.sin_leer > 0 && <span className="punto-nuevo" title="Mensajes nuevos del cliente">{r.sin_leer}</span>}
                {r.presencial && <span className="prep prep--llamado">En persona</span>}
                <span className={`estado estado--${est.tono}`}>{est.texto}</span>
                <Icon name="abajo" size={16} className={open ? "girado" : ""} />
              </button>
              {open && (
                <div className="bandeja__cuerpo">
                  <dl className="detalle__datos">
                    <div><dt>Cliente</dt><dd>{r.cliente_nombre}</dd></div>
                    <div><dt>Celular</dt><dd>{r.cliente_celular}</dd></div>
                    <div><dt>Equipo</dt><dd>{r.equipo || "—"}</dd></div>
                    <div><dt>Radicado</dt><dd>{fechaHora(r.fecha)}</dd></div>
                  </dl>
                  <Chat
                    yo="ASESOR"
                    inicial={{ autor: "CLIENTE", autor_nombre: r.cliente_nombre, texto: r.descripcion, fecha: r.fecha }}
                    mensajes={r.mensajes || []}
                    placeholder="Responde al cliente (precio, fecha, qué traer)…"
                    onEnviar={(t) => escribir(r, t)}
                  />
                  {r.estado !== "RESUELTO" ? (
                    <div className="bandeja__acciones">
                      <button type="button" className="btn btn--suave" disabled={ocupado === r.id} onClick={() => gestionar(r, "EN_GESTION")}>Marcar en gestión</button>
                      <button type="button" className="btn btn--primario" disabled={ocupado === r.id} onClick={() => gestionar(r, "RESUELTO")}><Icon name="enviar" size={15} /> Marcar resuelto</button>
                    </div>
                  ) : (
                    <p className="tenue">Resuelto por {r.gestionado_por || "un asesor"} · {fechaHora(r.fecha_respuesta)}</p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
