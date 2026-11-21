# Sprint 08 — Documentación técnica, pruebas de API y calidad transversal

**Proyecto:** FilaCero  
**Estado:** Completado (documentación consolidada en la entrega final; ver tabla de ubicaciones).

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

## Entregables (ubicación final en el repositorio)
Durante la entrega final la documentación se consolidó en menos archivos. Lo previsto en este sprint quedó así:

| Previsto | Ubicación final |
|---|---|
| Referencia API (`docs/API.md`) | `backend/README.md` (sección Endpoints) y `frontend/docs/CONTRATO-BACKEND-FRONTEND.md`; lista completa con `flask --app run routes` |
| Plan de pruebas (`docs/testing/PLAN_PRUEBAS_API.md`) | `backend/tests/` (18 archivos) y `backend/README.md` (sección Pruebas) |
| Instalación local (`docs/operations/INSTALACION_LOCAL.md`) | `README.md` de la raíz y `backend/README.md` |
| Seguridad (`docs/SECURITY.md`) | `docs/arquitectura/11-seguridad.md` |
| ADR de administración y métricas | `docs/arquitectura/adr/` (17 ADR) |
| Registro de pruebas (`docs/evidence/REGISTRO_PRUEBAS.md`) | `docs/arquitectura/07-analisis-atributos.md` y el informe `docs/entrega/Informe_Proyecto_Final_FilaCero.html` |
| Colección y entorno Postman | `backend/docs/postman/FilaCero.postman_collection.json` y `backend/docs/postman/FilaCero.local.postman_environment.json` |

## Evidencia disponible
Al cierre de este sprint se ejecutó `python -m pytest` con 78 pruebas aprobadas. En la entrega final la suite tiene 222 pruebas aprobadas (1 omitida) y la colección Postman está versionada en `backend/docs/postman/`.

## Criterios de aceptación
- Los documentos describen contratos vigentes.
- Postman importa sin errores.
- No se incluyen contraseñas, tokens ni secretos reales.
- Los resultados se identifican con su alcance y entorno.
- Los pendientes no se presentan como funcionalidades terminadas.

## Resultado
Se establece la base documental para que FilaCero sea reproducible, auditable y defendible académicamente.
