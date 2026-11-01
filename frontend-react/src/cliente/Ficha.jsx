import { fechaLarga } from "../util";

/** Ficha de turno que se llena en vivo y "se imprime" al confirmar. */
export default function Ficha({ resumen = {}, turno = null }) {
  const datos = turno
    ? {
        sede: turno.sede,
        tramite: turno.tramite,
        fecha: turno.fecha,
        hora: `${turno.hora_inicio} – ${turno.hora_fin}`,
        nombre: turno.nombre,
      }
    : resumen;

  const filas = [
    ["Sede", datos.sede],
    ["Servicio", datos.tramite],
    ["Fecha", datos.fecha ? fechaLarga(datos.fecha) : null],
    ["Hora", datos.hora],
    ["A nombre de", datos.nombre],
  ];
  const completas = filas.filter(([, v]) => v).length;

  return (
    <div className={`ficha ${turno ? "ficha--impresa" : ""}`} key={turno?.codigo || "borrador"}>
      <div className="ficha__cabeza">
        <span className="ficha__marca">FilaCero</span>
        <span className="ficha__tipo">{turno ? "Turno confirmado" : "Tu turno"}</span>
      </div>
      <div className={`ficha__codigo ${turno ? "" : "ficha__codigo--vacio"}`}>
        {turno ? turno.codigo.replace(/^FC-\d{8}-/, "") : "······"}
      </div>
      <div className="ficha__corte" aria-hidden="true" />
      <dl className="ficha__datos">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className={valor ? "" : "ficha__vacio"}>
            <dt>{etiqueta}</dt>
            <dd>{valor || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="ficha__progreso" aria-hidden="true">
        <span style={{ width: `${turno ? 100 : (completas / filas.length) * 100}%` }} />
      </div>
    </div>
  );
}
