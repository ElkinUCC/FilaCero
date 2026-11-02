/**
 * Tabla de rutas del frontend (igual que routes.js del proyecto de referencia).
 *
 *   public        -> cualquiera puede entrar (ciudadano, TV de sala)
 *   requiresAuth  -> exige sesión del personal
 *   roles         -> además exige uno de estos roles (si no: página 403)
 *
 * Una ruta puede tener parámetros: "/admin/:seccion".
 */
import { ROLES, ROLES_PANEL } from "../auth/permissions";
import AdminPage from "../pages/AdminPage";
import AgentePage from "../pages/AgentePage";
import CambioClavePage from "../pages/CambioClavePage";
import PortalPage from "../pages/PortalPage";
import SalaPage from "../pages/SalaPage";

export const routeList = [
  { path: "/", public: true, page: PortalPage, titulo: "Reserva tu turno" },
  { path: "/sala", public: true, page: SalaPage, titulo: "Sala de espera" },
  { path: "/admin", requiresAuth: true, roles: ROLES_PANEL, page: AdminPage, titulo: "Panel" },
  { path: "/admin/:seccion", requiresAuth: true, roles: ROLES_PANEL, page: AdminPage, titulo: "Panel" },
  { path: "/agente", requiresAuth: true, roles: [ROLES.AGENTE], page: AgentePage, titulo: "Consola" },
  { path: "/cambiar-clave", requiresAuth: true, page: CambioClavePage, titulo: "Crea tu contraseña" },
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
