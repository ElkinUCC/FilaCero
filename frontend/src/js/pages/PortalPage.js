/** Portal del ciudadano: reservar y consultar turno sin crear cuenta. */
import { obtenerHorario } from "../api/publico.api.js";
import { montarConsultar } from "../components/cliente/consultarTurno.js";
import { fichaHTML } from "../components/cliente/ficha.js";
import { abrirLogin } from "../components/cliente/login.js";
import { montarReservar } from "../components/cliente/reservarTurno.js";
import { marca, saltarAlContenido } from "../components/layout/marca.js";
import { icono } from "../components/ui/icon.js";
import { cambiarQuery, rutaActual } from "../router/navegacion.js";
import { html, pintar } from "../utils/dom.js";
import { codigoTurno } from "../utils/formatters.js";
import { teclasPestanas } from "../utils/voz.js";

export function PortalPage() {
  return html`
    <div class="portal">
      ${saltarAlContenido()}
      <header class="portal__barra">
        ${marca()}
        <span class="portal__horario">${icono("reloj", 15)} <span data-horario>Consultando horario…</span></span>
        <button type="button" class="portal__personal" data-login>${icono("llave", 15)} Acceso personal</button>
      </header>

      <main class="portal__cuerpo" id="contenido" tabindex="-1">
        <aside class="portal__lado">
          <div class="portal__intro">
            <h1>Reserva tu turno y llega a tu hora.</h1>
            <p>Elige sede, servicio y horario. Verificamos tu celular y te damos un código para presentarte en el punto de atención. No necesitas crear cuenta.</p>
          </div>
          <div data-ficha>${fichaHTML()}</div>
        </aside>

        <section class="portal__panel" aria-label="Turnos">
          <div class="pestanas" role="tablist" aria-label="Opciones de turno" data-pestanas>
            <button role="tab" id="tab-reservar" aria-controls="panel-turnos" data-vista="reservar">${icono("calendario", 16)} Reservar turno</button>
            <button role="tab" id="tab-consultar" aria-controls="panel-turnos" data-vista="consultar">${icono("buscar", 16)} Consultar mi turno</button>
          </div>
          <div class="portal__contenido" role="tabpanel" id="panel-turnos" data-contenido></div>
        </section>
      </main>
    </div>`;
}

export function mountPortalPage({ onIngresar }) {
  const raiz = document.querySelector(".portal");
  const contenido = raiz.querySelector("[data-contenido]");
  const ficha = raiz.querySelector("[data-ficha]");
  const pestanas = raiz.querySelector("[data-pestanas]");
  const estado = { vista: "reservar", confirmado: null, consultaInicial: null };
  let limpiarVista = null;
  let cerrarLogin = null;

  obtenerHorario()
    .then((h) => {
      raiz.querySelector("[data-horario]").textContent = `${h.todos_los_dias ? "Todos los días" : "Lunes a viernes"}, ${h.hora_apertura} a ${h.hora_cierre}`;
    })
    .catch(() => {});

  /** Turno reservado: muestra el código y la ficha "impresa". */
  function vistaListo() {
    const { turno } = estado.confirmado;
    return html`
      <div class="listo" role="status">
        <span class="listo__icono">${icono("check", 26, { grosor: 2.4 })}</span>
        <h2>Turno reservado</h2>
        <p>Guarda este código. Lo necesitas para consultar o cancelar tu turno.</p>
        <div class="listo__codigo">${codigoTurno(turno)}</div>
        ${fichaHTML({ turno })}
        <div class="listo__acciones">
          <button class="btn btn--primario" data-accion="ver-estado">Ver estado del turno</button>
          <button class="btn btn--suave" data-accion="reservar-otro">Reservar otro</button>
        </div>
      </div>`;
  }

  function mostrar(vista) {
    limpiarVista?.();
    limpiarVista = null;
    estado.vista = vista;
    pestanas.querySelectorAll("[role=tab]").forEach((b) => {
      const activa = b.dataset.vista === vista;
      b.classList.toggle("activa", activa);
      b.setAttribute("aria-selected", activa);
      b.tabIndex = activa ? 0 : -1;
    });
    contenido.setAttribute("aria-labelledby", `tab-${vista}`);

    // Cada vista se monta en un contenedor nuevo para no mezclar sus eventos.
    contenido.innerHTML = "";
    const caja = document.createElement("div");
    contenido.appendChild(caja);

    if (vista === "reservar" && estado.confirmado) {
      pintar(caja, vistaListo());
      pintar(ficha, fichaHTML({ turno: estado.confirmado.turno }));
    } else if (vista === "reservar") {
      pintar(ficha, fichaHTML());
      limpiarVista = montarReservar(caja, {
        onResumen: (resumen) => pintar(ficha, fichaHTML({ resumen })),
        onConfirmado: (turno, celular, espera, tokenConsulta) => {
          estado.confirmado = { turno, celular, espera, tokenConsulta };
          mostrar("reservar");
        },
      });
    } else {
      pintar(ficha, fichaHTML());
      limpiarVista = montarConsultar(caja, {
        inicial: estado.consultaInicial,
        onResultado: (turno) => pintar(ficha, fichaHTML({ turno })),
      });
      estado.consultaInicial = null;
    }
  }

  contenido.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    if (b.dataset.accion === "ver-estado") {
      const c = estado.confirmado;
      estado.consultaInicial = { codigo: c.turno.codigo, celular: c.celular, token_verificacion: c.tokenConsulta };
      estado.confirmado = null;
      mostrar("consultar");
    } else if (b.dataset.accion === "reservar-otro") {
      estado.confirmado = null;
      mostrar("reservar");
    }
  });
  pestanas.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vista]");
    if (b && b.dataset.vista !== estado.vista) mostrar(b.dataset.vista);
  });
  pestanas.addEventListener("keydown", teclasPestanas);

  function login() {
    if (cerrarLogin) return;
    cerrarLogin = abrirLogin({
      onIngresar,
      alCerrar: () => {
        cerrarLogin = null;
        cambiarQuery({ ingresar: "" });
      },
    });
  }
  raiz.querySelector("[data-login]").addEventListener("click", login);
  if (rutaActual().query.has("ingresar")) login();

  mostrar("reservar");

  return () => {
    limpiarVista?.();
    cerrarLogin?.();
  };
}
