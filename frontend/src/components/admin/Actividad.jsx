import { useState } from "react";
import * as adminApi from "../../api/admin.api";
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";
import usePolling from "../../hooks/usePolling";
import Encabezado from "../layout/Encabezado";
import { fechaHora } from "../../utils/formatters";
import PanelDetalle, { Datos } from "../ui/PanelDetalle";
import TablaSeccion, { EnlaceDetalle, Estado } from "./TablaSeccion";

const TONOS = {
  login_fallido: "ausente", login_bloqueado: "ausente", usuario_desactivado: "ausente",
  usuario_eliminado: "ausente", rol_cambiado: "llamado", clave_restablecida: "espera",
  clave_cambiada: "atencion", login: "ok", logout: "cancelado", turno_preparado: "ok",
  equipo_registrado: "atencion", equipo_actualizado: "ok", reclamo_gestionado: "llamado",
  presencia_cambiada: "espera",
};

/** Tipo de evento en una palabra (columna Tipo). */
const GRUPOS = {
  login: "Ingreso", logout: "Salida", login_fallido: "Seguridad", login_bloqueado: "Seguridad",
  clave_cambiada: "Seguridad", clave_restablecida: "Seguridad", rol_cambiado: "Permisos",
  usuario_creado: "Cuentas", usuario_editado: "Cuentas", usuario_desactivado: "Cuentas",
  usuario_activado: "Cuentas", usuario_eliminado: "Cuentas", sede_creada: "Catálogo",
  sede_editada: "Catálogo", sede_eliminada: "Catálogo", tramite_creado: "Catálogo",
  tramite_editado: "Catálogo", tramite_eliminado: "Catálogo", sede_cambiada: "Operación",
  turno_preparado: "Operación", equipo_registrado: "Taller", equipo_actualizado: "Taller",
  reclamo_gestionado: "Reclamos", presencia_cambiada: "Operación",
};

export default function Actividad({ titulo }) {
  const [accion, setAccion] = useState("");
  const [pagina, setPagina] = useState(1);
  const [detalle, setDetalle] = useState(null);
  const { datos, error, actualizado } = usePolling(() => {
    return adminApi.auditoria({ pagina, por_pagina: 20, accion });
  }, 15000, [accion, pagina]);

  const eventos = datos?.eventos || [];
  const opciones = [{ value: "", label: "Toda la actividad" }, ...Object.entries(datos?.acciones || {}).map(([k, v]) => ({ value: k, label: v }))];

  return (
    <section className="adm__seccion">
      <Encabezado titulo={titulo} detalle="Registro de ingresos y cambios sensibles: quién hizo qué, cuándo y desde qué dirección." actualizado={actualizado} error={error} />
      <article className="panel panel--tabla">
        <div className="barra-tabla barra-tabla--filtros">
          <Dropdown ariaLabel="Filtrar por tipo de actividad" value={accion} options={opciones} onChange={(v) => { setAccion(v); setPagina(1); }} placeholder="Toda la actividad" />
          <span className="tenue">{datos ? `${datos.total.toLocaleString("es-CO")} eventos` : ""}</span>
        </div>
        <TablaSeccion
          etiqueta={titulo}
          columnas={["Evento", "Fecha y hora", "Usuario", "Dirección IP", "Tipo", ""]}
          alinear={["left", "left", "left", "center", "center", "right"]}
          filas={eventos.map((e) => ({
            id: e.id,
            celdas: [
              <EnlaceDetalle key="n" texto={e.accion_texto} onClick={() => setDetalle(e)} />,
              fechaHora(e.fecha),
              e.usuario || <span key="k1" className="tenue">Desconocido</span>,
              e.ip || <span key="k1" className="tenue">—</span>,
              <Estado key="t" tono={TONOS[e.accion] || "cancelado"}>{GRUPOS[e.accion] || "Cambio"}</Estado>,
              <button key="v" className="icono-btn" title="Ver detalle" aria-label={`Ver detalle del evento ${e.id}`} onClick={() => setDetalle(e)}>
                <Icon name="ver" size={17} />
              </button>,
            ],
          }))}
          cargando={!datos}
          vacio="Sin actividad registrada con ese filtro."
        />
        {datos?.total_paginas > 1 && (
          <footer className="paginador">
            <span className="tenue">Página {datos.pagina} de {datos.total_paginas}</span>
            <div>
              <button className="icono-btn" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Anterior"><Icon name="izquierda" size={18} /></button>
              <button className="icono-btn" disabled={pagina >= datos.total_paginas} onClick={() => setPagina((p) => p + 1)} aria-label="Siguiente"><Icon name="derecha" size={18} /></button>
            </div>
          </footer>
        )}
      </article>

      {detalle && (
        <PanelDetalle
          titulo={detalle.accion_texto}
          subtitulo={fechaHora(detalle.fecha)}
          insignia={<Estado tono={TONOS[detalle.accion] || "cancelado"}>{GRUPOS[detalle.accion] || "Cambio"}</Estado>}
          onCerrar={() => setDetalle(null)}
        >
          <section className="detalle__bloque">
            <h3>Detalle</h3>
            <p className="detalle__texto">{detalle.detalle || "Sin detalle adicional."}</p>
          </section>
          <Datos
            titulo="Origen"
            filas={[
              ["Usuario", detalle.usuario || "Desconocido"],
              ["Correo", detalle.usuario_correo],
              ["Dirección IP", detalle.ip],
              ["Evento", `#${detalle.id}`],
            ]}
          />
        </PanelDetalle>
      )}
    </section>
  );
}
