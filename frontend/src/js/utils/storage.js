/** Acceso seguro a localStorage (puede no estar disponible). */

export function leerLocal(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

export function guardarLocal(clave, valor) {
  try {
    if (valor == null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* almacenamiento no disponible */
  }
}
