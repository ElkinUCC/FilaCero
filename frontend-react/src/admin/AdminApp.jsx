import { useState } from "react";
import { MenuAccesibilidad, SaltarAlContenido } from "../ui/Accesibilidad";
import { CambiarMiClave } from "../ui/CambiarClave";
import Icon from "../ui/Icon";
import { useToast } from "../ui/Toast";
import Actividad from "./Actividad";
import Agentes from "./Agentes";
import Catalogo from "./Catalogo";
import Historial from "./Historial";
import Resumen from "./Resumen";
import Usuarios from "./Usuarios";
import "./Admin.css";

// solo: roles que ven la sección (por defecto, todo el personal del panel).
const SECCIONES = [
  { id: "resumen", texto: "Resumen", icono: "grafica", Comp: Resumen },
  { id: "sedes", texto: "Sedes", icono: "edificio", Comp: (p) => <Catalogo tipo="sedes" {...p} /> },
  { id: "tramites", texto: "Trámites", icono: "servicio", Comp: (p) => <Catalogo tipo="tramites" {...p} /> },
  { id: "agentes", texto: "Asesores", icono: "personas", Comp: Agentes },
  { id: "historial", texto: "Historial", icono: "lista", Comp: Historial },
  { id: "usuarios", texto: "Usuarios y permisos", icono: "escudo", Comp: Usuarios, solo: ["ADMIN"], grupo: "Seguridad" },
  { id: "actividad", texto: "Actividad", icono: "actividad", Comp: Actividad, solo: ["ADMIN"], grupo: "Seguridad" },
];

export default function AdminApp({ usuario, onSalir, onUsuario }) {
  const avisar = useToast();
  const [seccion, setSeccion] = useState("resumen");
  const [menu, setMenu] = useState(false);
  const [cambiarClave, setCambiarClave] = useState(false);
  const soloLectura = usuario.rol !== "ADMIN";
  const visibles = SECCIONES.filter((s) => !s.solo || s.solo.includes(usuario.rol));
  const actual = visibles.find((s) => s.id === seccion) || visibles[0];
  const Comp = actual.Comp;

  return (
    <div className={`adm ${menu ? "adm--menu" : ""}`}>
      <SaltarAlContenido />
      <aside className="adm__lado" aria-label="Menú principal">
        <div className="marca">
          <span className="marca__logo" aria-hidden="true">F0</span>
          <span className="marca__nombre">FilaCero</span>
        </div>
        <nav className="adm__nav" aria-label="Administración">
          {visibles.map((s, i) => (
            <div key={s.id} className="adm__nav-item">
            {s.grupo && s.grupo !== visibles[i - 1]?.grupo && <span className="adm__nav-grupo">{s.grupo}</span>}
            <button
              className={actual.id === s.id ? "activo" : ""}
              aria-current={actual.id === s.id ? "page" : undefined}
              onClick={() => { setSeccion(s.id); setMenu(false); document.getElementById("contenido")?.focus(); }}
            >
              <Icon name={s.icono} size={18} /> {s.texto}
            </button>
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
        <Comp key={actual.id} titulo={actual.texto} soloLectura={soloLectura} />
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

/** Encabezado de sección con indicador "en vivo" (sin botón de actualizar). */
export function Encabezado({ titulo, detalle, actualizado, error, children }) {
  return (
    <header className="adm__cabeza">
      <div>
        <h1>{titulo}</h1>
        {detalle && <p>{detalle}</p>}
      </div>
      <div className="adm__cabeza-der">
        <span className={`en-vivo ${error ? "en-vivo--error" : ""}`} title={error || undefined}>
          {error ? "Sin conexión, reintentando" : actualizado ? `En vivo · ${actualizado.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Conectando…"}
        </span>
        {children}
      </div>
    </header>
  );
}
