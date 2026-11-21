/** Punto de entrada del frontend (JavaScript puro, sin frameworks). */
import { logout } from "./api/auth.api.js";
import { EVENTO_SERVIDOR_LENTO, EVENTO_SESION_EXPIRADA } from "./api/http.js";
import { homeFor } from "./auth/permissions.js";
import { clearSession, getUsuario } from "./auth/session.service.js";
import { ForbiddenPage, mountForbiddenPage } from "./pages/ForbiddenPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { resolveRoute } from "./router/guards.js";
import { navigate, rutaActual } from "./router/navegacion.js";
import { matchRoute } from "./router/routes.js";

const app = document.getElementById("app");
let usuario = getUsuario();
let limpiarPagina = null;

/** Acciones de sesión que reciben todas las páginas. */
const contexto = {
  /** Tras iniciar sesión: guarda el usuario y va a su inicio según el rol. */
  onIngresar(u) {
    usuario = u;
    navigate(homeFor(u), { reemplazar: true });
  },
  /** Revoca el token en el servidor; si falla (sin red), igual se cierra aquí. */
  onSalir() {
    logout()
      .catch(() => {})
      .finally(() => {
        clearSession();
        usuario = null;
        if (window.location.hash === "#/") render();
        else navigate("/", { reemplazar: true });
      });
  },
  /** Tras cambiar la contraseña llegan datos nuevos del usuario. */
  onUsuario(u) {
    usuario = u;
    if (rutaActual().path === "/cambiar-clave") navigate(homeFor(u), { reemplazar: true });
  },
};

/** Pinta la página que corresponde a la URL actual. */
function render() {
  // Detiene consultas periódicas, relojes y voz de la página anterior.
  if (limpiarPagina) limpiarPagina();
  limpiarPagina = null;

  const { path } = rutaActual();
  const resultado = resolveRoute(matchRoute(path), usuario);

  if (resultado.redirect) {
    navigate(resultado.redirect, { reemplazar: true });
    return;
  }

  const ctx = { ...contexto, usuario, params: resultado.params || {} };

  if (resultado.notFound) {
    app.innerHTML = String(NotFoundPage());
    document.title = "Página no encontrada · FilaCero";
  } else if (resultado.forbidden) {
    app.innerHTML = String(ForbiddenPage(ctx));
    mountForbiddenPage(ctx);
    document.title = "Sin permiso · FilaCero";
  } else {
    const { route } = resultado;
    app.innerHTML = String(route.page(ctx));
    limpiarPagina = route.mount(ctx) || null;
    document.title = `${route.titulo} · FilaCero`;
  }
}

window.addEventListener("hashchange", render);

// Token vencido, revocado o cuenta desactivada: vuelve al portal con el acceso abierto.
window.addEventListener(EVENTO_SESION_EXPIRADA, () => {
  usuario = null;
  navigate("/?ingresar=1", { reemplazar: true });
});

// Aviso cuando el servidor tarda (p. ej. un servidor gratuito despertando).
const avisoLento = document.createElement("div");
avisoLento.className = "aviso-servidor";
avisoLento.setAttribute("role", "status");
avisoLento.hidden = true;
avisoLento.innerHTML = '<span class="aviso-servidor__punto" aria-hidden="true"></span> Conectando con el servidor… la primera carga puede tardar hasta un minuto.';
document.body.appendChild(avisoLento);
window.addEventListener(EVENTO_SERVIDOR_LENTO, (e) => {
  avisoLento.hidden = !e.detail;
});

// "Saltar al contenido" (accesibilidad con teclado).
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-saltar]")) return;
  e.preventDefault();
  document.getElementById("contenido")?.focus();
});

render();
