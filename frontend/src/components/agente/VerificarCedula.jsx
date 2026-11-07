import { useState } from "react";
import * as agenteApi from "../../api/agente.api";
import { soloDigitos } from "../../utils/formatters";
import Icon from "../ui/Icon";
import { Modal } from "../ui/Modal";

/**
 * Pide la cédula del dueño antes de entregar un equipo (o de recibirlo en sede
 * cuando llega por garantía). El celular identifica; la cédula autoriza.
 * El backend compara con la cédula registrada y responde 409 si no coincide.
 *
 * equipo: { id, marca, modelo, codigo, cliente_nombre, cliente_documento (···1234) }
 * estado: "ENTREGADO" | "RECIBIDO"
 */
export default function VerificarCedula({ equipo, estado, nombre, onCerrar, onListo }) {
  const [cedula, setCedula] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const entrega = estado === "ENTREGADO";
  const registrada = equipo.cliente_documento;
  const dueno = nombre || equipo.cliente_nombre || "el cliente";

  async function confirmar(e) {
    e.preventDefault();
    if (cedula.length < 6) return setError("La cédula tiene entre 6 y 12 dígitos.");
    setOcupado(true);
    setError("");
    try {
      const r = await agenteApi.cambiarEstadoEquipo(equipo.id, estado, undefined, cedula);
      onListo(r);
    } catch (err) {
      setError(err.message);
      setOcupado(false);
    }
  }

  return (
    <Modal
      titulo={entrega ? `Entregar a ${dueno}` : `Recibir el equipo de ${dueno}`}
      descripcion={`${equipo.marca} ${equipo.modelo || ""} · ${equipo.codigo}`}
      onCerrar={onCerrar}
      ancho={460}
      pie={
        <>
          <button type="button" className="btn btn--suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-cedula" className={`btn ${entrega ? "btn--exito" : "btn--primario"}`} disabled={ocupado || cedula.length < 6}>
            <Icon name={entrega ? "check" : "paquete"} size={16} /> {ocupado ? "Verificando…" : entrega ? "Verificar y entregar" : "Verificar y recibir"}
          </button>
        </>
      }
    >
      <form id="form-cedula" className="formulario cedula" onSubmit={confirmar}>
        <p className="cedula__ayuda">
          <Icon name="escudo2" size={18} />
          <span>
            {entrega ? "Pide la cédula original y escribe el número. Solo el titular puede recibir el equipo." : "Registra la cédula del titular: será la que se pida al entregarlo."}
            {registrada && <> Registrada: termina en <strong>{registrada.replace(/^·+/, "")}</strong>.</>}
          </span>
        </p>
        <label>
          <span className="etiqueta">Cédula del titular</span>
          <span className={`campo campo--grande ${error ? "campo--error" : ""}`}>
            <Icon name="ficha" size={18} />
            <input
              autoFocus inputMode="numeric" autoComplete="off" value={cedula}
              onChange={(ev) => { setCedula(soloDigitos(ev.target.value, 12)); setError(""); }}
              placeholder="Ej. 1037654321" aria-label="Número de cédula"
            />
          </span>
        </label>
        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      </form>
    </Modal>
  );
}
