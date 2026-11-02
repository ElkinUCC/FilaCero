/** Logotipo de FilaCero (se repite en portal, panel, consola y sala). */
export default function Marca({ className = "" }) {
  return (
    <div className={`marca ${className}`.trim()}>
      <span className="marca__logo" aria-hidden="true">F0</span>
      <span className="marca__nombre">FilaCero</span>
    </div>
  );
}
