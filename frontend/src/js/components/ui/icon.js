/**
 * Iconos SVG en línea (sin dependencias). Trazo de 1.8 px.
 *   icono("check", 16)  -> HTML seguro listo para insertar con html``.
 */
import { crudo } from "../../utils/dom.js";

const TRAZOS = {
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" />',
  servicio: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z" />',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" />',
  reloj: '<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />',
  usuario: '<circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />',
  celular: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4" /><path d="M11 17.6h2" />',
  check: '<path d="m5 12.5 4.2 4.2L19 7" />',
  abajo: '<path d="m6 9 6 6 6-6" />',
  izquierda: '<path d="m15 6-6 6 6 6" />',
  derecha: '<path d="m9 6 6 6-6 6" />',
  buscar: '<circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" />',
  cerrar: '<path d="M6 6l12 12M18 6 6 18" />',
  editar: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" />',
  eliminar: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />',
  mas: '<path d="M12 5v14M5 12h14" />',
  salir: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10" />',
  alerta: '<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5M12 16.2v.3" />',
  ficha: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5V7Z" /><path d="M14 5v14" stroke-dasharray="2 2.2" />',
  personas: '<circle cx="9" cy="8.5" r="3.3" /><path d="M2.8 19.5c.9-3.3 3.3-4.8 6.2-4.8s5.3 1.5 6.2 4.8" /><path d="M15.5 5.5a3.2 3.2 0 0 1 0 6.2M17.6 14.9c1.8.6 3 2 3.6 4.6" />',
  grafica: '<path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" />',
  lista: '<path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r=".9" /><circle cx="4.5" cy="12" r=".9" /><circle cx="4.5" cy="18" r=".9" />',
  edificio: '<path d="M4 20.5h16M6 20.5V5.5L13 3v17.5M13 8.5l5 1.8v10.2" /><path d="M9 8h1M9 11.5h1M9 15h1" />',
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z" />',
  detener: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />',
  ausente: '<circle cx="10" cy="8" r="3.6" /><path d="M3.5 20c1-3.6 3.6-5.3 6.5-5.3 1.4 0 2.7.4 3.8 1.2M16 15l5 5M21 15l-5 5" />',
  deshacer: '<path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />',
  campana: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5ZM10 20.5a2 2 0 0 0 4 0" />',
  escudo: '<path d="M12 3 5 6v5.5c0 4.3 3 7.7 7 9.5 4-1.8 7-5.2 7-9.5V6l-7-3Z" />',
  llave: '<circle cx="8" cy="15" r="4" /><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" />',
  filtro: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z" />',
  copiar: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />',
  actividad: '<path d="M3 12h4l3-7 4 14 3-7h4" />',
  accesibilidad: '<circle cx="12" cy="4.5" r="1.8" /><path d="M5 8.5c2.3.7 4.6 1 7 1s4.7-.3 7-1M12 9.5v4.5M12 14l-3 6.5M12 14l3 6.5" />',
  pantalla: '<rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8.5 20h7M12 16.5V20" />',
  cafe: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" /><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12.5 3.5v2.5" />',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" />',
  escudo2: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" />',
  mensaje: '<path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12.5h5" />',
  enviar: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />',
  silencio: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" />',
  paquete: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9M7.8 5.3l8.4 4.5" />',
  encender: '<path d="M12 3.5V12" /><path d="M7 6.5a7 7 0 1 0 10 0" />',
  ver: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />',
  volumen: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />',
  externo: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />',
  menu: '<path d="M4 7h16M4 12h16M4 17h16" />',
  rayo: '<path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z" />',
  subir: '<path d="M7 14.5 12 9.5l5 5" />',
  bajar: '<path d="M7 9.5 12 14.5l5-5" />',
  // Ciclo de atención (mismo trazo y estilo en consola, asistente y cola)
  megafono: '<path d="M4 10.2v3.6a1 1 0 0 0 1 1h2.2L15 19V5L7.2 9.2H5a1 1 0 0 0-1 1Z" /><path d="m7.8 14.8 1.4 4.7h2.4l-1.1-3.9M18.5 9.5a3.5 3.5 0 0 1 0 5" />',
  atender: '<path d="M4.8 13.5V12a7.2 7.2 0 0 1 14.4 0v1.5" /><rect x="3.5" y="13" width="3.8" height="5.8" rx="1.4" /><rect x="16.7" y="13" width="3.8" height="5.8" rx="1.4" /><path d="M18.6 18.8c0 1.5-1.8 2.2-4.6 2.2h-1.5" />',
  finalizado: '<circle cx="12" cy="12" r="8.5" /><path d="m8.3 12.2 2.6 2.6 4.9-5.1" />',
  // Asistente IA
  chispa: '<path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15A2 2 0 0 0 9 13.8L3.5 12 9 10.2A2 2 0 0 0 10.2 9L12 3.5Z" /><path d="M19 3v3M17.5 4.5h3" />',
  microfono: '<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />',
  borrar: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4.5h4.5" />',
};

export function icono(nombre, tamano = 18, { clase = "", grosor = 1.8, titulo = "" } = {}) {
  const contenido = TRAZOS[nombre] || "";
  const accesible = titulo ? `role="img"><title>${titulo}</title>` : 'aria-hidden="true">';
  return crudo(
    `<svg class="fc-icon ${clase}" width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round" ${accesible}${contenido}</svg>`,
  );
}
