import { useState } from "react";
import { api } from "../api";
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";
import usePolling from "../ui/usePolling";
import { Encabezado } from "./AdminApp";

const TONOS = {
  login_fallido: "ausente", usuario_desactivado: "ausente", rol_cambiado: "llamado",
  clave_restablecida: "espera", clave_cambiada: "atencion", login: "ok",
};

export default function Actividad({ titulo }) {
  const [accion, setAccion] = useState("");
  const [pagina, setPagina] = useState(1);
  const { datos, error, actualizado } = usePolling(() => {
    const q = new URLSearchParams({ pagina, por_pagina: 20 });
    if (accion) q.set("accion", accion);
    return api.get(`/admin/usuarios/auditoria?${q}`);
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
        <div className="tabla-envoltura">
          <table className="tabla tabla--densa">
            <thead><tr><th scope="col">Cuándo</th><th scope="col">Acción</th><th scope="col">Detalle</th><th scope="col">Usuario</th><th scope="col">IP</th></tr></thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{new Date(e.fecha).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                  <td><span className={`estado estado--${TONOS[e.accion] || "cancelado"}`}>{e.accion_texto}</span></td>
                  <td className="recorte" title={e.detalle || ""}>{e.detalle || <span className="tenue">—</span>}</td>
                  <td>{e.usuario || <span className="tenue">Desconocido</span>}</td>
                  <td className="tenue">{e.ip || "—"}</td>
                </tr>
              ))}
              {datos && !eventos.length && <tr><td colSpan={5} className="vacio">Sin actividad registrada con ese filtro.</td></tr>}
              {!datos && [1, 2, 3].map((i) => <tr key={i}><td colSpan={5}><div className="esqueleto" style={{ height: 16 }} /></td></tr>)}
            </tbody>
          </table>
        </div>
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
    </section>
  );
}
