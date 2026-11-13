/**
 * Panel de administración. Rutas: #/admin y #/admin/:seccion (ADMIN y SUPERVISOR).
 * Cada sección tiene su propia URL; el backend vuelve a validar el rol en cada petición.
 */
import { canEdit, hasRole, ROLES } from "../auth/permissions.js";
import { montarActividad } from "../components/admin/actividad.js";
import { montarAgentes } from "../components/admin/agentes.js";
import { montarCatalogo } from "../components/admin/catalogo.js";
import { montarHistorial } from "../components/admin/historial.js";
import { montarResumen } from "../components/admin/resumen.js";
import { montarUsuarios } from "../components/admin/usuarios.js";
import { marca, saltarAlContenido } from "../components/layout/marca.js";
import { montarAsistenteIA } from "../components/ui/asistenteIA.js";
import { abrirCambiarMiClave } from "../components/ui/cambiarClave.js";
import { icono } from "../components/ui/icon.js";
import { avisar } from "../components/ui/toast.js";
import { navigate } from "../router/navegacion.js";
import { html } from "../utils/dom.js";
import { ForbiddenPage } from "./ForbiddenPage.js";
import { NotFoundPage } from "./NotFoundPage.js";

/**
 * Secciones del panel. roles: quién puede verla (por defecto ADMIN y SUPERVISOR).
 */
const SECCIONES = [
  { id: "resumen", texto: "Resumen", icono: "grafica", montar: montarResumen },
  { id: "sedes", texto: "Sedes", icono: "edificio", montar: (c, o) => montarCatalogo(c, { ...o, tipo: "sedes" }) },
  { id: "tramites", texto: "Trámites", icono: "servicio", montar: (c, o) => montarCatalogo(c, { ...o, tipo: "tramites" }) },
  { id: "agentes", texto: "Asesores", icono: "personas", montar: montarAgentes },
  { id: "historial", texto: "Historial", icono: "lista", montar: montarHistorial },
  { id: "usuarios", texto: "Usuarios y permisos", icono: "escudo", montar: montarUsuarios, roles: [ROLES.ADMIN], grupo: "Seguridad" },
  { id: "actividad", texto: "Actividad", icono: "actividad", montar: montarActividad, roles: [ROLES.ADMIN], grupo: "Seguridad" },
];

export function AdminPage({ usuario, params }) {
  const soloLectura = !canEdit(usuario);
  const visibles = SECCIONES.filter((x) => hasRole(usuario, x.roles));
  const pedida = SECCIONES.find((x) => x.id === (params.seccion || "resumen"));
  return html`
    <div class="adm">
      ${saltarAlContenido()}
      <aside class="adm__lado" aria-label="Menú principal">
        ${marca()}
        <nav class="adm__nav" aria-label="Administración">
          ${visibles.map(
            (x, i) => html`
              <div class="adm__nav-item">
                ${x.grupo && x.grupo !== visibles[i - 1]?.grupo ? html`<span class="adm__nav-grupo">${x.grupo}</span>` : ""}
                <a href="#/admin/${x.id}" class="${pedida?.id === x.id ? "activo" : ""}" ${pedida?.id === x.id ? 'aria-current="page"' : ""}>${icono(x.icono, 18)} ${x.texto}</a>
              </div>`,
          )}
        </nav>
        <div class="adm__cuenta">
          <div class="adm__usuario">
            <span class="adm__avatar">${usuario.nombre?.[0] || "A"}</span>
            <div><strong title="${usuario.nombre}">${usuario.nombre}</strong><small>${soloLectura ? "Supervisor · solo lectura" : "Administrador"}</small></div>
          </div>
          <div class="adm__cuenta-acciones">
            <button data-accion="clave">${icono("llave", 15)} Contraseña</button>
            <button data-accion="salir">${icono("salir", 15)} Salir</button>
          </div>
        </div>
      </aside>
      <main class="adm__principal" id="contenido" tabindex="-1">
        <button class="adm__hamburguesa icono-btn" data-accion="menu" aria-label="Abrir menú" aria-expanded="false">${icono("menu", 20)}</button>
        <div data-seccion></div>
      </main>
      <div class="adm__sombra" data-accion="menu" hidden></div>
      <div data-ia></div>
    </div>`;
}

export function mountAdminPage({ usuario, params, onSalir, onUsuario }) {
  const raiz = document.querySelector(".adm");
  const contenedor = raiz.querySelector("[data-seccion]");
  const pedida = SECCIONES.find((x) => x.id === (params.seccion || "resumen"));
  let limpiarSeccion = null;

  if (!pedida) contenedor.innerHTML = String(NotFoundPage({ embebida: true }));
  else if (!hasRole(usuario, pedida.roles)) contenedor.innerHTML = String(ForbiddenPage({ usuario, embebida: true }));
  else limpiarSeccion = pedida.montar(contenedor, { titulo: pedida.texto, soloLectura: !canEdit(usuario), usuario });

  function alternarMenu(abierto) {
    raiz.classList.toggle("adm--menu", abierto);
    raiz.querySelector(".adm__sombra").hidden = !abierto;
    raiz.querySelector(".adm__hamburguesa").setAttribute("aria-expanded", abierto);
  }

  raiz.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    // Las secciones manejan sus propios botones.
    if (contenedor.contains(b)) return;
    if (b.dataset.accion === "menu") alternarMenu(!raiz.classList.contains("adm--menu"));
    else if (b.dataset.accion === "salir") onSalir();
    else if (b.dataset.accion === "clave") {
      abrirCambiarMiClave({
        alListo: (u) => {
          onUsuario?.(u);
          avisar("Tu contraseña fue actualizada.");
        },
      });
    }
  });

  const asistente = montarAsistenteIA(raiz.querySelector("[data-ia]"), {
    titulo: "FilaCero IA",
    onAccion: (a) => {
      if (a.tipo === "navegar" && a.destino?.startsWith("/admin")) navigate(a.destino);
    },
  });

  return () => {
    limpiarSeccion?.();
    asistente.destruir();
  };
}
