import Icon from "../ui/Icon";

/**
 * Tabla estándar de todas las secciones del panel.
 *
 * Regla de diseño (igual en Sedes, Trámites, Asesores, Usuarios, Historial y
 * Actividad): SEIS columnas con un solo dato por columna:
 *
 *   [Registro (enlace al detalle)] [Dato] [Dato] [Dato] [Estado] [Acciones]
 *
 * El resto de la información vive en el panel de detalle, que se abre al
 * hacer clic en el registro. Así ninguna vista se recarga de texto.
 *
 * columnas: 6 títulos. filas: [{ id, celdas: [6 nodos], inactivo }].
 */
export const COLUMNAS_SECCION = 6;

const ALINEAR = ["left", "left", "left", "left", "center", "right"];
const ANCHOS = [27, 17, 17, 17, 12, 10];

/**
 * alinear: alineación por columna ("left" | "center" | "right"); los números y
 *          el estado van centrados para que la vista quede pareja.
 * anchos:  porcentaje por columna (suman 100).
 */
export default function TablaSeccion({ columnas, filas, cargando, vacio, etiqueta, alinear = ALINEAR, anchos = ANCHOS }) {
  if (import.meta.env.DEV && columnas.length !== COLUMNAS_SECCION) {
    console.warn(`TablaSeccion espera ${COLUMNAS_SECCION} columnas y recibió ${columnas.length}.`);
  }
  return (
    <div className="tabla-envoltura">
      <table className="tabla tabla--seccion" aria-label={etiqueta}>
        <colgroup>
          {anchos.map((a, i) => <col key={i} style={{ width: `${a}%` }} />)}
        </colgroup>
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th key={c || i} scope="col" className={`al-${alinear[i]} ${i === columnas.length - 1 ? "acciones" : ""}`}>
                {i === columnas.length - 1 && !c ? <span className="sr">Acciones</span> : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className={f.inactivo ? "inactivo" : ""}>
              {f.celdas.map((celda, i) => (
                <td
                  key={i}
                  className={`al-${alinear[i]} ${i === f.celdas.length - 1 ? "acciones" : ""}`}
                  title={typeof celda === "string" || typeof celda === "number" ? String(celda) : undefined}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
          {!cargando && !filas.length && (
            <tr><td colSpan={COLUMNAS_SECCION} className="vacio">{vacio}</td></tr>
          )}
          {cargando && [1, 2, 3].map((i) => (
            <tr key={`e${i}`}><td colSpan={COLUMNAS_SECCION}><div className="esqueleto" style={{ height: 16 }} /></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Primera columna: el registro como enlace que abre su detalle. */
export function EnlaceDetalle({ texto, onClick, avatar, mono }) {
  return (
    <button type="button" className={`enlace-detalle ${mono ? "mono" : ""}`} onClick={onClick} title="Ver detalle">
      {avatar && <span className="adm__avatar adm__avatar--chico" aria-hidden="true">{avatar}</span>}
      <span className="enlace-detalle__texto">{texto}</span>
      <Icon name="derecha" size={15} className="enlace-detalle__flecha" />
    </button>
  );
}

/** Insignia de estado de un solo dato. */
export function Estado({ tono, children }) {
  return <span className={`estado estado--${tono}`}>{children}</span>;
}
