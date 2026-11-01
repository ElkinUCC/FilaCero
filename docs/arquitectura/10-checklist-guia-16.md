# 10. Verificación del Momento Evaluativo 3 (Guía 16)

## 10.1 Verificación de entrada (Guía 16, §4)

| Verificación | Estado | Referencia |
|---|---|---|
| Problema, alcance y actores vigentes | Listo | `01-caso-y-requisitos.md` §1.1–1.3 |
| RAR y restricciones identificados | Listo | `01` §1.4–1.5 |
| Atributos de calidad priorizados | Listo | `02-atributos-de-calidad.md` |
| C4 Context vigente | Listo | `03-vistas-c4.md` §3.1 · `img/c4-contexto.png` |
| C4 Container vigente | Listo | `03` §3.2 · `img/c4-contenedores.png` |
| C4 Component vigente | Listo | `03` §3.3 · `img/c4-componentes-api.png` |
| Arquitectura lógica coherente | Listo | `04-arquitectura-logica.md` |
| Arquitectura computacional y recursos | Listo (con pendiente R6) | `05-computacional-y-despliegue.md` §5.3 |
| Diagrama de despliegue vigente | Listo | `05` §5.1 · `docker-compose.yml` |
| Integración y persistencia justificadas | Listo | `06-integracion-y-persistencia.md` |
| ADR principales consolidados | Listo | `adr/0001`–`0008` |
| Trade-offs, riesgos y supuestos declarados | Listo | `08-riesgos-tradeoffs-supuestos.md` |
| Escenario de evolución analizado | Listo | `09-evolucion.md` |
| Referencias y evidencias organizadas | Listo | §10.3 |

## 10.2 Checklist final (Guía 16, §21)

| Criterio | Sí | Pendiente | Observación |
|---|:-:|:-:|---|
| La propuesta responde al problema y alcance real | ✓ | | Promesa de atención dentro de la franja |
| Los RAR aparecen trazados hacia decisiones | ✓ | | Tabla RAR → ADR en `01` §1.5 |
| Las vistas C4 son coherentes entre sí | ✓ | | Tabla de trazabilidad en `03` §3.4 |
| El despliegue corresponde a los contenedores | ✓ | | Mismos nombres: web, api, db |
| Integración y persistencia justificadas | ✓ | | SMS como integración crítica |
| Atributos con contexto suficiente | ✓ | | Escenarios QA-1…QA-11 con medida y evidencia |
| ADR con decisiones reales y consecuencias | ✓ | | 4 de ellos nacieron de hallazgos reales (ver `09` §9.1) |
| Alternativas comparadas sin caricaturizarlas | ✓ | | Cada ADR explica cuándo la alternativa sería mejor |
| Riesgos y supuestos declarados | ✓ | | R1–R8, S1–S5 |
| Evolución incorporada donde corresponde | ✓ | | ADR-0008, Context, Component y despliegue actualizados |
| No se inventaron métricas ni restricciones | ✓ | | Simulado y medido están rotulados; costos y SLA "a cotizar" |
| Cada integrante puede sustentar decisiones | | ✓ | Ver §10.4 para repartir decisiones |

## 10.3 Evidencias verificables

| Evidencia | Cómo reproducirla |
|---|---|
| 77 pruebas automáticas (84 con `test_mejoras_entrega.py` del equipo) | `cd backend && python -m pytest` |
| Verificación de punta a punta (50 comprobaciones) | `python simulacion.py` |
| Semana de operación simulada (≈ 2.000 turnos) | `python simulacion.py --cargar` |
| Prueba de carga y de sobrecupo | `python simulacion.py --carga --url http://127.0.0.1:5000` |
| Auditoría de dependencias | `pip-audit -r requirements.txt` · `npm audit` |
| Accesibilidad WCAG 2.2 AA | axe-core sobre 13 pantallas: 0 violaciones |
| Despliegue reproducible | `docker compose --env-file deploy/.env.produccion up -d --build` |
| Seguridad | `SECURITY.md` |

## 10.4 Preparación de la sustentación individual

Sugerencia de reparto (cada integrante defiende una decisión con su alternativa, trade-off y riesgo):

| Decisión | Alternativa descartada | Trade-off | Riesgo |
|---|---|---|---|
| ADR-0002 Cupo por sede | Cupo por trámite / fila FIFO | Menos reservas en pico | R2 asesor ausente |
| ADR-0003 Despacho EDF | FIFO por solicitud / ML | Más CPU por consulta | R1 atenciones largas |
| ADR-0004 Concurrencia | Optimista / cola | Reservas de una sede en serie | R3 varias instancias |
| ADR-0006 Despliegue | PaaS / Kubernetes | Punto único de fallo | R7 pérdida de datos |
| ADR-0007 + 0008 Seguridad | Sesiones / registro obligatorio | Consulta extra; dependencia SMS | R4, R5 |

**Respuestas preparadas a preguntas probables**

- *"¿Por qué no microservicios?"* La carga esperada es ≈ 5 pet./s y el cupo exige consistencia transaccional entre turnos de varios servicios; separar servicios obligaría a coordinar transacciones distribuidas sin ganar nada medible (ADR-0001). Los dominios tienen límites claros para extraerlos si un día hace falta.
- *"¿Qué pasa si se duplica la concurrencia?"* No se afirma sin medir: lo medido en local da margen ≈ 25×; el recurso que probablemente limita es la CPU (hipótesis: en local no se separó API de BD ni del generador de carga); primero se escala la VM; antes de varias instancias se mueve el estado a Redis (05 §5.4, R3, R6).
- *"Una integración externa tarda varios segundos"* → `06` §6.4 y `09` §9.2.
- *"¿Cómo saben que la promesa se cumple?"* Indicador "Atendidos dentro de su franja" en el panel (99,8 % simulado; meta 90 %) y la prueba que garantiza cero sobrecupo.
- *"¿Qué no pueden afirmar todavía?"* Capacidad con MySQL en el servidor real, puntualidad real, costos y SLA del proveedor de SMS (`08` §8.4).
