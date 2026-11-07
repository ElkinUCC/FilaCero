# ADR-003 · MySQL relacional con migraciones Alembic

- **Estado**: Aceptado · **Atributos**: integridad, trazabilidad · **Riesgos**: R-03

## Contexto
Los datos son fuertemente relacionales (sede → franja → turno → asesor) y la regla central es transaccional.
El esquema cambia en cada sprint y debe aplicarse sin perder datos en el equipo del docente o del estudiante.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **MySQL 8 InnoDB + Alembic** | ACID, bloqueo de fila, conocido, gratuito; migraciones reversibles | Requiere instalar el servidor |
| PostgreSQL | Mejor soporte de tipos y aislamiento | No es el estándar del curso/equipo |
| SQLite en producción | Cero instalación | Bloquea toda la base en escrituras; ocultó el defecto de concurrencia (ADR-004) |
| NoSQL documental | Esquema flexible | Sin transacciones multi-documento simples para el cupo |

## Decisión
MySQL 8 como base operativa; SQLite **solo** para pruebas automatizadas; Alembic para versionar el esquema.
Las migraciones de la entrega final son **aditivas** (columnas nulas o con `server_default`).

## Consecuencias
- (+) `flask db upgrade` aplica solo lo pendiente sin borrar datos.
- (−) Las pruebas en SQLite no reproducen el aislamiento de InnoDB: por eso existe la prueba de concurrencia real
  (`simulacion.py --carga`), que detectó la falla corregida en ADR-004.
