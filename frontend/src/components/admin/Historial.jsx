import { useEffect, useState } from "react";
import * as adminApi from "../../api/admin.api";
import { listarSedes } from "../../api/catalogo.api";
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";
import usePolling from "../../hooks/usePolling";
import { duracion, ESTADOS, fechaCorta, horaDe } from "../../utils/formatters";
import Encabezado from "../layout/Encabezado";

const POR_PAGINA = 15;

function puntual(t) {
  if (!t.fecha_inicio) return null;
  const inicio = horaDe(t.fecha_inicio);
  return inicio <= t.hora_fin;
}

export default function Historial({ titulo }) {
  const [filtros, setFiltros] = useState({ estado: "", punto_id: "", desde: "", hasta: "" });
  const [texto, setTexto] = useState("");
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(1);
  const [sedes, setSedes] = useState([]);

  useEffect(() => {
    listarSedes({ todos: true }).then(setSedes).catch(() => {});
  }, []);

  // Búsqueda con espera corta para no consultar en cada tecla.
  useEffect(() => {
    const t = window.setTimeout(() => { setBuscar(texto); setPagina(1); }, 350);
    return () => window.clearTimeout(t);
  }, [texto]);

  const { datos, error, actualizado } = usePolling(() => {
    return adminApi.historial({ pagina, por_pagina: POR_PAGINA, ...filtros, buscar });
  }, 20000, [pagina, buscar, filtros.estado, filtros.punto_id, filtros.desde, filtros.hasta]);

  function filtrar(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
    setPagina(1);
  }

  const hayFiltros = buscar || Object.values(filtros).some(Boolean);
  const turnos = datos?.turnos || [];

  return (
    <section className="adm__seccion">
      <Encabezado titulo={titulo} detalle="Turnos de hoy y días anteriores. Para consultar reservas futuras, usa los filtros de fecha." actualizado={actualizado} error={error} />

      <article className="panel panel--tabla">
        <div className="barra-tabla barra-tabla--filtros">
          <label className="campo campo--buscar">
            <Icon name="buscar" size={16} />
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Código, nombre o celular" aria-label="Buscar turno" />
          </label>
          <Dropdown ariaLabel="Filtrar por estado" value={filtros.estado} onChange={(v) => filtrar("estado", v)} placeholder="Todos los estados"
            options={[{ value: "", label: "Todos los estados" }, ...Object.entries(ESTADOS).map(([k, v]) => ({ value: k, label: v.texto }))]} />
          <Dropdown ariaLabel="Filtrar por sede" value={filtros.punto_id} onChange={(v) => filtrar("punto_id", v)} placeholder="Todas las sedes"
            options={[{ value: "", label: "Todas las sedes" }, ...sedes.map((s) => ({ value: s.id, label: s.nombre }))]} />
          <label className="campo campo--fecha" title="Desde"><input type="date" value={filtros.desde} onChange={(e) => filtrar("desde", e.target.value)} aria-label="Desde" /></label>
          <label className="campo campo--fecha" title="Hasta"><input type="date" value={filtros.hasta} onChange={(e) => filtrar("hasta", e.target.value)} aria-label="Hasta" /></label>
          {hayFiltros && (
            <button className="btn btn--suave btn--chico" onClick={() => { setFiltros({ estado: "", punto_id: "", desde: "", hasta: "" }); setTexto(""); setPagina(1); }}>
              Limpiar
            </button>
          )}
        </div>

        <div className="tabla-envoltura">
          <table className="tabla tabla--densa">
            <thead>
              <tr><th scope="col">Turno</th><th scope="col">Ciudadano</th><th scope="col">Sede · trámite</th><th scope="col">Cita</th><th scope="col">Estado</th><th scope="col">Atendió</th><th scope="col" className="num">Duración</th><th scope="col">Franja</th></tr>
            </thead>
            <tbody>
              {turnos.map((t) => {
                const e = ESTADOS[t.estado] || {};
                const p = puntual(t);
                const seg = t.fecha_inicio && t.fecha_fin ? (new Date(t.fecha_fin) - new Date(t.fecha_inicio)) / 1000 : null;
                return (
                  <tr key={t.id}>
                    <td className="mono" title={t.codigo}>{t.codigo.slice(-6)}</td>
                    <td><strong>{t.usuario_nombre}</strong><small className="bloque">{t.usuario_celular}</small></td>
                    <td>{t.punto_nombre}<small className="bloque">{t.tramite_nombre}</small></td>
                    <td>{fechaCorta(t.fecha)}<small className="bloque">{t.hora_inicio}–{t.hora_fin}</small></td>
                    <td><span className={`estado estado--${e.tono}`}>{e.texto}</span></td>
                    <td>{t.agente_nombre?.replace(/^Agente /, "") || <span className="tenue">—</span>}</td>
                    <td className={`num ${seg > 600 ? "texto-rojo" : ""}`}>{seg != null ? duracion(seg) : "—"}</td>
                    <td>{p == null ? <span className="tenue">—</span> : p ? <span className="marca-ok"><Icon name="check" size={14} /> Cumplida</span> : <span className="texto-rojo">Tarde</span>}</td>
                  </tr>
                );
              })}
              {datos && !turnos.length && <tr><td colSpan={8} className="vacio">{hayFiltros ? "No hay turnos con esos filtros." : "Aún no hay turnos registrados."}</td></tr>}
              {!datos && [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={8}><div className="esqueleto" style={{ height: 16 }} /></td></tr>)}
            </tbody>
          </table>
        </div>

        {datos?.total_paginas > 1 && (
          <footer className="paginador">
            <span className="tenue">{datos.total.toLocaleString("es-CO")} turnos · página {datos.pagina} de {datos.total_paginas}</span>
            <div>
              <button className="icono-btn" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior"><Icon name="izquierda" size={18} /></button>
              <button className="icono-btn" disabled={pagina >= datos.total_paginas} onClick={() => setPagina((p) => p + 1)} aria-label="Página siguiente"><Icon name="derecha" size={18} /></button>
            </div>
          </footer>
        )}
      </article>
    </section>
  );
}
