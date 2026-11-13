/**
 * Configuración del frontend (equivale al antiguo archivo .env).
 *
 *   API_URL            dirección del backend Flask (todas las rutas viven en /api/v1)
 *   ORGANIZATION_SLUG  organización que atiende las reservas públicas de este sitio
 *
 * En desarrollo (Live Server en :5500 o "python -m http.server 5173") la API
 * está en http://127.0.0.1:5000. Con Docker, nginx sirve el frontend en el
 * puerto 80 y reenvía /api al backend, así que basta la ruta relativa.
 * Si el backend corre en otra máquina o puerto, cambia solo este archivo.
 */
const conProxy = window.location.port === "" || window.location.port === "80" || window.location.port === "443";

export const CONFIG = {
  API_URL: conProxy ? "/api/v1" : "http://127.0.0.1:5000/api/v1",
  ORGANIZATION_SLUG: "filacero-demo",
};
