import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carga datos y los mantiene actualizados solos (sin botón "Actualizar").
 * Se pausa cuando la pestaña no está visible y refresca al volver.
 */
export default function usePolling(cargar, intervaloMs, deps = []) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState(null);
  const ref = useRef(cargar);
  const solicitud = useRef(0);
  ref.current = cargar;

  const refrescar = useCallback(async () => {
    const id = ++solicitud.current;
    try {
      const r = await ref.current();
      if (id !== solicitud.current) return;
      setDatos(r);
      setError("");
      setActualizado(new Date());
    } catch (e) {
      if (id === solicitud.current) setError(e.message);
    } finally {
      if (id === solicitud.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    setCargando(true);
    refrescar();
    let t = window.setInterval(() => !document.hidden && refrescar(), intervaloMs);
    const visible = () => {
      if (!document.hidden) refrescar();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(t);
      t = null;
      solicitud.current += 1;
      document.removeEventListener("visibilitychange", visible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refrescar, intervaloMs, ...deps]);

  return { datos, error, cargando, actualizado, refrescar, setDatos };
}
