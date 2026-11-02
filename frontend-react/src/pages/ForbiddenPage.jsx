import { homeFor } from "../auth/permissions";
import Marca from "../components/layout/Marca";
import Icon from "../components/ui/Icon";
import Enlace from "../components/layout/Enlace";
import "../css/paginas.css";

/**
 * 403: hay sesión pero el rol no alcanza. NO se cierra la sesión
 * (igual que en el proyecto de referencia).
 * embebida: se pinta dentro del panel, sin pantalla completa.
 */
export default function ForbiddenPage({ usuario, onSalir, embebida = false }) {
  const contenido = (
    <section className="aviso-pagina" aria-labelledby="titulo-403">
      <span className="aviso-pagina__icono aviso-pagina__icono--alerta"><Icon name="escudo" size={30} /></span>
      <p className="aviso-pagina__codigo">Error 403</p>
      <h1 id="titulo-403">No tienes permiso para ver esta sección</h1>
      <p>Tu cuenta no tiene el rol necesario. Si crees que es un error, pide a un administrador que revise tus permisos.</p>
      <div className="aviso-pagina__acciones">
        <Enlace className="btn btn--primario" href={homeFor(usuario)}>Ir a mi inicio</Enlace>
        {onSalir && <button type="button" className="btn btn--borde" onClick={onSalir}>Cerrar sesión</button>}
      </div>
    </section>
  );
  if (embebida) return contenido;
  return (
    <div className="pagina-centrada">
      <Marca />
      <main id="contenido" tabIndex={-1}>{contenido}</main>
    </div>
  );
}
