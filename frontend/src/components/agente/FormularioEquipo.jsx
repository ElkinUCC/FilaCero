import { useEffect, useState } from "react";
import * as agenteApi from "../../api/agente.api";
import { catalogoEquipos } from "../../api/publico.api";
import { hoyISO, soloDigitos } from "../../utils/formatters";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";

/**
 * Registro de un equipo que el cliente deja en la sede (orden de servicio).
 * Se usa desde la sección Equipos o desde el puesto, con los datos del
 * ciudadano que se está atendiendo ya diligenciados.
 */
export default function FormularioEquipo({ inicial = {}, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
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
  });
  const [marcas, setMarcas] = useState(["Samsung", "LG", "Sony", "TCL", "Hisense", "Kalley", "Challenger", "Otra"]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  useEffect(() => {
    catalogoEquipos().then((r) => r?.marcas?.length && setMarcas(r.marcas)).catch(() => {});
  }, []);

  async function guardar(e) {
    e.preventDefault();
    if (!/^3\d{9}$/.test(form.cliente_celular)) return setError("Escribe el celular del cliente (10 dígitos).");
    if (form.cliente_nombre.trim().length < 3) return setError("Escribe el nombre del cliente.");
    if (!/^\d{6,12}$/.test(form.cliente_documento)) return setError("Escribe la cédula del titular (6 a 12 dígitos): se pedirá para entregarle el equipo.");
    if (!form.marca) return setError("Elige la marca.");
    if (form.origen === "GARANTIA" && !form.fecha_compra) return setError("La garantía exige la fecha de compra.");
    setGuardando(true);
    setError("");
    try {
      const r = await agenteApi.registrarEquipo({ ...form, fecha_compra: form.fecha_compra || null });
      onGuardado(r);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo="Recibir equipo"
      descripcion="Queda con el celular y la cédula del titular: con el celular sigue el avance y reserva la entrega; con la cédula lo recibe."
      onCerrar={onCerrar}
      ancho={600}
      pie={
        <>
          <button type="button" className="btn btn--suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-equipo" className="btn btn--primario" disabled={guardando}>
            {guardando ? "Guardando…" : "Registrar equipo"}
          </button>
        </>
      }
    >
      <form id="form-equipo" className="formulario" onSubmit={guardar}>
        <div className="formulario__fila">
          <label>
            <span className="etiqueta">Celular del cliente</span>
            <span className="campo"><Icon name="celular" size={17} /><input inputMode="numeric" value={form.cliente_celular} onChange={(e) => setForm((f) => ({ ...f, cliente_celular: soloDigitos(e.target.value, 10) }))} placeholder="3001234567" /></span>
          </label>
          <label>
            <span className="etiqueta">Nombre del cliente</span>
            <span className="campo"><Icon name="usuario" size={17} /><input value={form.cliente_nombre} onChange={cambiar("cliente_nombre")} maxLength={100} /></span>
          </label>
        </div>
        <label>
          <span className="etiqueta">Cédula del titular</span>
          <span className="campo"><Icon name="ficha" size={17} /><input inputMode="numeric" autoComplete="off" value={form.cliente_documento} onChange={(e) => setForm((f) => ({ ...f, cliente_documento: soloDigitos(e.target.value, 12) }))} placeholder="Solo números · se exige al entregar" /></span>
          {inicial.cliente_documento && <small className="formulario__ayuda">Ya registrada: termina en {inicial.cliente_documento.replace(/^·+/, "")}. Debe coincidir.</small>}
        </label>
        <div>
          <span className="etiqueta">Marca</span>
          <div className="wz__chips eq__marcas">
            {marcas.map((m) => (
              <button key={m} type="button" className={`wz__chip ${form.marca === m ? "activo" : ""}`} onClick={() => setForm((f) => ({ ...f, marca: m }))}>{m}</button>
            ))}
          </div>
        </div>
        <div className="formulario__fila">
          <label>
            <span className="etiqueta">Modelo o tamaño</span>
            <span className="campo"><input value={form.modelo} onChange={cambiar("modelo")} maxLength={60} placeholder='55" 4K' /></span>
          </label>
          <label>
            <span className="etiqueta">Serial</span>
            <span className="campo"><input value={form.serial} onChange={cambiar("serial")} maxLength={60} placeholder="Opcional" /></span>
          </label>
        </div>
        <label>
          <span className="etiqueta">Falla reportada</span>
          <span className="campo"><textarea rows={2} maxLength={300} value={form.falla} onChange={cambiar("falla")} placeholder="Ej. No enciende, el led parpadea" /></span>
        </label>
        <div className="formulario__fila">
          <div>
            <span className="etiqueta">Tipo de ingreso</span>
            <div className="segmentos eq__origen">
              {[["REPARACION", "Reparación"], ["GARANTIA", "Garantía"]].map(([k, v]) => (
                <button key={k} type="button" className={form.origen === k ? "activo" : ""} onClick={() => setForm((f) => ({ ...f, origen: k }))}>{v}</button>
              ))}
            </div>
          </div>
          {form.origen === "GARANTIA" && (
            <label>
              <span className="etiqueta">Fecha de compra (máx. 1 año)</span>
              <span className="campo"><Icon name="calendario" size={17} /><input type="date" max={hoyISO()} min={hoyISO(-365)} value={form.fecha_compra} onChange={cambiar("fecha_compra")} /></span>
            </label>
          )}
        </div>
        <label>
          <span className="etiqueta">Nota para el cliente (opcional)</span>
          <span className="campo"><input value={form.nota} onChange={cambiar("nota")} maxLength={300} placeholder="Ej. Pasa a diagnóstico hoy" /></span>
        </label>
        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      </form>
    </Modal>
  );
}
