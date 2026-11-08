import { useCallback, useEffect, useRef, useState } from "react";
import { preguntarAsistente, sugerenciasAsistente } from "../../api/asistente.api";
import Icon from "./Icon";
import "../../css/asistente.css";

/**
 * Asistente FilaCero IA: botón flotante + panel de conversación.
 *
 *   titulo      "FilaCero IA" (gerencial) o "Copiloto IA" (asesor)
 *   extra       parámetros que viajan con cada pregunta (p. ej. { dias: 7 })
 *   onAccion    ejecuta los botones que propone el asistente:
 *               { tipo: "llamar" | "preparar", turno_id } · { tipo: "navegar" | "seccion", destino }
 *
 * La conversación se conserva mientras la página esté abierta (no se guarda
 * en el navegador porque puede contener nombres de clientes).
 */

/** Negrita (**texto**) y viñetas ("- ") sin HTML: todo se escapa con React. */
function TextoEnriquecido({ texto }) {
  const bloques = String(texto || "").split(/\n{2,}/);
  const negritas = (linea, k) =>
    linea.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
      parte.startsWith("**") && parte.endsWith("**")
        ? <strong key={`${k}-${i}`}>{parte.slice(2, -2)}</strong>
        : parte
    );
  return bloques.map((bloque, b) => {
    const lineas = bloque.split("\n");
    const vinetas = lineas.filter((l) => l.trim().startsWith("- "));
    const normales = lineas.filter((l) => !l.trim().startsWith("- "));
    return (
      <div key={b} className="ia__bloque">
        {normales.length > 0 && <p>{normales.map((l, i) => <span key={i}>{negritas(l, `${b}${i}`)}{i < normales.length - 1 ? " " : ""}</span>)}</p>}
        {vinetas.length > 0 && (
          <ul>{vinetas.map((l, i) => <li key={i}>{negritas(l.trim().slice(2), `${b}v${i}`)}</li>)}</ul>
        )}
      </div>
    );
  });
}

const ICONO_ACCION = { llamar: "megafono", preparar: "paquete", navegar: "externo", seccion: "mensaje" };

