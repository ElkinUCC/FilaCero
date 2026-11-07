import { useEffect, useRef, useState } from "react";
import { horaDe } from "../../utils/formatters";
import Icon from "./Icon";

const ETIQUETA = { CLIENTE: "Cliente", ASESOR: "Asesor", ASISTENTE: "Asistente" };

/**
 * Minichat de un reclamo o consulta.
 * yo: "CLIENTE" o "ASESOR" (sus burbujas van a la derecha).
 * inicial: primer mensaje (la descripción del reclamo) para dar contexto.
 */
export default function Chat({ mensajes = [], inicial, yo, onEnviar, deshabilitado, placeholder = "Escribe tu mensaje" }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fin = useRef(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest" }); }, [mensajes.length]);

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (t.length < 2 || enviando) return;
    setEnviando(true);
    try {
      await onEnviar(t);
      setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  const lista = [...(inicial ? [{ id: "ini", ...inicial }] : []), ...mensajes];
  return (
    <div className="chat">
      <ol className="chat__hilo" aria-live="polite">
        {lista.map((m) => (
          <li key={m.id} className={`chat__msg chat__msg--${m.autor === yo ? "yo" : m.autor.toLowerCase()}`}>
            <span className="chat__autor">
              {m.autor === "ASISTENTE" && <Icon name="rayo" size={12} />}
              {m.autor_nombre || ETIQUETA[m.autor]}{m.fecha ? ` · ${horaDe(m.fecha)}` : ""}
            </span>
            <p>{m.texto}</p>
          </li>
        ))}
        <li ref={fin} aria-hidden="true" />
      </ol>
      {onEnviar && (
        <form className="chat__form" onSubmit={enviar}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600}
            placeholder={placeholder} aria-label="Mensaje" disabled={deshabilitado || enviando} />
          <button type="submit" className="btn btn--primario btn--chico" disabled={deshabilitado || enviando || texto.trim().length < 2} aria-label="Enviar">
            <Icon name="enviar" size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
