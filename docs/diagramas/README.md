# FilaCero · Diagramas UML

Diagramas hechos a partir del código real (`backend/app/dominios/*/modelos.py`, controladores e importaciones
entre dominios, y `frontend/src/js/`). Usan los mismos nombres que las vistas C4
([`docs/arquitectura/03-vistas-c4.md`](../arquitectura/03-vistas-c4.md)) y el despliegue
([`06-despliegue.md`](../arquitectura/06-despliegue.md)).

| # | Diagrama | Qué muestra | Relación con la arquitectura | Imagen | Fuente |
|---|---|---|---|---|---|
| 1 | **Casos de uso** | 5 actores (ciudadano, asesor, supervisor, administrador, TV de sala) y el proveedor SMS; `include` del OTP y `extend` de entrega y garantía | RAR-01…RAR-12 ([01](../arquitectura/01-sintesis-problema.md)) | [PNG](casos-de-uso.png) · [SVG](casos-de-uso.svg) | [`01-casos-de-uso.puml`](fuentes/01-casos-de-uso.puml) |
| 2 | **Clases del dominio** | Entidades con atributos y métodos; mixin `TenantScoped`; estados del turno y de la preparación | ADR-006, ADR-010, ADR-013, ADR-016 | [PNG](clases.png) · [SVG](clases.svg) | [`02-clases.puml`](fuentes/02-clases.puml) |
| 3 | **Entidad-relación** | 10 tablas MySQL con PK, FK, UK e índices | [04 §5](../arquitectura/04-arquitectura-logica.md#5-persistencia), ADR-003 | [PNG](entidad-relacion.png) · [SVG](entidad-relacion.svg) | [`03-entidad-relacion.puml`](fuentes/03-entidad-relacion.puml) |
| 4 | **Paquetes** | Frontend (router, pages, components, api, auth, utils) y backend (11 dominios + transversales) con sus dependencias reales | ADR-001, [04 §1](../arquitectura/04-arquitectura-logica.md), T-13 / R-11 | [PNG](paquetes.png) · [SVG](paquetes.svg) | [`04-paquetes.puml`](fuentes/04-paquetes.puml) |
| 5 | **Componentes (arquitectura UML)** | SPA sin frameworks y API por capas, puertos, transversales y sistemas externos | C2 + C3 ([03](../arquitectura/03-vistas-c4.md)), ADR-002 | [PNG](componentes.png) · [SVG](componentes.svg) | [`05-componentes.puml`](fuentes/05-componentes.puml) |
| 6 | **Despliegue** | Nodos, entornos de ejecución y artefactos del equipo de demostración (solo localhost) | [05](../arquitectura/05-arquitectura-fisica.md), [06](../arquitectura/06-despliegue.md), ADR-012 | [PNG](despliegue.png) · [SVG](despliegue.svg) | [`06-despliegue.puml`](fuentes/06-despliegue.puml) |
| 7 | **Secuencia: reservar turno** | OTP y reserva sin sobreventa (candado + `FOR UPDATE` + `READ COMMITTED`) | ADR-004, ADR-005, QA-1 | [PNG](secuencia-reserva.png) · [SVG](secuencia-reserva.svg) | [`07-secuencia-reserva.puml`](fuentes/07-secuencia-reserva.puml) |
| 8 | **Secuencia: llamar y atender** | Rol vigente, auditoría, voz en el navegador y sala por polling | ADR-005, ADR-007, ADR-009 | [PNG](secuencia-atencion.png) · [SVG](secuencia-atencion.svg) | [`08-secuencia-atencion.puml`](fuentes/08-secuencia-atencion.puml) |

Además, en el documento de arquitectura hay diagramas en Mermaid: C4 de contexto, contenedores y componentes
(03), capas y ciclo de vida del turno (04) y despliegue (06).

## Cómo regenerarlos

Con Java y [PlantUML](https://plantuml.com/) (o la extensión *PlantUML* de VS Code):

```powershell
cd docs\diagramas\fuentes
java -jar plantuml.jar -tpng -o .. *.puml
java -jar plantuml.jar -tsvg -o .. *.puml
```
