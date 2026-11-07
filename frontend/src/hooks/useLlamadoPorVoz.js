/**
 * Llamado por voz desde la consola del asesor (Web Speech API, sin servidor).
 *
 * Cuando el asesor llama a un turno, el navegador lo anuncia de inmediato:
 *   "Turno 1 2 0 4 8 9. Fernando Martínez Cardona, por favor acercarse al Módulo 2."
 * y lo repite cada 20 segundos mientras el turno siga en estado LLAMADO.
 * Se detiene solo cuando el asesor inicia la atención, marca "no asistió",
 * devuelve el turno o silencia la voz. Tope: 3 minutos (tiempo máximo de
 * llegada), luego el asistente sugiere marcar "no asistió".
 *
 * La preferencia (voz activada o no) se guarda en este navegador.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { guardarLocal, leerLocal } from "../utils/storage";
import { hablar } from "./useAccesibilidad";

export const INTERVALO_LLAMADO_MS = 20000;
const MAX_REPETICIONES = 9; // 9 x 20 s = 3 min
const CLAVE = "filacero_llamado_voz";

/* ---------------- preferencia: llamado por voz activado ---------------- */
const oyentes = new Set();
let activada = leerLocal(CLAVE) !== "no";

export function cambiarLlamadoPorVoz(valor) {
  activada = Boolean(valor);
  guardarLocal(CLAVE, activada ? "si" : "no");
  if (!activada && "speechSynthesis" in window) window.speechSynthesis.cancel();
  oyentes.forEach((f) => f());
}

export function useLlamadoPorVozActivado() {
  return useSyncExternalStore(
    (f) => { oyentes.add(f); return () => oyentes.delete(f); },
    () => activada,
  );
}

export const vozDisponible = () => typeof window !== "undefined" && "speechSynthesis" in window;

/* ---------------- texto del anuncio ---------------- */
const FEMENINOS = ["taquilla", "ventanilla", "caja", "mesa", "oficina", "sala"];

/** Artículo para el módulo: "al" (Módulo 2) o "a la" (Taquilla 1). */
export function articuloModulo(modulo) {
  const primera = String(modulo || "").trim().split(/\s+/)[0].toLowerCase();
  return FEMENINOS.includes(primera) ? "a la" : "al";
}

/** "Módulo 2" -> "al Módulo 2"; "Taquilla 1" -> "a la Taquilla 1". */
export function destinoHablado(modulo, asesor) {
  const texto = String(modulo || "").trim();
  if (!texto) return asesor ? `con el asesor ${asesor}` : "al punto de atención";
  return `${articuloModulo(texto)} ${texto}`;
}

/** Deletrea el código para que se entienda: "1 2 0 4 8 9". */
export function deletrear(codigo) {
  return String(codigo || "").split("").join(" ");
}

export function textoLlamado(turno, modulo, asesor) {
  const codigo = deletrear(String(turno?.codigo || "").slice(-6));
  const nombre = turno?.usuario_nombre || "";
  return `Turno ${codigo}. ${nombre}, por favor acercarse ${destinoHablado(modulo, asesor)}.`;
}

/* ---------------- hook principal ---------------- */
export default function useLlamadoPorVoz({ turno, modulo, asesor }) {
  const activo = useLlamadoPorVozActivado();
  const llamadoId = turno?.estado === "LLAMADO" ? turno.id : null;
  const texto = llamadoId ? textoLlamado(turno, modulo, asesor) : "";
  const [estado, setEstado] = useState({ id: null, veces: 0, restante: null });
  const textoRef = useRef(texto);
  useEffect(() => {
    textoRef.current = texto;
  }, [texto]);

  useEffect(() => {
    if (!llamadoId || !activo || !vozDisponible()) return undefined;
    let veces = 0;
    let proxima = null;
    let intervalo = null;
    const decir = () => {
      hablar(textoRef.current);
      veces += 1;
      proxima = veces >= MAX_REPETICIONES ? null : Date.now() + INTERVALO_LLAMADO_MS;
      if (!proxima && intervalo) window.clearInterval(intervalo);
    };
    // Cuenta regresiva visible para el asesor ("se repite en 12 s").
    const reloj = window.setInterval(() => {
      const restante = proxima ? Math.max(0, Math.ceil((proxima - Date.now()) / 1000)) : null;
      setEstado({ id: llamadoId, veces, restante });
    }, 500);
    // Primer anuncio enseguida (un instante después del clic en "Llamar").
    const inicio = window.setTimeout(() => {
      decir();
      intervalo = window.setInterval(decir, INTERVALO_LLAMADO_MS);
    }, 120);
    return () => {
      window.clearTimeout(inicio);
      window.clearInterval(reloj);
      if (intervalo) window.clearInterval(intervalo);
      window.speechSynthesis.cancel();
    };
  }, [llamadoId, activo]);

  const repetirAhora = useCallback(() => {
    if (textoRef.current) hablar(textoRef.current);
  }, []);

  const vigente = estado.id === llamadoId && llamadoId != null && activo;
  return {
    activo,
    soportado: vozDisponible(),
    llamando: Boolean(llamadoId),
    veces: vigente ? estado.veces : 0,
    restante: vigente ? estado.restante : null,
    texto,
    repetirAhora,
  };
}
