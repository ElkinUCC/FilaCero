/**
 * Reglas de permisos en la interfaz.
 *
 * Ocultar un botón NO es seguridad: el backend valida el rol en cada petición
 * (requiere_rol en app/seguridad.py). Esto solo evita mostrar opciones inútiles.
 */

export const ROLES = {
  ADMIN: "ADMIN",
  SUPERVISOR: "SUPERVISOR",
  AGENTE: "AGENTE",
};

export const ROLES_PANEL = [ROLES.ADMIN, ROLES.SUPERVISOR];
export const ROLES_PERSONAL = [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.AGENTE];

export const getCurrentRole = (usuario) => usuario?.rol || null;
export const isAuthenticated = (usuario) => Boolean(usuario);
export const isAdmin = (usuario) => getCurrentRole(usuario) === ROLES.ADMIN;
export const isAgente = (usuario) => getCurrentRole(usuario) === ROLES.AGENTE;
export const isPersonal = (usuario) => ROLES_PERSONAL.includes(getCurrentRole(usuario));
export const hasRole = (usuario, roles) => !roles?.length || roles.includes(getCurrentRole(usuario));

/** El supervisor ve todo el panel, pero no puede crear, editar ni eliminar. */
export const canEdit = (usuario) => isAdmin(usuario);

/** Página de inicio de cada rol después de iniciar sesión. */
export function homeFor(usuario) {
  if (!usuario) return "/";
  if (usuario.debe_cambiar_clave) return "/cambiar-clave";
  if (ROLES_PANEL.includes(usuario.rol)) return "/admin";
  if (usuario.rol === ROLES.AGENTE) return "/agente";
  return "/";
}
