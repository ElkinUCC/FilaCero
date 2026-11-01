# 2. Atributos de calidad prioritarios

No todos los atributos pesan igual. El orden refleja cuánto condicionó cada uno la arquitectura.

| Prioridad | Atributo | Qué significa **en este caso** |
|---|---|---|
| 1 | **Confiabilidad de la promesa (puntualidad)** | ≥ 90 % de las atenciones empieza dentro de la franja reservada |
| 2 | **Integridad / consistencia** | Nunca hay sobrecupo, aunque lleguen reservas simultáneas |
| 3 | **Seguridad** | Datos personales protegidos; solo el personal autorizado opera; acciones trazables |
| 4 | **Usabilidad y accesibilidad** | Reservar en una pantalla, sin cuenta; WCAG 2.2 AA |
| 5 | **Mantenibilidad** | Un equipo pequeño entiende y cambia un dominio sin romper otros |
| 6 | **Rendimiento** | Respuestas interactivas (p95 < 500 ms) con la carga esperada |
| 7 | **Disponibilidad** | Operación en horario 8–18; recuperable en minutos ante una caída |
| 8 | **Costo / complejidad** | Un servidor modesto; sin servicios gestionados obligatorios |

## 2.1 Escenarios de calidad (estímulo → respuesta → medida)

| ID | Atributo | Estímulo | Respuesta esperada | Medida | Evidencia actual |
|---|---|---|---|---|---|
| QA-1 | Puntualidad | Día normal de operación, 8 asesores | Cola ordenada por plazo de la franja; alertas al asesor | ≥ 90 % atendidos dentro de su franja | Simulación de una semana: **99,8 %** (`simulacion.py --cargar`) — dato simulado, falta validar con operación real |
| QA-2 | Puntualidad | Una atención se alarga más de 10 min | El asistente alerta a los 8 min y en rojo a los 10 min; recalcula los turnos en riesgo | Alerta visible en ≤ 5 s | `test_despacho.py::test_alerta_cuando_la_atencion_supera_10_minutos` |
| QA-3 | Integridad | 18 reservas simultáneas a una franja con 6 cupos | Se aceptan exactamente 6 | 0 reservas por encima del cupo | `simulacion.py --carga`: **6 aceptadas, 12 rechazadas**; `test_reservas_concurrentes.py` |
| QA-4 | Seguridad | 5 contraseñas erradas para una cuenta | Cuenta bloqueada 15 min; evento en la bitácora | 100 % de los casos | `test_bloqueo_tras_5_intentos...` |
| QA-5 | Seguridad | Al asesor se le cambia el rol con la sesión abierta | Pierde el acceso en la siguiente petición | ≤ 1 petición | `test_cambio_de_rol_aplica_de_inmediato` |
| QA-6 | Seguridad | Un tercero consulta un turno ajeno | 404/400 sin revelar si existe; celular enmascarado | 0 datos expuestos | `test_espera_de_turno_ajeno_responde_404`, `test_reserva_consulta_y_cancelacion_publica` |
| QA-7 | Rendimiento | 40 usuarios simultáneos consultando disponibilidad y sala | Respuestas sin errores | p95 < 500 ms | **p95 218–273 ms, 139 pet./s, 0 errores** (medición local, ver §5 de computacional) |
| QA-8 | Usabilidad | Ciudadano nuevo reserva desde el celular | Una sola pantalla, sin cuenta | Reserva en < 2 min | Revisión con capturas; pendiente prueba con usuarios reales |
| QA-9 | Accesibilidad | Persona con lector de pantalla o baja visión | Navegación por teclado, contraste, texto grande, voz | 0 violaciones axe-core WCAG 2.2 AA | **0 violaciones en 13 pantallas** (auditoría axe-core 4.10) |
| QA-10 | Mantenibilidad | Cambiar la regla de cupo (p. ej. 4 por asesor) | Un solo punto de cambio | 1 variable de configuración | `CUPOS_POR_ASESOR_FRANJA` en `config.py` |
| QA-11 | Disponibilidad | Se reinicia el contenedor de la API | Docker lo reinicia; los datos persisten en MySQL | Recuperación < 1 min | `restart: unless-stopped` + `HEALTHCHECK /health/listo` (pendiente cronometrar en servidor) |

## 2.2 Relación atributo → decisión

| Atributo | Decisión que lo favorece | Costo que introduce |
|---|---|---|
| Puntualidad | Cupo por sede (ADR-0002) + despacho EDF (ADR-0003) | Se rechazan reservas aunque "parezca" que hay espacio |
| Integridad | Candado por sede + bloqueo de fila (ADR-0004) | Las reservas de una misma sede se procesan de a una |
| Seguridad | JWT corto + rol validado en BD + revocación (ADR-0007) | Una consulta extra a la BD por petición |
| Usabilidad | Reserva sin cuenta con OTP (ADR-0008) | Dependencia de un proveedor de SMS |
| Mantenibilidad / costo | Monolito modular (ADR-0001) + un servidor (ADR-0006) | Escalamiento solo vertical hasta mover estado a Redis |
| Tiempo real | Consulta periódica (ADR-0005) | Tráfico constante aunque no haya cambios |
