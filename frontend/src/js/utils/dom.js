/**
 * Utilidades para pintar HTML de forma segura con JavaScript puro.
 *
 *   html`<p>${texto}</p>`  -> escapa todo lo que se interpola (evita XSS)
 *   crudo(cadena)          -> marca un fragmento como HTML ya seguro (iconos, otros html``)
 *   pintar(el, contenido)  -> reemplaza el contenido conservando el foco del campo activo
 *   delegar(el, evento, acciones) -> un solo listener por contenedor con data-accion
 */

class Crudo {
  constructor(texto) {
    this.texto = texto;
  }
  toString() {
    return this.texto;
  }
}

/** Marca una cadena como HTML seguro (no se escapa). */
export const crudo = (texto) => new Crudo(String(texto ?? ""));

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapa un texto para insertarlo dentro de HTML. */
export function esc(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function convertir(valor) {
  if (valor === null || valor === undefined || valor === false || valor === true) return "";
  if (valor instanceof Crudo) return valor.texto;
  if (Array.isArray(valor)) return valor.map(convertir).join("");
  return esc(valor);
}

/** Plantilla etiquetada: escapa las interpolaciones y devuelve HTML seguro. */
export function html(partes, ...valores) {
  let salida = partes[0];
  valores.forEach((valor, i) => {
    salida += convertir(valor) + partes[i + 1];
  });
  return new Crudo(salida);
}

/** Atributos de clase: clases("btn", activo && "activo") -> "btn activo". */
export const clases = (...lista) => lista.filter(Boolean).join(" ");

/**
 * Reemplaza el contenido de un elemento. Si el foco estaba en un campo
 * dentro de él (identificado por id o data-campo), lo devuelve al mismo
 * campo y con el cursor en la misma posición: así se puede volver a pintar
 * mientras la persona escribe.
 */
export function pintar(elemento, contenido) {
  if (!elemento) return;
  const activo = document.activeElement;
  let clave = null;
  let seleccion = null;
  if (activo && elemento.contains(activo)) {
    clave = activo.id ? `#${CSS.escape(activo.id)}` : activo.dataset?.campo ? `[data-campo="${activo.dataset.campo}"]` : null;
    try {
      seleccion = [activo.selectionStart, activo.selectionEnd];
    } catch {
      seleccion = null;
    }
  }
  elemento.innerHTML = String(contenido);
  if (clave) {
    const nuevo = elemento.querySelector(clave);
    if (nuevo && !nuevo.disabled) {
      nuevo.focus({ preventScroll: true });
      if (seleccion && seleccion[0] != null && typeof nuevo.setSelectionRange === "function") {
        try {
          nuevo.setSelectionRange(seleccion[0], seleccion[1]);
        } catch {
          /* algunos tipos de input no admiten selección */
        }
      } else if ("value" in nuevo && nuevo.value) {
        // type="email" y type="number" no exponen la posición del cursor: el
        // navegador lo deja al inicio y lo escrito saldría al revés. Reasignar
        // el valor deja el cursor al final, donde la persona estaba escribiendo.
        const valor = nuevo.value;
        nuevo.value = "";
        nuevo.value = valor;
      }
    }
  }
}

/**
 * Igual que pintar(), pero solo toca el DOM si el HTML cambió. Útil en
 * pantallas que se actualizan cada pocos segundos: si los datos no cambiaron,
 * no se interrumpe a la persona (desplegables abiertos, hover, animaciones).
 */
export function pintarSiCambia(elemento, contenido) {
  if (!elemento) return false;
  const texto = String(contenido);
  if (elemento.__ultimoHTML === texto) return false;
  elemento.__ultimoHTML = texto;
  pintar(elemento, texto);
  return true;
}

/**
 * Delegación de eventos: un solo listener por contenedor.
 * Los botones llevan data-accion="nombre" y el mapa ejecuta acciones[nombre](elemento, evento).
 * Devuelve una función para quitar el listener.
 */
export function delegar(contenedor, evento, acciones, atributo = "accion") {
  const manejador = (e) => {
    const objetivo = e.target.closest(`[data-${atributo}]`);
    if (!objetivo || !contenedor.contains(objetivo)) return;
    const fn = acciones[objetivo.dataset[atributo]];
    if (fn) fn(objetivo, e);
  };
  contenedor.addEventListener(evento, manejador);
  return () => contenedor.removeEventListener(evento, manejador);
}

/** Crea un elemento a partir de HTML (primer nodo). */
export function crearElemento(contenido) {
  const plantilla = document.createElement("template");
  plantilla.innerHTML = String(contenido).trim();
  return plantilla.content.firstElementChild;
}

/** Selectores enfocables (para atrapar el foco en ventanas). */
export const ENFOCABLES =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Mantiene Tab y Shift+Tab dentro de un contenedor (ventanas modales). */
export function atraparFoco(contenedor, e) {
  if (e.key !== "Tab") return;
  const lista = [...contenedor.querySelectorAll(ENFOCABLES)];
  if (!lista.length) return;
  const primero = lista[0];
  const ultimo = lista[lista.length - 1];
  if (e.shiftKey && document.activeElement === primero) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && document.activeElement === ultimo) {
    e.preventDefault();
    primero.focus();
  }
}
