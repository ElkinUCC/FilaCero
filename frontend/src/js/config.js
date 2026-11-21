/** Configuración del frontend (localhost). */
const nombre = window.location.hostname;
// "localhost" se traduce a 127.0.0.1 porque la API escucha solo en IPv4 (run.py).
const equipo = !nombre || nombre === "localhost" ? "127.0.0.1" : nombre;

export const CONFIG = {
  API_URL: `http://${equipo}:5000/api/v1`,
  ORGANIZATION_SLUG: "filacero-demo",
};
