import { CambioObligatorio } from "../components/ui/CambiarClave";
import "../css/cliente.css";

/** Cambio obligatorio de la contraseña temporal. Ruta: /cambiar-clave */
export default function CambioClavePage({ usuario, onUsuario, onSalir }) {
  return <CambioObligatorio usuario={usuario} onListo={onUsuario} onSalir={onSalir} />;
}
