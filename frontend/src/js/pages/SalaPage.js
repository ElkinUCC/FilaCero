/**
 * Pantalla del televisor de la sala de espera (pública). Ruta: #/sala?sede=<id>
 * Muestra el turno llamado, el módulo y los próximos turnos. La voz del
 * llamado la emite la consola del asesor (ADR-009).
 */
import { pantallaSala } from "../api/publico.api.js";
import { marca } from "../components/layout/marca.js";
import { html, pintar } from "../utils/dom.js";
import { ZONA } from "../utils/formatters.js";
import { crearSondeo } from "../utils/polling.js";
import { cambiarQuery, rutaActual } from "../router/navegacion.js";
import { articuloModulo } from "../utils/voz.js";

const reloj = () =>
  new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA }).format(new Date());

/** "TU-3AB745": el prefijo va pequeño para que el código no se parta en la pantalla. */
function codigo(c) {
  const texto = String(c || "");
  if (!texto.startsWith("TU-")) return html`${texto}`;
  return html`<small class="sala__prefijo">TU-</small>${texto.slice(3)}`;
}

export function SalaPage() {
  return html`<div data-sala></div>`;
}

function vistaElegirSede(datos) {
  return html`
    <main class="sala sala--elegir">
      <h1>Pantalla de sala de espera</h1>
      <p>Elige la sede que mostrará este televisor.</p>
      <div class="sala__sedes">
        ${(datos.sedes || []).map((s) => html`<button class="btn btn--primario btn--grande" data-sede="${s.id}">${s.nombre}</button>`)}
      </div>
    </main>`;
}

function vistaSala(datos, error, repintado) {
  const actual = datos?.llamados?.[0];
  const anteriores = (datos?.llamados || []).slice(1, 5);
  const siguientes = datos?.siguientes || [];
  return html`
    <main class="sala ${repintado ? "repintado" : ""}">
      <header class="sala__barra">
        ${marca()}
        <h1 class="sala__sede">${datos?.sede?.nombre || "Cargando…"}</h1>
        <time class="sala__hora" data-reloj>${reloj()}</time>
      </header>
      ${error ? html`<p class="sala__error" role="alert">Sin conexión con el servidor. Reintentando…</p>` : ""}
      <section class="sala__cuerpo">
        <div class="sala__actual ${actual?.estado === "LLAMADO" ? "sala__actual--llamando" : ""}" aria-live="assertive" aria-atomic="true">
          ${actual
            ? html`
                <span class="sala__etiqueta">${actual.estado === "LLAMADO" ? "Turno llamado" : "En atención"}</span>
                <strong class="sala__codigo">${codigo(actual.codigo)}</strong>
                <p class="sala__nombre">${actual.nombre}</p>
                <p class="sala__destino">
                  ${actual.modulo
                    ? html`Acérquese ${articuloModulo(actual.modulo)} <b>${actual.modulo}</b>`
                    : html`Acérquese con <b>${actual.asesor}</b>`}
                </p>
                ${actual.modulo ? html`<p class="sala__asesor">Le atiende ${actual.asesor}</p>` : ""}`
            : html`
                <span class="sala__etiqueta">Sala de espera</span>
                <p class="sala__nombre">Pronto llamaremos al siguiente turno.</p>
                <p class="sala__destino">Ten a mano el código de tu reserva.</p>`}
        </div>
        <div class="sala__lado">
          <section aria-labelledby="sala-anteriores">
            <h2 id="sala-anteriores">Llamados recientes</h2>
            <ul>
              ${anteriores.map((t) => html`<li><b>${codigo(t.codigo)}</b><span class="sala__persona">${t.nombre}</span><span>${t.modulo || t.asesor}</span></li>`)}
              ${anteriores.length ? "" : html`<li class="sala__vacio">—</li>`}
            </ul>
          </section>
          <section aria-labelledby="sala-siguientes">
            <h2 id="sala-siguientes">Próximos turnos</h2>
            <ul>
              ${siguientes.map((t) => html`<li><b>${codigo(t.codigo)}</b><span class="sala__persona">${t.nombre}</span><span>${t.hora}</span></li>`)}
              ${siguientes.length ? "" : html`<li class="sala__vacio">No hay más turnos hoy</li>`}
            </ul>
          </section>
        </div>
      </section>
      <footer class="sala__pie">
        Reserva tu turno en línea y llega a tu hora · Atención ${datos?.horario?.todos_los_dias ? "todos los días" : ""}
        ${datos?.horario?.hora_apertura || ""}–${datos?.horario?.hora_cierre || ""}
      </footer>
    </main>`;
}

export function mountSalaPage() {
  const raiz = document.querySelector("[data-sala]");
  let sedeId = rutaActual().query.get("sede") || "";
  let ultimoLlamado = null;

  const sondeo = crearSondeo(() => pantallaSala(sedeId), 4000, ({ datos, error }) => {
    if (datos && !datos.sede) pintar(raiz, vistaElegirSede(datos));
    else {
      // El código grande solo se anima cuando cambia el turno llamado.
      const clave = datos?.llamados?.[0] ? `${datos.llamados[0].id}-${datos.llamados[0].estado}` : null;
      pintar(raiz, vistaSala(datos, error, clave === ultimoLlamado));
      ultimoLlamado = clave;
    }
  });

  raiz.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-sede]");
    if (!boton) return;
    sedeId = boton.dataset.sede;
    cambiarQuery({ sede: sedeId });
    sondeo.refrescar();
  });

  const temporizador = window.setInterval(() => {
    const el = raiz.querySelector("[data-reloj]");
    if (el) el.textContent = reloj();
  }, 10000);

  return () => {
    sondeo.detener();
    window.clearInterval(temporizador);
  };
}
