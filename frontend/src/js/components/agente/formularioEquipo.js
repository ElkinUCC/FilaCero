/**
 * Registro de un equipo que el cliente deja en la sede (orden de servicio).
 * Se abre desde la sección Equipos o desde el puesto, con los datos del
 * ciudadano que se está atendiendo ya diligenciados.
 */
import * as agenteApi from "../../api/agente.api.js";
import { catalogoEquipos } from "../../api/publico.api.js";
import { html, pintar } from "../../utils/dom.js";
import { hoyISO, soloDigitos } from "../../utils/formatters.js";
import { icono } from "../ui/icon.js";
import { abrirModal, mensajeError } from "../ui/modal.js";
import { cargando } from "../ui/cargando.js";

const SOLO_NUMEROS = { cliente_celular: 10, cliente_documento: 12 };

export function abrirFormularioEquipo({ inicial = {}, alGuardado }) {
  const form = {
    cliente_celular: inicial.cliente_celular || "",
    cliente_nombre: inicial.cliente_nombre || "",
    cliente_documento: "",
    marca: inicial.marca || "",
    modelo: "",
    serial: "",
    falla: inicial.falla || "",
    origen: inicial.origen || "REPARACION",
    fecha_compra: inicial.fecha_compra || "",
    nota: "",
  };
  const s = { marcas: ["Samsung", "LG", "Sony", "TCL", "Hisense", "Kalley", "Challenger", "Otra"], guardando: false, error: "" };

  const pie = () => html`
    <button type="button" class="btn btn--suave" data-cerrar>Cancelar</button>
    <button type="submit" form="form-equipo" class="btn btn--primario" ${s.guardando ? "disabled" : ""}>${s.guardando ? cargando("Guardando…") : "Registrar equipo"}</button>`;

  const cuerpo = () => html`
    <form id="form-equipo" class="formulario">
      <div class="row row-cols-1 row-cols-sm-2 g-3">
        <label><span class="etiqueta">Celular del cliente</span>
          <span class="campo">${icono("celular", 17)}<input id="eq-cliente_celular" data-eq="cliente_celular" inputmode="numeric" value="${form.cliente_celular}" placeholder="3001234567" /></span>
        </label>
        <label><span class="etiqueta">Nombre del cliente</span>
          <span class="campo">${icono("usuario", 17)}<input id="eq-cliente_nombre" data-eq="cliente_nombre" value="${form.cliente_nombre}" maxlength="100" /></span>
        </label>
      </div>
      <label><span class="etiqueta">Cédula del titular</span>
        <span class="campo">${icono("ficha", 17)}<input id="eq-cliente_documento" data-eq="cliente_documento" inputmode="numeric" autocomplete="off" value="${form.cliente_documento}" placeholder="Solo números · se exige al entregar" /></span>
        ${inicial.cliente_documento ? html`<small class="formulario__ayuda">Ya registrada: termina en ${inicial.cliente_documento.replace(/^·+/, "")}. Debe coincidir.</small>` : ""}
      </label>
      <div>
        <span class="etiqueta">Marca</span>
        <div class="wz__chips eq__marcas">
          ${s.marcas.map((m) => html`<button type="button" class="wz__chip ${form.marca === m ? "activo" : ""}" data-marca="${m}">${m}</button>`)}
        </div>
      </div>
      <div class="row row-cols-1 row-cols-sm-2 g-3">
        <label><span class="etiqueta">Modelo o tamaño</span><span class="campo"><input id="eq-modelo" data-eq="modelo" value="${form.modelo}" maxlength="60" placeholder='55" 4K' /></span></label>
        <label><span class="etiqueta">Serial</span><span class="campo"><input id="eq-serial" data-eq="serial" value="${form.serial}" maxlength="60" placeholder="Opcional" /></span></label>
      </div>
      <label><span class="etiqueta">Falla reportada</span>
        <span class="campo"><textarea id="eq-falla" data-eq="falla" rows="2" maxlength="300" placeholder="Ej. No enciende, el led parpadea">${form.falla}</textarea></span>
      </label>
      <div class="row row-cols-1 row-cols-sm-2 g-3">
        <div>
          <span class="etiqueta">Tipo de ingreso</span>
          <div class="segmentos eq__origen">
            ${[["REPARACION", "Reparación"], ["GARANTIA", "Garantía"]].map(([k, t]) => html`<button type="button" class="${form.origen === k ? "activo" : ""}" data-origen="${k}">${t}</button>`)}
          </div>
        </div>
        ${form.origen === "GARANTIA"
          ? html`<label><span class="etiqueta">Fecha de compra (máx. 1 año)</span>
              <span class="campo">${icono("calendario", 17)}<input id="eq-fecha_compra" data-eq="fecha_compra" type="date" max="${hoyISO()}" min="${hoyISO(-365)}" value="${form.fecha_compra}" /></span></label>`
          : ""}
      </div>
      <label><span class="etiqueta">Nota para el cliente (opcional)</span>
        <span class="campo"><input id="eq-nota" data-eq="nota" value="${form.nota}" maxlength="300" placeholder="Ej. Pasa a diagnóstico hoy" /></span>
      </label>
      ${mensajeError(s.error)}
    </form>`;

  const v = abrirModal({
    titulo: "Recibir equipo",
    descripcion: "Queda con el celular y la cédula del titular: con el celular sigue el avance y reserva la entrega; con la cédula lo recibe.",
    ancho: 600,
    cuerpo: cuerpo(),
    pie: pie(),
  });
  const repintar = () => {
    pintar(v.cuerpo, cuerpo());
    pintar(v.pie, pie());
  };

  catalogoEquipos()
    .then((r) => {
      if (r?.marcas?.length) {
        s.marcas = r.marcas;
        repintar();
      }
    })
    .catch(() => {});

  v.caja.addEventListener("input", (e) => {
    const campo = e.target.dataset.eq;
    if (!campo) return;
    form[campo] = SOLO_NUMEROS[campo] ? soloDigitos(e.target.value, SOLO_NUMEROS[campo]) : e.target.value;
    if (SOLO_NUMEROS[campo]) repintar();
  });
  v.caja.addEventListener("click", (e) => {
    const marca = e.target.closest("[data-marca]");
    const origen = e.target.closest("[data-origen]");
    if (marca) form.marca = marca.dataset.marca;
    else if (origen) form.origen = origen.dataset.origen;
    else return;
    repintar();
  });
  v.caja.addEventListener("submit", async (e) => {
    e.preventDefault();
    const error =
      !/^3\d{9}$/.test(form.cliente_celular) ? "Escribe el celular del cliente (10 dígitos)."
      : form.cliente_nombre.trim().length < 3 ? "Escribe el nombre del cliente."
      : !/^\d{6,12}$/.test(form.cliente_documento) ? "Escribe la cédula del titular (6 a 12 dígitos): se pedirá para entregarle el equipo."
      : !form.marca ? "Elige la marca."
      : form.origen === "GARANTIA" && !form.fecha_compra ? "La garantía exige la fecha de compra."
      : "";
    if (error) {
      s.error = error;
      repintar();
      return;
    }
    s.guardando = true;
    s.error = "";
    repintar();
    try {
      const r = await agenteApi.registrarEquipo({ ...form, fecha_compra: form.fecha_compra || null });
      v.cerrar();
      alGuardado(r);
    } catch (err) {
      s.error = err.message;
      s.guardando = false;
      repintar();
    }
  });
}
