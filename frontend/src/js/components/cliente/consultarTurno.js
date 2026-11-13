/**
 * Consulta del ciudadano, por código del turno o por celular (con código OTP).
 *   - Por código: muestra el turno, su espera estimada y permite cancelarlo.
 *   - Por celular: lista turnos, equipos y reclamos asociados a ese número.
 *
 *   montarConsultar(contenedor, { inicial, onResultado }) -> función de limpieza
 */
import {
  cancelarTurno, consultarTurno, consultarTurnosPorCelular, misEquipos, misReclamos, solicitarCodigo, verificarCodigo,
} from "../../api/publico.api.js";
import { html, pintar } from "../../utils/dom.js";
import {
  codigoTurno, ESTADOS, ESTADOS_EQUIPO, ESTADOS_RECLAMO, fechaCorta, fechaHora, fechaLarga, FLUJOS_CON_PREPARACION,
  PREPARACION, soloDigitos,
} from "../../utils/formatters.js";
import { anunciar } from "../../utils/voz.js";
import { icono } from "../ui/icon.js";
import { mensajeError } from "../ui/modal.js";

/** Lo que ve el ciudadano sobre la preparación previa (solo entregas y garantías). */
const TEXTO_PREPARACION = {
  ENTREGA: {
    PENDIENTE: "Alistaremos tu equipo antes de que llegues.",
    EN_PREPARACION: "Estamos probando y empacando tu equipo.",
    LISTO: "¡Tu equipo está listo! Trae tu cédula para recibirlo.",
    NOVEDAD: "Hay una novedad con tu equipo. Revisa el mensaje antes de ir.",
  },
  GARANTIA: {
    PENDIENTE: "Revisaremos tu garantía antes de que llegues.",
    EN_PREPARACION: "Estamos revisando tu garantía.",
    LISTO: "Garantía revisada. Trae el televisor, la factura y tu cédula.",
    NOVEDAD: "Hay una novedad con tu garantía. Revisa el mensaje antes de ir.",
  },
};

const MENSAJES = {
  ESPERANDO: "Te llamaremos en la sede. Llega unos minutos antes de tu hora.",
  LLAMADO: "¡Es tu turno! Acércate al punto de atención.",
  EN_ATENCION: "Estás siendo atendido.",
  ATENDIDO: "Tu atención finalizó. Gracias por usar FilaCero.",
  CANCELADO: "Este turno fue cancelado.",
  NO_ASISTIO: "El turno se cerró porque no te presentaste al ser llamado.",
};

const ACTIVOS = ["ESPERANDO", "LLAMADO", "EN_ATENCION"];

