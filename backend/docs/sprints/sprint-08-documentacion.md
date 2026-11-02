# Sprint 08 — Documentación técnica, pruebas de API y calidad transversal

**Proyecto:** FilaCero  
**Estado:** Documentación estructurada; evidencias externas pendientes de archivo.

## Objetivo
Consolidar contratos API, guía de instalación, seguridad, decisiones arquitectónicas, pruebas y evidencias necesarias para mantener y sustentar el proyecto.

## Historias de usuario
| ID | Historia | Criterios de aceptación |
|---|---|---|
| HU-33 | Como desarrollador, quiero instalar el proyecto de forma reproducible. | Se documentan requisitos, variables, migraciones y comandos. |
| HU-34 | Como desarrollador, quiero consultar la referencia API. | Los endpoints y ejemplos coinciden con los controladores vigentes. |
| HU-35 | Como equipo, queremos una colección Postman organizada. | La colección usa variables y no contiene secretos reales. |
| HU-36 | Como evaluador, quiero evidencias verificables. | Cada evidencia identifica prueba, entorno y resultado. |
| HU-37 | Como equipo, queremos justificar decisiones arquitectónicas. | Se documentan contexto, decisión, alternativas y consecuencias. |

## Líneas de trabajo
- Referencia de endpoints y ejemplos JSON.
- Guía de instalación y ejecución local.
- Guía de seguridad y manejo de secretos.
- Colección Postman agrupada por dominios.
- Plan de pruebas y registro de evidencias.
- Registros de decisiones arquitectónicas (ADR).
- Revisión de consistencia entre rutas, DTOs, servicios y documentación.

## Entregables previstos
- `docs/API.md`
- `docs/testing/PLAN_PRUEBAS_API.md`
- `docs/operations/INSTALACION_LOCAL.md`
- `docs/SECURITY.md`
- `docs/architecture/ADR-007-ADMINISTRACION-METRICAS.md`
- `docs/evidence/REGISTRO_PRUEBAS.md`
- `docs/postman/FilaCero.postman_collection.json`
- `docs/postman/FilaCero-Local.postman_environment.json`

## Evidencia disponible
En el desarrollo se compartió una ejecución de `python -m pytest` con 78 pruebas aprobadas. La colección Postman exportada, las capturas HTTP y el registro de ejecución deben incorporarse al repositorio para que el expediente quede completo.

## Criterios de aceptación
- Los documentos describen contratos vigentes.
- Postman importa sin errores.
- No se incluyen contraseñas, tokens ni secretos reales.
- Los resultados se identifican con su alcance y entorno.
- Los pendientes no se presentan como funcionalidades terminadas.

## Resultado
Se establece la base documental para que FilaCero sea reproducible, auditable y defendible académicamente.
