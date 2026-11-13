/**
 * Tabla de rutas del frontend.
 *
 *   public        -> cualquiera puede entrar (ciudadano, TV de sala)
 *   requiresAuth  -> exige sesión del personal
 *   roles         -> además exige uno de estos roles (si no: página 403)
 *
 * Cada página es un módulo con dos funciones (patrón del proyecto de referencia):
 *   XPage(ctx)       -> devuelve el HTML de la página
 *   mountXPage(ctx)  -> enlaza eventos, inicia consultas y devuelve una función de limpieza
 *
 * Una ruta puede tener parámetros: "/admin/:seccion".
 * Las URL usan "#" (#/admin/usuarios) para funcionar en cualquier servidor estático.
 */
import { ROLES, ROLES_PANEL } from "../auth/permissions.js";
import { AdminPage, mountAdminPage } from "../pages/AdminPage.js";
import { AgentePage, mountAgentePage } from "../pages/AgentePage.js";
import { CambioClavePage, mountCambioClavePage } from "../pages/CambioClavePage.js";
import { PortalPage, mountPortalPage } from "../pages/PortalPage.js";
import { SalaPage, mountSalaPage } from "../pages/SalaPage.js";

export const routeList = [
  { path: "/", public: true, page: PortalPage, mount: mountPortalPage, titulo: "Reserva tu turno" },
  { path: "/sala", public: true, page: SalaPage, mount: mountSalaPage, titulo: "Sala de espera" },
  { path: "/admin", requiresAuth: true, roles: ROLES_PANEL, page: AdminPage, mount: mountAdminPage, titulo: "Panel" },
  { path: "/admin/:seccion", requiresAuth: true, roles: ROLES_PANEL, page: AdminPage, mount: mountAdminPage, titulo: "Panel" },
  { path: "/agente", requiresAuth: true, roles: [ROLES.AGENTE], page: AgentePage, mount: mountAgentePage, titulo: "Consola" },
  { path: "/cambiar-clave", requiresAuth: true, page: CambioClavePage, mount: mountCambioClavePage, titulo: "Crea tu contraseña" },
];

/** Busca la ruta que coincide con el pathname y extrae sus parámetros. */
export function matchRoute(pathname) {
  const partes = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  for (const route of routeList) {
    const patron = route.path.split("/").filter(Boolean);
    if (patron.length !== partes.length) continue;
    const params = {};
    const coincide = patron.every((segmento, i) => {
      if (segmento.startsWith(":")) {
        params[segmento.slice(1)] = decodeURIComponent(partes[i]);
        return true;
      }
      return segmento === partes[i];
    });
    if (coincide) return { route, params };
  }
  return null;
}
