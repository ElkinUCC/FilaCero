/** Consulta periódica ("en vivo" sin botón de actualizar). */
export function crearSondeo(cargar, intervaloMs, alCambiar) {
  const estado = { datos: null, error: "", cargando: true, actualizado: null };
  let solicitud = 0;
  let activo = true;

  async function refrescar() {
    const id = ++solicitud;
    try {
      const r = await cargar();
      if (!activo || id !== solicitud) return;
      estado.datos = r;
      estado.error = "";
      estado.actualizado = new Date();
    } catch (e) {
      if (!activo || id !== solicitud) return;
      estado.error = e.message;
    }
    estado.cargando = false;
    alCambiar(estado);
  }

  const temporizador = window.setInterval(() => {
    if (!document.hidden) refrescar();
  }, intervaloMs);
  const alVolver = () => {
    if (!document.hidden) refrescar();
  };
  document.addEventListener("visibilitychange", alVolver);
  refrescar();

  return {
    estado,
    refrescar,
    /** Reemplaza los datos localmente (cambios optimistas) y vuelve a pintar. */
    poner(datos) {
      estado.datos = datos;
      alCambiar(estado);
    },
    detener() {
      activo = false;
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
    },
  };
}
