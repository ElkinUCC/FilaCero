/**
 * Guardas de navegación (guards.js, igual que en el proyecto de referencia).
 * Deciden qué ve cada persona según su sesión y su rol. El backend vuelve a
 * validar todo: estas guardas solo evitan pantallas que van a fallar.
 */
import { hasRole, homeFor, isAuthenticated } from "../auth/permissions.js";

/** Sin sesión -> al portal con el acceso del personal abierto. */
export function requireAuth(usuario) {
  return isAuthenticated(usuario) ? null : { redirect: "/?ingresar=1" };
}

/** Con sesión pero sin el rol -> página 403 (sin cerrar la sesión). */
export function requireRole(usuario, roles) {
  return hasRole(usuario, roles) ? null : { forbidden: true };
}

/**
 * Resuelve qué mostrar para una URL:
 *   { route, params }  -> pintar la página
 *   { redirect }       -> cambiar de URL
 *   { forbidden }      -> 403
 *   { notFound }       -> 404
 */
export function resolveRoute(match, usuario) {
  if (!match) return { notFound: true };
  const { route } = match;

  // El personal que abre "/" va directo a su panel o consola.
  if (route.path === "/" && isAuthenticated(usuario)) return { redirect: homeFor(usuario) };

  if (route.public) return match;

  const sinSesion = requireAuth(usuario);
  if (sinSesion) return sinSesion;

  // Clave temporal: debe cambiarla antes de entrar a cualquier otra pantalla.
  if (usuario.debe_cambiar_clave && route.path !== "/cambiar-clave") {
    return { redirect: "/cambiar-clave" };
  }
  if (!usuario.debe_cambiar_clave && route.path === "/cambiar-clave") {
    return { redirect: homeFor(usuario) };
  }

  return requireRole(usuario, route.roles) || match;
}
