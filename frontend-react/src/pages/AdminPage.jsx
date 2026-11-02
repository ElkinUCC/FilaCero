import { useState } from "react";
import { canEdit, hasRole, ROLES } from "../auth/permissions";
import Actividad from "../components/admin/Actividad";
import Agentes from "../components/admin/Agentes";
import Catalogo from "../components/admin/Catalogo";
import Historial from "../components/admin/Historial";
import Resumen from "../components/admin/Resumen";
import Usuarios from "../components/admin/Usuarios";
import Marca from "../components/layout/Marca";
import { MenuAccesibilidad, SaltarAlContenido } from "../components/ui/Accesibilidad";
import { CambiarMiClave } from "../components/ui/CambiarClave";
import Icon from "../components/ui/Icon";
import { useToast } from "../hooks/useToast";
import Enlace from "../components/layout/Enlace";
import { navegar } from "../router/navegacion";
import ForbiddenPage from "./ForbiddenPage";
import NotFoundPage from "./NotFoundPage";
import "../css/admin.css";

const SedesSeccion = (p) => <Catalogo tipo="sedes" {...p} />;
const TramitesSeccion = (p) => <Catalogo tipo="tramites" {...p} />;

/**
 * Secciones del panel. Cada una tiene su propia URL (/admin/<id>).
 * roles: quién puede verla (por defecto ADMIN y SUPERVISOR). El backend
 * vuelve a validar el rol en cada petición.
 */
const SECCIONES = [
  { id: "resumen", texto: "Resumen", icono: "grafica", Comp: Resumen },
  { id: "sedes", texto: "Sedes", icono: "edificio", Comp: SedesSeccion },
  { id: "tramites", texto: "Trámites", icono: "servicio", Comp: TramitesSeccion },
  { id: "agentes", texto: "Asesores", icono: "personas", Comp: Agentes },
  { id: "historial", texto: "Historial", icono: "lista", Comp: Historial },
  { id: "usuarios", texto: "Usuarios y permisos", icono: "escudo", Comp: Usuarios, roles: [ROLES.ADMIN], grupo: "Seguridad" },
  { id: "actividad", texto: "Actividad", icono: "actividad", Comp: Actividad, roles: [ROLES.ADMIN], grupo: "Seguridad" },
];

/** Panel de administración. Rutas: /admin y /admin/:seccion (ADMIN y SUPERVISOR). */
export default function AdminPage({ usuario, params, onSalir, onUsuario }) {
  const avisar = useToast();
  const [menu, setMenu] = useState(false);
  const [cambiarClave, setCambiarClave] = useState(false);
  const soloLectura = !canEdit(usuario);
  const visibles = SECCIONES.filter((s) => hasRole(usuario, s.roles));

  const pedida = SECCIONES.find((s) => s.id === (params.seccion || "resumen"));
  const permitida = pedida && hasRole(usuario, pedida.roles);

  function ir(e, id) {
    e.preventDefault();
    setMenu(false);
    navegar(`/admin/${id}`);
    document.getElementById("contenido")?.focus();
  }

  let contenido;
  if (!pedida) contenido = <NotFoundPage embebida />;
  else if (!permitida) contenido = <ForbiddenPage embebida usuario={usuario} />;
  else {
    const Comp = pedida.Comp;
    contenido = <Comp key={pedida.id} titulo={pedida.texto} soloLectura={soloLectura} />;
  }

  return (
    <div className={`adm ${menu ? "adm--menu" : ""}`}>
      <SaltarAlContenido />
      <aside className="adm__lado" aria-label="Menú principal">
        <Marca />
        <nav className="adm__nav" aria-label="Administración">
          {visibles.map((s, i) => (
            <div key={s.id} className="adm__nav-item">
              {s.grupo && s.grupo !== visibles[i - 1]?.grupo && <span className="adm__nav-grupo">{s.grupo}</span>}
              <Enlace
                href={`/admin/${s.id}`}
                className={pedida?.id === s.id ? "activo" : ""}
                aria-current={pedida?.id === s.id ? "page" : undefined}
                onClick={(e) => ir(e, s.id)}
              >
                <Icon name={s.icono} size={18} /> {s.texto}
              </Enlace>
            </div>
          ))}
        </nav>
        <div className="adm__cuenta">
          <div className="adm__usuario">
            <span className="adm__avatar">{usuario.nombre?.[0] || "A"}</span>
            <div>
              <strong title={usuario.nombre}>{usuario.nombre}</strong>
              <small>{soloLectura ? "Supervisor · solo lectura" : "Administrador"}</small>
            </div>
          </div>
          <MenuAccesibilidad className="adm__texto" arriba />
          <div className="adm__cuenta-acciones">
            <button onClick={() => setCambiarClave(true)}><Icon name="llave" size={15} /> Contraseña</button>
            <button onClick={onSalir}><Icon name="salir" size={15} /> Salir</button>
          </div>
        </div>
      </aside>

      <main className="adm__principal" id="contenido" tabIndex={-1}>
        <button className="adm__hamburguesa icono-btn" onClick={() => setMenu((m) => !m)} aria-label="Abrir menú" aria-expanded={menu}>
          <Icon name="menu" size={20} />
        </button>
        {contenido}
      </main>
      {menu && <div className="adm__sombra" onClick={() => setMenu(false)} />}
      {cambiarClave && (
        <CambiarMiClave
          onCerrar={() => setCambiarClave(false)}
          onListo={(u) => { onUsuario?.(u); avisar("Tu contraseña fue actualizada."); }}
        />
      )}
    </div>
  );
}
