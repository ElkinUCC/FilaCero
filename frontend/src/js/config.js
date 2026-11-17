/**
 * Configuración del frontend (localhost).
 *
 *   API_URL            dirección del backend Flask (todas las rutas viven en /api/v1)
 *   ORGANIZATION_SLUG  organización que atiende las reservas públicas de este sitio
 *
 * El frontend se sirve con "python -m http.server 5173" (o Live Server en :5500)
 * y la API corre en el puerto 5000 del MISMO equipo. Se usa el mismo nombre de
 * equipo con el que se abrió la página: en el portátil es "localhost" y, desde
 * otro equipo de la red local (por ejemplo la TV de la sala), es la IP del
 * portátil, sin cambiar nada aquí. Ese origen debe estar en CORS_ALLOWED_ORIGINS.
 */
const nombre = window.location.hostname;
// "localhost" se traduce a 127.0.0.1 porque la API escucha solo en IPv4 (run.py).
const equipo = !nombre || nombre === "localhost" ? "127.0.0.1" : nombre;

export const CONFIG = {
  API_URL: `http://${equipo}:5000/api/v1`,
  ORGANIZATION_SLUG: "filacero-demo",
};