export function montarConsultar(contenedor, { inicial, onResultado }) {
  const s = {
    modo: "codigo",
    codigo: inicial?.codigo || "",
    celular: inicial?.celular || "",
    resultado: null,
    cargando: false,
    error: "",
    tokenConsulta: inicial?.token_verificacion || "",
    codigoConsulta: "",
    codigoPruebaConsulta: "",
    consultaEnviada: false,
    celularMasc: "",
    tokenCelular: "",
    turnos: [],
    misDatos: { equipos: [], reclamos: [] },
    pestana: "turnos",
    desdeLista: false,
    confirmarCancelar: false,
    cancelacionEnviada: false,
    codigoCancelacion: "",
    codigoPruebaCancelacion: "",
    estadoPrevio: null,
  };
  let vivo = true;
  let temporizador = null;

  const porCodigo = () => s.modo === "codigo";
  /** "Por código" no pide celular: el SMS llega al celular registrado en el turno. */
  const celularDe = () => (porCodigo() ? (inicial?.codigo === s.codigo ? s.celular : "") : s.celular);
  const verificadoCelular = () => Boolean(s.tokenCelular) && s.modo === "celular";

  function poner(resultado) {
    s.resultado = resultado;
    onResultado?.(resultado?.turno || null);
    const turno = resultado?.turno;
    // Cuando el asesor llama el turno se avisa al lector de pantalla.
    if (turno && turno.estado !== s.estadoPrevio) {
      if (s.estadoPrevio && turno.estado === "LLAMADO") {
        anunciar(`${turno.nombre ? `${turno.nombre.split(" ")[0]}, tu` : "Tu"} turno fue llamado. Acércate al punto de atención.`);
      }
      s.estadoPrevio = turno.estado;
    }
    programarActualizacion();
  }

  /** Actualización automática cada 20 s mientras el turno siga activo. */
  function programarActualizacion() {
    window.clearInterval(temporizador);
    temporizador = null;
    if (ACTIVOS.includes(s.resultado?.turno?.estado) && s.tokenConsulta) {
      temporizador = window.setInterval(() => consultar(true), 20000);
    }
  }

  function limpiarResultados() {
    s.tokenConsulta = "";
    s.consultaEnviada = false;
    s.codigoConsulta = "";
    s.turnos = [];
    s.misDatos = { equipos: [], reclamos: [] };
    poner(null);
  }

  async function consultar(silencioso = false) {
    const c = s.codigo.trim();
    if (porCodigo() ? !c : !/^3\d{9}$/.test(s.celular)) {
      if (!silencioso) {
        s.error = porCodigo() ? "Escribe el código de tu turno (TU-…)." : "Escribe el celular de la reserva.";
        render();
      }
      return;
    }
    if (!s.tokenConsulta) {
      if (silencioso || s.consultaEnviada) return;
      s.cargando = true;
      s.error = "";
      render();
      try {
        const r = porCodigo() ? await solicitarCodigo(celularDe() || null, c) : await solicitarCodigo(s.celular);
        s.celularMasc = r.celular_enmascarado || s.celular;
        s.codigoConsulta = "";
        s.codigoPruebaConsulta = r.codigo_prueba || "";
        s.consultaEnviada = true;
      } catch (e) {
        s.error = e.message;
      }
      s.cargando = false;
      render();
      contenedor.querySelector("#ct-otp")?.focus();
      return;
    }
    if (!silencioso) {
      s.cargando = true;
      s.error = "";
      render();
    }
    try {
      const r = await consultarTurno(c, porCodigo() && !inicial?.celular ? "" : s.celular, s.tokenConsulta);
      poner(r);
    } catch (e) {
      if (e.status === 400) s.tokenConsulta = "";
      if (silencioso) {
        if (e.status === 400) s.error = "La verificación expiró. Verifica tu celular nuevamente para consultar.";
      } else {
        poner(null);
        s.error = e.message;
      }
    }
    s.cargando = false;
    render();
  }

  async function verificarConsulta() {
    s.cargando = true;
    s.error = "";
    render();
    try {
      const v = await verificarCodigo(celularDe(), s.codigoConsulta, porCodigo() ? "consulta" : "consulta_celular", porCodigo() ? s.codigo.trim() : undefined);
      const token = v.token_verificacion;
      s.consultaEnviada = false;
      s.codigoConsulta = "";
      if (!porCodigo()) {
        const [r, eq, rc] = await Promise.all([
          consultarTurnosPorCelular(s.celular, token),
          misEquipos(s.celular, token).catch(() => null),
          misReclamos(s.celular, token).catch(() => null),
        ]);
        s.tokenCelular = token;
        s.turnos = r.turnos || [];
        s.misDatos = { equipos: eq?.equipos || [], reclamos: rc?.reclamos || [] };
        s.pestana = s.turnos.length ? "turnos" : s.misDatos.equipos.length ? "equipos" : "reclamos";
        s.desdeLista = false;
        s.tokenConsulta = "";
        poner(null);
        if (!s.turnos.length && !s.misDatos.equipos.length && !s.misDatos.reclamos.length) {
          s.error = "No encontramos turnos, equipos ni reclamos asociados a ese celular.";
        }
      } else {
        s.tokenConsulta = token;
        poner(await consultarTurno(s.codigo.trim(), celularDe(), token));
      }
    } catch (e) {
      s.error = e.message;
    }
    s.cargando = false;
    render();
  }

  async function enviarCodigoCancelacion() {
    s.cargando = true;
    s.error = "";
    render();
    try {
      const r = await solicitarCodigo(celularDe() || null, s.codigo.trim());
      s.celularMasc = r.celular_enmascarado || s.celular;
      s.codigoPruebaCancelacion = r.codigo_prueba || "";
      s.codigoCancelacion = "";
      s.cancelacionEnviada = true;
    } catch (e) {
      s.error = e.message;
    }
    s.cargando = false;
    render();
  }

  async function cancelar() {
    s.cargando = true;
    s.error = "";
    render();
    try {
      const v = await verificarCodigo(celularDe(), s.codigoCancelacion, "cancelacion", s.codigo.trim());
      const r = await cancelarTurno(s.codigo.trim(), celularDe(), v.token_verificacion);
      poner({ turno: r.turno, espera: null });
      s.confirmarCancelar = false;
      s.cancelacionEnviada = false;
      s.codigoCancelacion = "";
    } catch (e) {
      s.error = e.message;
    }
    s.cargando = false;
    render();
  }

  // ------------------------------------------------------------ vistas
  function vistaFormulario() {
    if (s.desdeLista && s.resultado?.turno) return "";
    return html`
      <div class="ct__modos" role="group" aria-label="Método de consulta">
        <button type="button" aria-pressed="${porCodigo()}" class="${porCodigo() ? "activo" : ""}" data-accion="modo" data-valor="codigo">${icono("ficha", 15)} Por código</button>
        <button type="button" aria-pressed="${!porCodigo()}" class="${!porCodigo() ? "activo" : ""}" data-accion="modo" data-valor="celular">${icono("celular", 15)} Por celular</button>
      </div>
      ${verificadoCelular()
        ? html`
            <div class="ct__verificado">
              <span>${icono("check", 15)} Celular <b>${s.celularMasc || s.celular}</b> verificado</span>
              <button type="button" class="enlace" data-accion="modo" data-valor="celular">Cambiar</button>
            </div>`
        : html`
            <form class="rv__fila ct__form" data-form="consultar">
              ${porCodigo()
                ? html`<label class="campo">${icono("ficha", 17)}<input id="ct-codigo" value="${s.codigo}" placeholder="Código del turno (TU-…)" aria-label="Código del turno" /></label>`
                : html`<label class="campo">${icono("celular", 17)}<input id="ct-celular" type="tel" inputmode="numeric" value="${s.celular}" placeholder="Celular de la reserva" aria-label="Celular de la reserva" /></label>`}
              <button class="btn btn--primario" ${s.cargando || s.consultaEnviada ? "disabled" : ""}>
                ${s.cargando ? "Procesando…" : s.tokenConsulta ? "Consultar" : "Enviar código"}
              </button>
            </form>`}`;
  }

  function vistaOtp() {
    if (!s.consultaEnviada) return "";
    return html`
      <div class="rv__codigo">
        <label class="campo campo--codigo">
          ${icono("llave", 17)}
          <input id="ct-otp" inputmode="numeric" autocomplete="one-time-code" value="${s.codigoConsulta}" placeholder="Código de 6 dígitos"
            aria-label="Código para consultar el turno" ${s.cargando ? "disabled" : ""} />
        </label>
        <p class="rv__nota">
          ${s.codigoPruebaConsulta
            ? html`Modo prueba: tu código es <button type="button" class="enlace" data-accion="usar-otp">${s.codigoPruebaConsulta}</button>`
            : `Te enviamos un SMS al ${s.celularMasc || s.celular}.`}
        </p>
        <button type="button" class="btn btn--primario" data-accion="verificar" ${s.cargando || s.codigoConsulta.length !== 6 ? "disabled" : ""}>Verificar y consultar</button>
      </div>`;
  }

  function vistaListas() {
    const hay = s.turnos.length || s.misDatos.equipos.length || s.misDatos.reclamos.length;
    if (!verificadoCelular() || s.desdeLista || !hay) return "";
    const pestanas = [
      ["turnos", "Turnos", "calendario", s.turnos.length],
      ["equipos", "Equipos", "tv", s.misDatos.equipos.length],
      ["reclamos", "Reclamos", "mensaje", s.misDatos.reclamos.length],
    ];
    let lista = "";
    if (s.pestana === "turnos") {
      lista = html`
        ${s.turnos.length ? "" : html`<p class="ct__vacio">No tienes turnos con este celular.</p>`}
        ${s.turnos.map((item, i) => {
          const est = ESTADOS[item.turno.estado] || {};
          return html`
            <button type="button" class="ct__turno-encontrado" data-accion="abrir-turno" data-indice="${i}">
              <span class="ct__turno-fecha"><strong>${item.turno.hora_inicio}</strong><small>${fechaCorta(item.turno.fecha)}</small></span>
              <span class="ct__turno-info"><strong>${item.turno.tramite}</strong><small><span class="mono">${codigoTurno(item.turno)}</span> · ${item.turno.sede}</small></span>
              <span class="estado estado--${est.tono}">${est.texto || item.turno.estado}</span>
              ${icono("derecha", 16, { clase: "ct__turno-flecha" })}
            </button>`;
        })}`;
    } else if (s.pestana === "equipos") {
      lista = html`
        ${s.misDatos.equipos.length ? "" : html`<p class="ct__vacio">No tienes equipos registrados con nosotros.</p>`}
        ${s.misDatos.equipos.map((e) => {
          const est = ESTADOS_EQUIPO[e.estado] || {};
          return html`
            <div class="ct__equipo">
              <span class="ct__equipo-icono">${icono("tv", 20)}</span>
              <div>
                <strong>${e.marca} ${e.modelo}</strong>
                <small><span class="mono">${e.codigo}</span> · ${e.sede}${e.origen === "GARANTIA" ? " · Garantía" : ""}</small>
                <span class="wz__progreso" aria-hidden="true">${[1, 2, 3].map((k) => html`<i class="${est.paso >= k ? "hecho" : ""}"></i>`)}</span>
                ${e.nota ? html`<small class="ct__nota">${e.nota}</small>` : ""}
              </div>
              <span class="estado estado--${est.tono}">${est.texto}</span>
            </div>`;
        })}`;
    } else {
      lista = html`
        ${s.misDatos.reclamos.length ? "" : html`<p class="ct__vacio">No tienes reclamos radicados.</p>`}
        ${s.misDatos.reclamos.map((r) => {
          const est = ESTADOS_RECLAMO[r.estado] || {};
          const ultima = [...(r.mensajes || [])].reverse().find((m) => m.autor === "ASESOR");
          return html`
            <article class="ct__reclamo">
              <header>
                <span><strong class="mono">${r.radicado}</strong><small>${r.categoria_texto} · ${fechaHora(r.fecha)}</small></span>
                <span class="estado estado--${est.tono}">${est.texto}</span>
              </header>
              <p class="ct__reclamo-texto">${r.descripcion}</p>
              ${ultima
                ? html`<p class="ct__respuesta">${icono("check", 15)}<span><b>${ultima.autor_nombre || "Asesor"}:</b> ${ultima.texto}</span></p>`
                : html`<p class="ct__nota">Un asesor de ${r.sede} lo revisará y te contactará por este medio o en la sede.</p>`}
            </article>`;
        })}`;
    }
    return html`
      <section class="ct__cel" aria-label="Lo que tienes con nosotros">
        <div class="ct__pestanas" role="tablist" aria-label="Tus registros">
          ${pestanas.map(
            ([id, texto, ic, n]) => html`
              <button type="button" role="tab" aria-selected="${s.pestana === id}" class="${s.pestana === id ? "activa" : ""}" data-accion="pestana" data-valor="${id}">
                ${icono(ic, 15)} ${texto} <small>${n}</small>
              </button>`,
          )}
        </div>
        <div class="ct__lista-turnos" role="tabpanel">${lista}</div>
      </section>`;
  }

  function vistaCancelar() {
    if (!s.confirmarCancelar) {
      return html`
        <span class="ct__auto">Se actualiza solo cada 20 segundos</span>
        <button type="button" class="btn btn--suave" data-accion="pedir-cancelar">Cancelar turno</button>`;
    }
    return html`
      ${s.cancelacionEnviada
        ? html`
            <span>Ingresa el código enviado a tu celular para cancelar.</span>
            <label class="campo campo--codigo">
              ${icono("llave", 17)}
              <input id="ct-otp-cancelar" inputmode="numeric" autocomplete="one-time-code" value="${s.codigoCancelacion}" placeholder="Código de 6 dígitos"
                aria-label="Código para cancelar el turno" ${s.cargando ? "disabled" : ""} />
            </label>
            ${s.codigoPruebaCancelacion
              ? html`<p class="rv__nota">Modo prueba: tu código es <button type="button" class="enlace" data-accion="usar-otp-cancelar">${s.codigoPruebaCancelacion}</button></p>`
              : ""}
            <button type="button" class="btn btn--peligro" data-accion="cancelar" ${s.cargando || s.codigoCancelacion.length !== 6 ? "disabled" : ""}>Verificar y cancelar</button>`
        : html`
            <span>Verifica tu celular para liberar el cupo.</span>
            <button type="button" class="btn btn--peligro" data-accion="codigo-cancelar" ${s.cargando ? "disabled" : ""}>Enviar código</button>`}
      <button type="button" class="btn btn--suave" data-accion="no-cancelar">No</button>`;
  }

  function vistaTurno() {
    const turno = s.resultado?.turno;
    if (!turno) return "";
    const espera = s.resultado?.espera;
    const estado = ESTADOS[turno.estado] || {};
    const prep = turno.preparacion;
    return html`
      ${s.desdeLista ? html`<button type="button" class="ct__volver" data-accion="volver">${icono("izquierda", 16)} Volver a mis turnos</button>` : ""}
      <section tabindex="-1" class="ct__resultado tono-${estado.tono}" aria-live="polite" data-detalle>
        <header class="ct__cabeza">
          <div>
            <span class="ct__codigo">${codigoTurno(turno)}</span>
            <h2>${fechaLarga(turno.fecha)}, ${turno.hora_inicio}</h2>
          </div>
          <span class="estado estado--${estado.tono}">${estado.texto}</span>
        </header>
        ${turno.estado === "ESPERANDO" && espera
          ? html`
              <div class="ct__espera">
                <div><strong>${espera.turnos_antes}</strong><span>${espera.turnos_antes === 1 ? "persona antes que tú" : "personas antes que tú"}</span></div>
                <div><strong>~${espera.tiempo_estimado_minutos} min</strong><span>de espera estimada en sede</span></div>
              </div>`
          : ""}
        <div class="ct__fila-mensaje"><p class="ct__mensaje">${MENSAJES[turno.estado]}</p></div>
        ${turno.equipo
          ? html`
              <div class="ct__equipo">
                <span class="ct__equipo-icono">${icono("tv", 20)}</span>
                <div><strong>${turno.equipo.marca} ${turno.equipo.modelo}</strong><small><span class="mono">${turno.equipo.codigo}</span> · ${ESTADOS_EQUIPO[turno.equipo.estado]?.texto}</small></div>
              </div>`
          : ""}
        ${turno.reclamo
          ? html`<p class="ct__nota">${icono("mensaje", 14)} Reclamo <span class="mono">${turno.reclamo.radicado}</span> · ${turno.reclamo.estado_texto}. El asesor lo tendrá a la mano.</p>`
          : ""}
        ${prep && FLUJOS_CON_PREPARACION.includes(turno.tramite_flujo) && ACTIVOS.includes(turno.estado)
          ? html`
              <div class="ct__prep ct__prep--${PREPARACION[prep.estado]?.tono}" role="status">
                ${icono(turno.tramite_flujo === "GARANTIA" ? "escudo2" : "paquete", 20)}
                <div><strong>${TEXTO_PREPARACION[turno.tramite_flujo][prep.estado]}</strong>${prep.nota ? html`<p>${prep.nota}</p>` : ""}</div>
              </div>`
          : ""}
        <dl class="ct__datos">
          <div><dt>Sede</dt><dd>${turno.sede}${turno.direccion ? ` · ${turno.direccion}` : ""}</dd></div>
          <div><dt>Servicio</dt><dd>${turno.tramite}</dd></div>
          <div><dt>A nombre de</dt><dd>${turno.nombre} (${turno.celular})</dd></div>
        </dl>
        ${turno.estado === "ESPERANDO" ? html`<div class="ct__acciones">${vistaCancelar()}</div>` : ""}
      </section>`;
  }

  let yaPintado = false;
  function render() {
    if (!vivo) return;
    const nada = !s.resultado?.turno && !s.error && !s.turnos.length && !s.misDatos.equipos.length && !s.misDatos.reclamos.length;
    pintar(
      contenedor,
      html`
        <div class="ct ${yaPintado ? "repintado" : ""}">
          ${vistaFormulario()}
          ${vistaOtp()}
          ${mensajeError(s.error)}
          ${vistaListas()}
          ${nada
            ? html`<p class="ct__ayuda">${porCodigo()
                ? "Escribe el código de tu turno (TU-…). Te enviaremos un SMS al celular con el que reservaste."
                : "Ingresa tu celular registrado. Te enviaremos un SMS y mostraremos tus turnos, equipos y reclamos después de verificarlo."}</p>`
            : ""}
          ${vistaTurno()}
        </div>`,
    );
    yaPintado = true;
  }

  // ------------------------------------------------------------ eventos
  const acciones = {
    modo: (b) => {
      s.modo = b.dataset.valor;
      s.tokenCelular = "";
      s.error = "";
      s.desdeLista = false;
      limpiarResultados();
      render();
    },
    "usar-otp": () => {
      s.codigoConsulta = s.codigoPruebaConsulta;
      render();
    },
    verificar: verificarConsulta,
    pestana: (b) => {
      s.pestana = b.dataset.valor;
      render();
    },
    "abrir-turno": (b) => {
      const item = s.turnos[Number(b.dataset.indice)];
      s.codigo = item.turno.codigo;
      s.tokenConsulta = "";
      s.confirmarCancelar = false;
      s.desdeLista = true;
      poner(item);
      render();
      const detalle = contenedor.querySelector("[data-detalle]");
      detalle?.scrollIntoView({ behavior: "smooth", block: "start" });
      detalle?.focus({ preventScroll: true });
    },
    volver: () => {
      s.desdeLista = false;
      s.confirmarCancelar = false;
      poner(null);
      render();
    },
    "pedir-cancelar": () => {
      s.confirmarCancelar = true;
      render();
    },
    "no-cancelar": () => {
      s.confirmarCancelar = false;
      s.cancelacionEnviada = false;
      s.codigoCancelacion = "";
      render();
    },
    "codigo-cancelar": enviarCodigoCancelacion,
    "usar-otp-cancelar": () => {
      s.codigoCancelacion = s.codigoPruebaCancelacion;
      render();
    },
    cancelar,
  };

  contenedor.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (b && !b.disabled && acciones[b.dataset.accion]) acciones[b.dataset.accion](b);
  });
  contenedor.addEventListener("submit", (e) => {
    if (e.target.dataset.form !== "consultar") return;
    e.preventDefault();
    consultar();
  });
  contenedor.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "ct-codigo") {
      s.codigo = el.value.toUpperCase().slice(0, 30);
      limpiarResultados();
    } else if (el.id === "ct-celular") {
      s.celular = soloDigitos(el.value, 10);
      limpiarResultados();
    } else if (el.id === "ct-otp") s.codigoConsulta = soloDigitos(el.value, 6);
    else if (el.id === "ct-otp-cancelar") s.codigoCancelacion = soloDigitos(el.value, 6);
    else return;
    render();
  });

  render();
  // Consulta inmediata cuando viene de una reserva recién hecha.
  if (inicial?.codigo && inicial?.celular && inicial?.token_verificacion) consultar(false);

  return () => {
    vivo = false;
    window.clearInterval(temporizador);
  };
}
