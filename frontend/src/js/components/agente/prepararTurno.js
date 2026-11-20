/**
 * Preparación previa del turno: el asesor alista lo que el ciudadano pidió
 * (equipo, garantía…) para que la atención en el módulo sea mínima.
 * El mensaje lo verá el ciudadano al consultar su turno.
 */
import * as agenteApi from "../../api/agente.api.js";
import { html, pintar } from "../../utils/dom.js";
import { codigoTurno, fechaCorta, PREPARACION, textoPreparacion, valorRespuesta } from "../../utils/formatters.js";
import { icono } from "../ui/icon.js";
import { abrirModal, mensajeError } from "../ui/modal.js";
import { cargando } from "../ui/cargando.js";

const DETALLES = {
  ENTREGA: {
    EN_PREPARACION: "Lo estoy probando y empacando.",
    LISTO: "Probado y empacado: solo verificar cédula y entregar.",
    NOVEDAD: "Falta algo: avisa antes de que se desplace.",
  },
  GARANTIA: {
    EN_PREPARACION: "Estoy revisando la compra y la cobertura.",
    LISTO: "Cobertura verificada: al llegar se recibe el televisor.",
    NOVEDAD: "Algo no cuadra: avisa antes de que se desplace.",
  },
};
const OPCIONES = [
  { estado: "EN_PREPARACION", icono: "reloj" },
  { estado: "LISTO", icono: "check" },
  { estado: "NOVEDAD", icono: "alerta" },
  { estado: "PENDIENTE", icono: "deshacer", detalle: "Deshacer y dejarlo sin preparar." },
];
/** Mensaje sugerido para el ciudadano según el tipo de atención. */
const SUGERENCIAS = {
  ENTREGA: {
    LISTO: "Tu televisor ya fue probado y está empacado. Trae tu cédula para recibirlo.",
    NOVEDAD: "Falta un repuesto para terminar. Te contactaremos para reprogramar la entrega.",
  },
  GARANTIA: {
    LISTO: "Tu garantía está vigente. Trae el televisor, la factura y tu cédula.",
    NOVEDAD: "No encontramos la compra con esos datos. Trae la factura original.",
  },
};

/** Insignia corta de preparación para la cola y el puesto. */
export function insigniaPreparacion(preparacion, flujo) {
  const p = preparacion && PREPARACION[preparacion.estado];
  if (!p) return "";
  return html`<span class="prep prep--${p.tono}">${icono(flujo === "GARANTIA" ? "escudo2" : "paquete", 12)} ${flujo ? textoPreparacion(flujo, preparacion.estado) : p.corto}</span>`;
}

export function abrirPrepararTurno(turno, alListo) {
  const flujo = turno.tramite_flujo === "GARANTIA" ? "GARANTIA" : "ENTREGA";
  const actual = turno.preparacion?.estado || "PENDIENTE";
  const s = { estado: actual === "PENDIENTE" ? "EN_PREPARACION" : actual, nota: turno.preparacion?.nota || "", ocupado: false, error: "" };

  const pie = () => html`
    <button type="button" class="btn btn--suave" data-cerrar>Cancelar</button>
    <button type="submit" form="form-preparar" class="btn btn--primario" ${s.ocupado ? "disabled" : ""}>${s.ocupado ? cargando("Guardando…") : "Guardar preparación"}</button>`;

  const pedido = turno.equipo
    ? html`
        <section class="puesto__equipo" aria-label="Equipo">
          <span class="puesto__equipo-icono">${icono("tv", 18)}</span>
          <div><strong>${turno.equipo.marca} ${turno.equipo.modelo}</strong><small><span class="mono">${turno.equipo.codigo}</span>${turno.equipo.falla ? ` · ${turno.equipo.falla}` : ""}</small></div>
        </section>`
    : turno.respuestas_solicitud?.length || turno.detalle_necesidad
      ? html`
          <section class="puesto__necesidad" aria-label="Lo que pidió el ciudadano">
            <strong>Lo que pidió al reservar</strong>
            <dl>
              ${(turno.respuestas_solicitud || []).map((r) => html`<div><dt>${r.etiqueta}</dt><dd>${valorRespuesta(r.valor)}</dd></div>`)}
              ${turno.detalle_necesidad ? html`<div><dt>Necesidad</dt><dd>${turno.detalle_necesidad}</dd></div>` : ""}
            </dl>
          </section>`
      : html`<p class="tenue">El ciudadano no dejó respuestas adicionales; prepara según el trámite.</p>`;

  const cuerpo = () => html`
    <form id="form-preparar" class="formulario">
      ${pedido}
      <div class="preparar__opciones" role="radiogroup" aria-label="Estado de la preparación">
        ${OPCIONES.map(
          (o) => html`
            <button type="button" role="radio" aria-checked="${s.estado === o.estado}" data-estado="${o.estado}"
              class="preparar__opcion preparar__opcion--${PREPARACION[o.estado].tono} ${s.estado === o.estado ? "activo" : ""}">
              ${icono(o.icono, 18)}
              <span><strong>${o.estado === "PENDIENTE" ? "Pendiente" : textoPreparacion(flujo, o.estado)}</strong><small>${o.detalle || DETALLES[flujo][o.estado]}</small></span>
            </button>`,
        )}
      </div>
      ${s.estado !== "PENDIENTE"
        ? html`
            <label>
              <span class="etiqueta">Mensaje para el ciudadano ${s.estado === "NOVEDAD" ? "(obligatorio)" : "(opcional)"}</span>
              <span class="campo"><textarea id="prep-nota" rows="3" maxlength="500" placeholder="Ej. Tu televisor ya fue probado y está empacado.">${s.nota}</textarea></span>
              <small class="formulario__ayuda">${s.nota.length}/500 · Lo verá al consultar su turno con el código.</small>
            </label>`
        : ""}
      ${mensajeError(s.error)}
    </form>`;

  const v = abrirModal({
    titulo: `${flujo === "GARANTIA" ? "Revisar la garantía" : "Alistar el equipo"} de ${turno.usuario_nombre}`,
    descripcion: `Turno ${codigoTurno(turno)} · ${turno.tramite_nombre} · ${turno.es_hoy === false ? fechaCorta(turno.fecha) : "hoy"} ${turno.hora_inicio}`,
    ancho: 560,
    cuerpo: cuerpo(),
    pie: pie(),
  });
  const repintar = () => {
    pintar(v.cuerpo, cuerpo());
    pintar(v.pie, pie());
  };

  v.caja.addEventListener("click", (e) => {
    const b = e.target.closest("[data-estado]");
    if (!b) return;
    s.estado = b.dataset.estado;
    const sugerida = SUGERENCIAS[flujo][s.estado];
    if (sugerida && (!s.nota.trim() || Object.values(SUGERENCIAS[flujo]).includes(s.nota))) s.nota = sugerida;
    repintar();
  });
  v.caja.addEventListener("input", (e) => {
    if (e.target.id !== "prep-nota") return;
    s.nota = e.target.value;
    repintar();
  });
  v.caja.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (s.estado === "NOVEDAD" && !s.nota.trim()) {
      s.error = "Describe la novedad para avisarle al ciudadano.";
      repintar();
      return;
    }
    s.ocupado = true;
    s.error = "";
    repintar();
    try {
      const r = await agenteApi.preparar(turno.id, s.estado, s.estado === "PENDIENTE" ? "" : s.nota.trim());
      v.cerrar();
      alListo(r);
    } catch (err) {
      s.error = err.message;
      s.ocupado = false;
      repintar();
    }
  });
}
