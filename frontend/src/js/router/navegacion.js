/**
 * Navegación del SPA con el hash de la URL (#/ruta), sin librerías.
 * Funciona con cualquier servidor estático (Live Server, python -m http.server)
 * porque el navegador nunca pide al servidor la ruta interna.
 */

/** Ruta interna actual: { path: "/admin/usuarios", query: URLSearchParams }. */
export function rutaActual() {
  const interna = window.location.hash.replace(/^#/, "") || "/";
  const [path, texto = ""] = interna.split("?");
  return { path: path || "/", query: new URLSearchParams(texto) };
}

/** Cambia de página sin recargar. reemplazar: no deja la entrada en el historial. */
export function navigate(ruta, { reemplazar = false } = {}) {
  const destino = `#${ruta}`;
  if (window.location.hash === destino) return;
  if (reemplazar) {
    window.history.replaceState(null, "", destino);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = ruta;
  }
}

/** Actualiza parámetros de la URL actual sin volver a pintar la página. */
export function cambiarQuery(parametros) {
  const { path, query } = rutaActual();
  Object.entries(parametros).forEach(([k, v]) => (v ? query.set(k, v) : query.delete(k)));
  const texto = query.toString();
  window.history.replaceState(null, "", `#${path}${texto ? `?${texto}` : ""}`);
}
