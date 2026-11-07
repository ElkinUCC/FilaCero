# ADR-006 · Multiempresa en esquema compartido

- **Estado**: Aceptado · **Atributos**: escalabilidad de negocio, seguridad, costo · **Riesgos**: R-06

## Contexto
FilaCero se pensó como producto para varias organizaciones (centros de servicio, notarías…) sin instalar
una copia por cliente.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Una base por organización | Aislamiento físico | Migraciones y operación × N |
| Un esquema por organización | Aislamiento medio | Complejidad de conexión y migración |
| **Esquema compartido + `organizacion_id`** con filtro automático en el ORM | Una instalación, costo mínimo | Un filtro olvidado filtraría datos: se mitiga haciéndolo automático |

## Decisión
Todas las entidades de negocio heredan `TenantScoped`. `tenancy.py` resuelve la organización (JWT firmado o
`X-Organization-Slug` en peticiones públicas) y agrega el filtro a cada `SELECT/UPDATE/DELETE` del ORM.

## Consecuencias
- (+) Las tablas y columnas nuevas de esta entrega quedaron aisladas sin código adicional.
- (−) Consultas SQL crudas (si se agregaran) quedarían fuera del filtro: está prohibido por convención y revisado en pruebas (`test_multiempresa.py`).
