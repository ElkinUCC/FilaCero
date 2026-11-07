import { useEffect, useState } from "react";
import * as adminApi from "../../api/admin.api";
import { listarSedes } from "../../api/catalogo.api";
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";
import usePolling from "../../hooks/usePolling";
import {
  duracion, ESTADOS, fechaCorta, fechaHora, fechaLarga, horaDe, PREPARACION, valorRespuesta,
} from "../../utils/formatters";
import Encabezado from "../layout/Encabezado";
import PanelDetalle, { Datos } from "../ui/PanelDetalle";
import TablaSeccion, { EnlaceDetalle, Estado } from "./TablaSeccion";

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
  const [detalle, setDetalle] = useState(null);

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

        <TablaSeccion
          etiqueta={titulo}
          columnas={["Turno", "Ciudadano", "Trámite", "Cita", "Estado", ""]}
          anchos={[14, 26, 22, 16, 12, 10]}
          filas={turnos.map((t) => {
            const e = ESTADOS[t.estado] || {};
            return {
              id: t.id,
              celdas: [
                <EnlaceDetalle key="c" mono texto={t.codigo.slice(-6)} onClick={() => setDetalle(t)} />,
                t.usuario_nombre,
                t.tramite_nombre,
                `${fechaCorta(t.fecha)} · ${t.hora_inicio}`,
                <Estado key="e" tono={e.tono}>{e.texto}</Estado>,
                <button key="v" className="icono-btn" title="Ver detalle" aria-label={`Ver detalle del turno ${t.codigo}`} onClick={() => setDetalle(t)}>
                  <Icon name="ver" size={17} />
                </button>,
              ],
            };
          })}
          cargando={!datos}
          vacio={hayFiltros ? "No hay turnos con esos filtros." : "Aún no hay turnos registrados."}
        />

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

      {detalle && <DetalleTurno turno={detalle} onCerrar={() => setDetalle(null)} />}
    </section>
  );
}

function DetalleTurno({ turno: t, onCerrar }) {
  const e = ESTADOS[t.estado] || {};
  const p = puntual(t);
  const seg = t.fecha_inicio && t.fecha_fin ? (new Date(t.fecha_fin) - new Date(t.fecha_inicio)) / 1000 : null;
  const prep = t.preparacion ? PREPARACION[t.preparacion.estado] : null;
  return (
    <PanelDetalle
      titulo={`Turno ${t.codigo}`}
      subtitulo={`${t.punto_nombre} · ${t.tramite_nombre}`}
      insignia={<>
        <Estado tono={e.tono}>{e.texto}</Estado>
        {prep && <Estado tono={prep.tono}>{prep.texto}</Estado>}
      </>}
      onCerrar={onCerrar}
    >
      <Datos
        titulo="Ciudadano"
        filas={[
          ["Nombre", t.usuario_nombre],
          ["Celular", t.usuario_celular],
        ]}
      />
      <Datos
        titulo="Cita"
        filas={[
          ["Fecha", fechaLarga(t.fecha)],
          ["Franja reservada", `${t.hora_inicio}–${t.hora_fin}`],
          ["Sede", t.punto_nombre],
          ["Reservó", fechaHora(t.hora_solicitud)],
        ]}
      />
      <Datos
        titulo="Atención"
        filas={[
          ["Atendió", t.agente_nombre],
          ["Módulo", t.agente_modulo],
          ["Llamado", t.fecha_llamado ? horaDe(t.fecha_llamado) : null],
          ["Inicio", t.fecha_inicio ? horaDe(t.fecha_inicio) : null],
          ["Fin", t.fecha_fin ? horaDe(t.fecha_fin) : null],
          ["Duración", seg != null ? <span key="k1" className={seg > 600 ? "texto-rojo" : ""}>{duracion(seg)}</span> : null],
          ["Dentro de su franja", p == null ? null : p ? <span key="k1" className="marca-ok"><Icon name="check" size={14} /> Cumplida</span> : <span key="k2" className="texto-rojo">Tarde</span>],
        ]}
      />
      {(t.respuestas_solicitud?.length > 0 || t.detalle_necesidad) && (
        <Datos
          titulo="Lo que pidió al reservar"
          filas={[
            ...(t.respuestas_solicitud || []).map((r) => [r.etiqueta, valorRespuesta(r.valor)]),
            t.detalle_necesidad && ["Necesidad", t.detalle_necesidad],
          ]}
        />
      )}
      {t.preparacion && (
        <section className="detalle__bloque">
          <h3>Preparación previa</h3>
          <p className="detalle__texto">
            <strong>{prep?.texto}</strong>
            {t.preparacion.preparado_por ? ` · ${t.preparacion.preparado_por}` : ""}
            {t.preparacion.fecha ? ` · ${fechaHora(t.preparacion.fecha)}` : ""}
            {t.preparacion.nota ? `\n${t.preparacion.nota}` : ""}
          </p>
        </section>
      )}
    </PanelDetalle>
  );
}
