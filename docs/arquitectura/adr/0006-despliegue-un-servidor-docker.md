# ADR-0006 · Despliegue en un servidor con Docker Compose (nginx + waitress + MySQL)

- **Estado:** Aceptada
- **RAR / atributos:** RAR-08 · costo, operabilidad, seguridad

## Contexto
Presupuesto bajo, equipo pequeño, desarrollo en Windows y servidor Linux (C7). La carga esperada es baja (≈ 5 pet./s).

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **VM única + Docker Compose** (elegida) | Reproducible; costo bajo; mismo entorno en cualquier proveedor | VM como punto único de fallo |
| PaaS gestionado (app + BD administradas) | Menos operación | Mayor costo mensual; dependencia del proveedor |
| Kubernetes | Alta disponibilidad, escalado | Complejidad desproporcionada para la carga |
| `flask run` / servidor de desarrollo | Ya funcionaba | No apto para producción |

Servidor WSGI: **waitress** (funciona igual en Windows y Linux) en lugar de gunicorn (solo Unix), para que el equipo pruebe localmente lo mismo que corre en producción.

## Decisión
`docker-compose.yml` con tres servicios. Solo `web` (nginx) expone puertos; nginx sirve la SPA, aplica CSP y límite de peticiones y hace proxy a `/api`, de modo que web y API comparten dominio (sin CORS en producción). La API aplica migraciones al arrancar y expone `/health` y `/health/listo`.

## Consecuencias
- ➕ Un comando levanta todo el sistema; secretos en `deploy/.env.produccion` fuera de Git.
- ➖ Sin redundancia; respaldo de la BD pendiente (riesgo R7).
- **Revisar si:** el negocio exige disponibilidad mayor que "reinicio en segundos" o hay varias regiones.
