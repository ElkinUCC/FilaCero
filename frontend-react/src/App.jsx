import { useEffect, useState } from "react";
import AdminApp from "./admin/AdminApp";
import Consola from "./agente/Consola";
import { api, cerrarSesion, EVENTO_SESION_EXPIRADA, obtenerUsuario } from "./api";
import PortalPublico from "./cliente/PortalPublico";
import Sala from "./sala/Sala";
import { CambioObligatorio } from "./ui/CambiarClave";
import { ToastProvider } from "./ui/Toast";

export default function App() {
  const [usuario, setUsuario] = useState(obtenerUsuario);

  // Si el token vence (o el usuario fue desactivado) se vuelve al portal.
  useEffect(() => {
    const salir = () => setUsuario(null);
    window.addEventListener(EVENTO_SESION_EXPIRADA, salir);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, salir);
  }, []);

  function salir() {
    // Revoca el token en el servidor; si falla (sin red), igual se cierra aquí.
    api.post("/usuarios/logout", {}).catch(() => {}).finally(() => {
      cerrarSesion();
      setUsuario(null);
    });
  }

  // Pantalla pública de sala de espera (televisor de cada sede).
  if (window.location.pathname.startsWith("/sala")) return <ToastProvider><Sala /></ToastProvider>;

  let vista;
  if (usuario?.debe_cambiar_clave) {
    vista = <CambioObligatorio usuario={usuario} onListo={setUsuario} onSalir={salir} />;
  } else if (usuario?.rol === "ADMIN" || usuario?.rol === "SUPERVISOR") {
    vista = <AdminApp usuario={usuario} onSalir={salir} onUsuario={setUsuario} />;
  } else if (usuario?.rol === "AGENTE") {
    vista = <Consola usuario={usuario} onSalir={salir} />;
  } else {
    vista = <PortalPublico onIngresar={setUsuario} />;
  }

  return <ToastProvider>{vista}</ToastProvider>;
}
