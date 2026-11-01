# FilaCero · Proyecto final de arquitectura

**Caso:** TecniVisión, centro de reparación de televisores con 5 sedes, 2 administradores y 8 asesores, atención todos los días de 8:00 a 18:00.

**Decisión central:** limitar la demanda a la capacidad real de cada sede (3 personas por asesor cada 30 min) y despachar por plazo de la franja, para que **quien reserva una franja empiece a ser atendido dentro de ella**.

## Historia arquitectónica en una línea por paso

1. **Problema:** los turnos reducen la fila, pero no garantizan *cuándo* se atiende → `01`
2. **RAR prioritario:** RAR-01 (atender dentro de la franja) y RAR-02 (nunca sobrecupo) → `01`
3. **Atributos:** confiabilidad de la promesa > integridad > seguridad > usabilidad → `02`
4. **Decisiones:** cupo por sede (ADR-0002), despacho EDF (ADR-0003), concurrencia (ADR-0004) sobre un monolito modular (ADR-0001) → `adr/`
5. **Vistas:** Context → Container → Component (API) → `03`; capas y dominios → `04`
6. **Ejecución:** un servidor con Docker Compose (nginx + waitress + MySQL), capacidad medida → `05`
7. **Integración:** REST + consulta periódica; SMS como integración crítica aislada → `06`
8. **Consecuencias:** atributos con evidencia → `07`; riesgos, trade-offs y supuestos → `08`
9. **Evolución:** lo que cambió en el semestre y el escenario "proveedor SMS lento" → `09`
10. **Verificación** contra la guía 16 → `10`

## Índice

| Documento | Contenido |
|---|---|
| [01-caso-y-requisitos.md](01-caso-y-requisitos.md) | Problema, alcance, actores, restricciones, RAR, supuestos |
| [02-atributos-de-calidad.md](02-atributos-de-calidad.md) | Prioridades y escenarios de calidad con evidencia |
| [03-vistas-c4.md](03-vistas-c4.md) | C4 Context, Container, Component y trazabilidad |
| [04-arquitectura-logica.md](04-arquitectura-logica.md) | Dominios, capas, dependencias, persistencia |
| [05-computacional-y-despliegue.md](05-computacional-y-despliegue.md) | Nodos, recursos, capacidad medida, escalamiento, disponibilidad |
| [06-integracion-y-persistencia.md](06-integracion-y-persistencia.md) | Flujo de reserva, contratos, sincronía, SMS, datos |
| [07-analisis-de-atributos.md](07-analisis-de-atributos.md) | Rendimiento, disponibilidad, seguridad, costo, escalabilidad |
| [08-riesgos-tradeoffs-supuestos.md](08-riesgos-tradeoffs-supuestos.md) | Matriz de riesgos y trade-offs |
| [09-evolucion.md](09-evolucion.md) | Evolución ocurrida y escenarios de cambio |
| [10-checklist-guia-16.md](10-checklist-guia-16.md) | Verificación de entregables y preparación de la sustentación |
| [adr/](adr/) | ADR-0001 a ADR-0008 |
| [img/](img/) · [diagramas/](diagramas/) | Diagramas en PNG y su fuente Mermaid editable |

## Regenerar los diagramas

```bash
npm install -g @mermaid-js/mermaid-cli
cd docs/arquitectura/diagramas
for f in *.mmd; do mmdc -i "$f" -o "../img/${f%.mmd}.png" -b white -w 1600 -s 2; done
```
