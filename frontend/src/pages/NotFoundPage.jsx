import Marca from "../components/layout/Marca";
import Icon from "../components/ui/Icon";
import Enlace from "../components/layout/Enlace";
import "../css/paginas.css";

/** 404: la dirección no existe. embebida: dentro del panel. */
export default function NotFoundPage({ embebida = false }) {
  const contenido = (
    <section className="aviso-pagina" aria-labelledby="titulo-404">
      <span className="aviso-pagina__icono"><Icon name="buscar" size={30} /></span>
      <p className="aviso-pagina__codigo">Error 404</p>
      <h1 id="titulo-404">No encontramos esta página</h1>
      <p>Puede que la dirección esté mal escrita o que la sección ya no exista.</p>
      <div className="aviso-pagina__acciones">
        <Enlace className="btn btn--primario" href={embebida ? "/admin" : "/"}>
          {embebida ? "Volver al resumen" : "Ir a reservar un turno"}
        </Enlace>
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
