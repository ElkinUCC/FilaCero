/**
 * Navegación del SPA con la History API (sin librerías externas), equivalente
 * a navigate() del proyecto de referencia.
 */
import { useSyncExternalStore } from "react";

const EVENTO = "filacero:navegacion";

/** Cambia la URL sin recargar la página y avisa a la app. */
export function navegar(ruta, { reemplazar = false } = {}) {
  if (ruta === window.location.pathname + window.location.search) return;
  if (reemplazar) window.history.replaceState(null, "", ruta);
  else window.history.pushState(null, "", ruta);
  window.dispatchEvent(new Event(EVENTO));
  window.scrollTo(0, 0);
}

function suscribir(avisar) {
  window.addEventListener("popstate", avisar);
  window.addEventListener(EVENTO, avisar);
  return () => {
    window.removeEventListener("popstate", avisar);
    window.removeEventListener(EVENTO, avisar);
  };
}

/** Ruta actual (pathname); el componente se vuelve a pintar cuando cambia. */
export function useRutaActual() {
  return useSyncExternalStore(suscribir, () => window.location.pathname);
}