export default function AsistenteIA({ titulo = "FilaCero IA", subtitulo, extra, onAccion }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [iniciales, setIniciales] = useState([]);
  const [modo, setModo] = useState("local");
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const hilo = useRef(null);
  const entrada = useRef(null);
  const reconocimiento = useRef(null);
  const Reconocedor = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!abierto || iniciales.length) return;
    sugerenciasAsistente()
      .then((r) => { setIniciales(r.sugerencias || []); setModo(r.modo || "local"); })
      .catch(() => {});
  }, [abierto, iniciales.length]);

  useEffect(() => {
    if (abierto) window.setTimeout(() => entrada.current?.focus(), 120);
  }, [abierto]);

  useEffect(() => {
    hilo.current?.scrollTo({ top: hilo.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, pensando]);

  // Escape cierra el panel.
  useEffect(() => {
    if (!abierto) return undefined;
    const alPresionar = (e) => { if (e.key === "Escape") setAbierto(false); };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [abierto]);

  const preguntar = useCallback(async (pregunta) => {
    const q = String(pregunta || "").trim();
    if (q.length < 2 || pensando) return;
    setTexto("");
    const historial = mensajes.slice(-6).map((m) => ({ rol: m.rol, texto: m.texto }));
    setMensajes((xs) => [...xs, { id: Date.now(), rol: "usuario", texto: q }]);
    setPensando(true);
    try {
      const r = await preguntarAsistente(q, historial, extra);
      setMensajes((xs) => [...xs, { id: Date.now() + 1, rol: "asistente", texto: r.respuesta, ...r }]);
      if (r.fuente) setModo((m) => (r.fuente === "ia" ? "ia" : m));
    } catch (e) {
      setMensajes((xs) => [...xs, { id: Date.now() + 1, rol: "asistente", error: true, texto: e.message || "No pude responder ahora. Intenta de nuevo." }]);
    } finally {
      setPensando(false);
    }
  }, [mensajes, pensando, extra]);

  function dictar() {
    if (!Reconocedor) return;
    if (escuchando) { reconocimiento.current?.stop(); return; }
    const rec = new Reconocedor();
    rec.lang = "es-CO";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const dicho = e.results?.[0]?.[0]?.transcript || "";
      if (dicho) preguntar(dicho);
    };
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    reconocimiento.current = rec;
    setEscuchando(true);
    rec.start();
  }

  const ultimo = [...mensajes].reverse().find((m) => m.rol === "asistente" && !m.error);
  const sugerencias = ultimo?.sugerencias?.length ? ultimo.sugerencias : iniciales;

  return (
    <>
      <button
        type="button"
        className={`ia-fab ${abierto ? "ia-fab--oculto" : ""}`}
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        title={`Abrir ${titulo}`}
      >
        <span className="ia-fab__icono"><Icon name="chispa" size={20} /></span>
        <span className="ia-fab__texto">{titulo}</span>
      </button>

      {abierto && <div className="ia-sombra" onClick={() => setAbierto(false)} aria-hidden="true" />}
      <section
        className={`ia ${abierto ? "ia--abierto" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label={titulo}
        aria-hidden={!abierto}
        inert={!abierto}
      >
        <header className="ia__cabeza">
          <span className="ia__avatar"><Icon name="chispa" size={20} /></span>
          <div className="ia__titulo">
            <strong>{titulo}</strong>
            <small>
              <i className={`ia__punto ${pensando ? "ia__punto--activo" : ""}`} />
              {pensando ? "Analizando tus datos…" : subtitulo || (modo === "ia" ? "Conectado a Claude · datos en tiempo real" : "Datos en tiempo real de tu operación")}
            </small>
          </div>
          {mensajes.length > 0 && (
            <button type="button" className="ia__icono" onClick={() => setMensajes([])} title="Nueva conversación" aria-label="Nueva conversación">
              <Icon name="borrar" size={17} />
            </button>
          )}
          <button type="button" className="ia__icono" onClick={() => setAbierto(false)} aria-label="Cerrar asistente">
            <Icon name="cerrar" size={18} />
          </button>
        </header>

        <div className="ia__hilo" ref={hilo} aria-live="polite">
          {mensajes.length === 0 && (
            <div className="ia__bienvenida">
              <span className="ia__bienvenida-icono"><Icon name="chispa" size={26} /></span>
              <h2>¿En qué te ayudo?</h2>
              <p>Pregúntame en tus palabras. Respondo con los datos reales de turnos, sedes, equipos y reclamos, y te sugiero qué hacer.</p>
            </div>
          )}

          {mensajes.map((m) => (
            <article key={m.id} className={`ia__msg ia__msg--${m.rol} ${m.error ? "ia__msg--error" : ""}`}>
              {m.rol === "asistente" && <span className="ia__msg-avatar" aria-hidden="true"><Icon name="chispa" size={13} /></span>}
              <div className="ia__burbuja">
                {m.rol === "asistente" ? <TextoEnriquecido texto={m.texto} /> : <p>{m.texto}</p>}
                {m.tarjetas?.length > 0 && (
                  <div className="ia__tarjetas">
                    {m.tarjetas.map((t) => (
                      <div key={t.etiqueta} className={`ia__tarjeta ia__tarjeta--${t.tono}`}>
                        <small>{t.etiqueta}</small>
                        <strong>{t.valor}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {m.acciones?.length > 0 && onAccion && (
                  <div className="ia__acciones">
                    {m.acciones.map((a, i) => (
                      <button key={i} type="button" className="btn btn--primario btn--chico" onClick={() => { onAccion(a); if (a.tipo !== "llamar") setAbierto(false); }}>
                        <Icon name={ICONO_ACCION[a.tipo] || "derecha"} size={15} /> {a.texto}
                      </button>
                    ))}
                  </div>
                )}
                {m.fuente && <span className="ia__fuente">{m.fuente === "ia" ? "Redactado por Claude con tus datos" : "Calculado con tus datos en tiempo real"}</span>}
              </div>
            </article>
          ))}

          {pensando && (
            <article className="ia__msg ia__msg--asistente">
              <span className="ia__msg-avatar" aria-hidden="true"><Icon name="chispa" size={13} /></span>
              <div className="ia__burbuja ia__escribiendo" aria-label="El asistente está escribiendo"><i /><i /><i /></div>
            </article>
          )}
        </div>

        {sugerencias.length > 0 && !pensando && (
          <div className="ia__sugerencias" aria-label="Preguntas sugeridas">
            {sugerencias.slice(0, 4).map((s) => (
              <button key={s} type="button" onClick={() => preguntar(s)}>{s}</button>
            ))}
          </div>
        )}

        <form className="ia__form" onSubmit={(e) => { e.preventDefault(); preguntar(texto); }}>
          <input
            ref={entrada}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            placeholder={escuchando ? "Te escucho…" : "Escribe tu pregunta…"}
            aria-label="Pregunta para el asistente"
            disabled={pensando}
          />
          {Reconocedor && (
            <button type="button" className={`ia__icono ia__mic ${escuchando ? "ia__mic--on" : ""}`} onClick={dictar} aria-pressed={escuchando} aria-label={escuchando ? "Detener dictado" : "Dictar pregunta"} title="Dictar por voz">
              <Icon name="microfono" size={18} />
            </button>
          )}
          <button type="submit" className="ia__enviar" disabled={pensando || texto.trim().length < 2} aria-label="Enviar pregunta">
            <Icon name="enviar" size={17} />
          </button>
        </form>
      </section>
    </>
  );
}
