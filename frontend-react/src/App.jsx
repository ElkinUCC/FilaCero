/**
 * Raíz del frontend: sesión + enrutador + notificaciones.
 *
 * Flujo (igual que main.js del proyecto de referencia):
 *   URL -> matchRoute (routes.jsx) -> resolveRoute (guards.js) -> página
 */
import { useCallback, useEffect, useState } from "react";
import { logout } from "./api/auth.api";
import { EVENTO_SERVIDOR_LENTO, EVENTO_SESION_EXPIRADA } from "./api/http";
import { homeFor } from "./auth/permissions";
import { clearSession, getUsuario } from "./auth/session.service";
import { ToastProvider } from "./components/ui/Toast";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";
import { resolveRoute } from "./router/guards";
import { navegar, useRutaActual } from "./router/navegacion";
import { matchRoute } from "./router/routes";

export default function App() {
  const ruta = useRutaActual();
  const [usuario, setUsuario] = useState(getUsuario);

  // Token vencido, revocado o cuenta desactivada: vuelve al portal.
  useEffect(() => {
    const expirada = () => {
      setUsuario(null);
      navegar("/?ingresar=1", { reemplazar: true });
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, expirada);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, expirada);
  }, []);

  // Aviso cuando el servidor tarda (p. ej. un servidor gratuito despertando).
  const [servidorLento, setServidorLento] = useState(false);
  useEffect(() => {
    const cambiar = (e) => setServidorLento(Boolean(e.detail));
    window.addEventListener(EVENTO_SERVIDOR_LENTO, cambiar);
    return () => window.removeEventListener(EVENTO_SERVIDOR_LENTO, cambiar);
  }, []);

  const alIngresar = useCallback((u) => {
    setUsuario(u);
    navegar(homeFor(u), { reemplazar: true });
  }, []);

  const alSalir = useCallback(() => {
    // Revoca el token en el servidor; si falla (sin red), igual se cierra aquí.
    logout()
      .catch(() => {})
      .finally(() => {
        clearSession();
        setUsuario(null);
        navegar("/", { reemplazar: true });
      });
  }, []);

  /** Tras cambiar la contraseña llegan datos nuevos del usuario. */
  const alActualizarUsuario = useCallback((u) => {
    setUsuario(u);
    if (window.location.pathname === "/cambiar-clave") navegar(homeFor(u), { reemplazar: true });
  }, []);

  const resultado = resolveRoute(matchRoute(ruta), usuario);

  useEffect(() => {
    if (resultado.redirect) navegar(resultado.redirect, { reemplazar: true });
  }, [resultado.redirect]);

  useEffect(() => {
    const titulo = resultado.route?.titulo;
    document.title = titulo ? `${titulo} · FilaCero` : "FilaCero";
  }, [resultado.route]);

  let vista = null;
  if (resultado.notFound) vista = <NotFoundPage />;
  else if (resultado.forbidden) vista = <ForbiddenPage usuario={usuario} onSalir={alSalir} />;
  else if (resultado.route) {
    const Pagina = resultado.route.page;
    vista = (
      <Pagina
        usuario={usuario}
        params={resultado.params}
        onIngresar={alIngresar}
        onSalir={alSalir}
        onUsuario={alActualizarUsuario}
      />
    );
  }

  return (
    <ToastProvider>
      {vista}
      {servidorLento && (
        <div className="aviso-servidor" role="status">
          <span className="aviso-servidor__punto" aria-hidden="true" />
          Conectando con el servidor… la primera carga puede tardar hasta un minuto.
        </div>
      )}
    </ToastProvider>
  );
}
