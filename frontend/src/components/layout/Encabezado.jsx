/** Encabezado de sección del panel con indicador "en vivo" (sin botón de actualizar). */
export default function Encabezado({ titulo, detalle, actualizado, error, children }) {
  const hora = actualizado?.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <header className="adm__cabeza">
      <div>
        <h1>{titulo}</h1>
        {detalle && <p>{detalle}</p>}
      </div>
      <div className="adm__cabeza-der">
        <span className={`en-vivo ${error ? "en-vivo--error" : ""}`} title={error || undefined}>
          {error ? "Sin conexión, reintentando" : actualizado ? `En vivo · ${hora}` : "Conectando…"}
        </span>
        {children}
      </div>
    </header>
  );
}
