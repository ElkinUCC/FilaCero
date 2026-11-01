# 7. Análisis de atributos: rendimiento, disponibilidad, seguridad, costo, escalabilidad

| Atributo | Escenario o necesidad del caso | Decisión relacionada | Trade-off / límite | Evidencia |
|---|---|---|---|---|
| **Confiabilidad de la promesa** | Atender dentro de la franja reservada | Cupo por sede = 3 × asesores (ADR-0002); despacho EDF con predicción (ADR-0003) | Se rechazan reservas antes de llenar "visualmente" la agenda | 99,8 % en simulación; falta operación real |
| **Rendimiento** | Consolas y pantallas consultan cada 4–5 s | Proyección EDF calculada por petición en la consola; índices por fecha/sede | Más CPU por consulta en lugar de mantener caché | p95 ≤ 273 ms a 139 pet./s (SQLite, 2 vCPU) |
| **Disponibilidad** | Operación 8–18 h todos los días | Un servidor, reinicio automático, health check con BD (ADR-0006) | VM única = punto único de fallo aceptado por costo | Configuración en `docker-compose.yml`; tiempo de recuperación por medir |
| **Seguridad** | Datos personales y operación del personal | JWT 60 min + rol en BD + revocación (ADR-0007); OTP (ADR-0008); bloqueo de cuenta; auditoría; CSP | Una consulta extra por petición; el token vive en `localStorage` (mitigado con CSP) | 20+ pruebas de seguridad; `pip-audit` y `npm audit` sin hallazgos; ver `SECURITY.md` |
| **Integridad** | Reservas simultáneas | Candado por sede + `FOR UPDATE` (ADR-0004) | Reservas de una misma sede se serializan | 18 simultáneas → 6 aceptadas con 6 cupos |
| **Escalabilidad** | Más sedes o asesores | Escalar verticalmente; estado volátil identificado para mover a Redis | Escalar horizontalmente requiere un cambio previo | Ver `05` §5.4 |
| **Mantenibilidad** | Equipo pequeño; reglas que cambian | Monolito modular; una regla en un solo lugar; 77 pruebas automáticas | Un desplegable: un error puede afectar todo el sistema | `python -m pytest` (77 pruebas; 84 con las del equipo) |
| **Usabilidad / accesibilidad** | Reservar sin cuenta; personas con baja visión | Una pantalla con desplegables; menú de accesibilidad; pantalla de sala con voz | La voz depende del navegador del equipo | axe-core: 0 violaciones WCAG 2.2 AA en 13 pantallas |
| **Costo / complejidad** | Proyecto con presupuesto bajo | Software libre; una VM; sin servicios gestionados obligatorios | Menor redundancia | VM 2 vCPU / 4 GB: costo mensual a cotizar con el proveedor elegido |

## 7.1 Preguntas que el equipo debe poder responder

- **¿Qué significa "buen rendimiento" aquí?** Que la consola del asesor y la pantalla de sala respondan en menos de medio segundo con la carga de 5 sedes (≈ 5 pet./s); medido: p95 ≤ 273 ms a 139 pet./s en local.
- **¿Qué significa "disponible"?** Operativo de 8:00 a 18:00; ante una caída, recuperación automática en segundos sin pérdida de turnos ya reservados.
- **¿Qué significa "seguro"?** Ningún tercero ve o cancela un turno ajeno; solo el personal autorizado opera; cada acción sensible queda registrada.
- **¿Qué atributo llevó a aceptar más complejidad?** La **integridad** (no sobrecupo): obligó a introducir bloqueo por sede y una prueba de concurrencia.
- **¿Qué atributo se ve afectado negativamente?** La **escalabilidad horizontal**: el estado en memoria (OTP, límite por IP) y el candado por proceso impiden poner varias instancias sin antes moverlos a Redis.
- **¿Qué falta medir antes de afirmar capacidad?** La misma prueba de carga con **MySQL en el servidor real** y a través de la red.
