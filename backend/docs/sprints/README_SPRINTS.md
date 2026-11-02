# FilaCero — Documentación de sprints 01–10

## Índice
01. `sprint-01-base.md` — Base del proyecto y arquitectura.
02. `sprint-02-usuarios-seguridad.md` — Usuarios, JWT y roles.
03. `sprint-03-modelo-negocio.md` — Sedes, trámites, franjas y reservas.
04. `sprint-04-admin.md` — Administración de recursos.
05. `sprint-05-customers.md` — Flujo del cliente.
06. `sprint-06-agentes-atencion.md` — Cola y ciclo de atención.
07. `sprint-07-admin.md` — Agentes, métricas e historial.
08. `sprint-08-documentacion.md` — Documentación, Postman y calidad.
09. `sprint-09-integracion-experiencia.md` — Integración y experiencia web.
10. `sprint-10-calidad-entrega.md` — Pruebas y entrega académica.
11. `CATALOGO_HU_Y_TRAZABILIDAD.md` — Catálogo consolidado de HU.

## Estado documental
| Sprint | Tema | Estado |
|---:|---|---|
| 01 | Base del proyecto | Completado |
| 02 | Usuarios y seguridad | Completado |
| 03 | Modelo de negocio y reservas | Implementado; respaldar con pruebas |
| 04 | Administración base | Implementado; conservar evidencia de endpoints |
| 05 | Flujo del cliente | Implementado; validar extremo a extremo |
| 06 | Agentes y atención | Validado localmente según evidencia compartida |
| 07 | Administración y métricas | Pruebas automatizadas; Postman pendiente de archivo |
| 08 | Documentación y calidad | Estructurado; completar evidencias |
| 09 | Integración y experiencia | Integrado; pulido visual final por verificar |
| 10 | Calidad y entrega | 78 pruebas aprobadas en ejecución compartida; demo/evidencias por consolidar |

## Convenciones
- **Implementado:** funcionalidad descrita en código/evidencia.
- **Validado:** prueba o ejecución registrada.
- **Pendiente de evidencia:** implementación posible, pero falta adjuntar soporte verificable.
- **Pendiente:** actividad no completada.

## Evidencia automatizada compartida
```powershell
python -m pytest
```
```text
78 passed in 14.20s
```
Conservar el log original con fecha y versión del código.

**Importante:** antes de entregar, contrastar rutas, campos y contratos con la última versión del repositorio. No distribuir `.env`, tokens ni contraseñas.
