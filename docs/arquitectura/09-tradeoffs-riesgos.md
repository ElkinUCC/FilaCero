# 09 · Trade-offs, riesgos, supuestos e incertidumbres

## 1. Trade-offs aceptados

| # | Se gana | Se sacrifica | Por qué vale la pena | ADR |
|---|---|---|---|---|
| T-01 | Transacción local y simplicidad (monolito) | Escalar módulos por separado | 20× de margen medido; el caso no necesita escalar partes | 001 |
| T-02 | Cero sobreventa de cupos | Las reservas de **una** sede se serializan | Un pico de reservas dura segundos; la promesa vale más que milisegundos | 004 |
| T-03 | `READ COMMITTED` ve datos frescos | Lecturas no repetibles dentro de una transacción | Las decisiones críticas se toman con el bloqueo tomado | 004 |
| T-04 | Revocación inmediata de sesiones | Una lectura de BD por petición autenticada | Consulta por clave primaria (< 1 ms) | 005 |
| T-05 | Polling simple y autorrecuperable | Tráfico aun sin cambios (≈ 0,6 Mbps con 8 asesores) | Usa ≈ 5 % de la capacidad; sin servidor asíncrono | 007 |
| T-06 | Identificación inequívoca en sala | Exposición del nombre completo | Pedido del docente; configurable; nunca se expone el celular | 008 |
| T-07 | Voz gratuita, sin red | Calidad de voz depende del equipo | Funciona en el aula sin internet | 009 |
| T-08 | Preparación con una migración aditiva | No se modela inventario | Resuelve la promesa con el mínimo cambio | 010 |
| T-09 | Historia íntegra | La baja no es reversible desde la UI | Integridad de indicadores y auditoría | 011 |
| T-10 | Costo cero y demo sin red | Disponibilidad de un solo equipo | Es una demostración académica | 012 |
| T-11 | Panel uniforme (6 columnas, detalle al clic) | Un clic adicional para ver el detalle | Pedido del docente: vistas menos cargadas | — |

## 2. Riesgos

Probabilidad (P) e impacto (I): Alta / Media / Baja.

| ID | Riesgo | P | I | Mitigación | Estado |
|---|---|---|---|---|---|
| R-01 | Sobreventa de cupos por concurrencia en MySQL | M | A | Bloqueo por sede + `FOR UPDATE` + `READ COMMITTED`; prueba de carga real | **Mitigado en esta entrega** (se detectó 18/6, ahora 6/6) |
| R-02 | Falla del único nodo durante la presentación | B | A | Ensayo previo, guion de verificación (`simulacion.py --url`), datos recargables con un comando | Aceptado |
| R-03 | Pérdida de datos sin respaldo | M | M | En producción: respaldo diario de la BD administrada; en demo: `simulacion.py --cargar` regenera los datos | Aceptado (demo) |
| R-04 | Exposición de datos personales (nombre en sala, token en `localStorage`) | M | M | Celular nunca en sala; DTO públicos; `SALA_NOMBRE_COMPLETO` configurable; React escapa HTML | Mitigado parcialmente |
| R-05 | Saturación de CPU si crecen sedes y polling | B (hoy) | M | Escalar procesos detrás de nginx; `ETag`/SSE (E-2) | Monitoreado |
| R-06 | Fuga entre organizaciones por una consulta fuera del ORM | B | A | Filtro automático; prohibición de SQL crudo; `test_multiempresa.py` | Mitigado |
| R-07 | Deuda técnica: consultas en controladores de métricas | A | B | Mover a `agentes/repositorios.py` sin cambiar el contrato | Abierto (planificado) |
| R-08 | Navegador sin voz en español o que bloquea el audio | M | B | Botón "Repetir", estado visible en pantalla, el clic en "Llamar" habilita el audio | Mitigado |
| R-09 | Límite de peticiones en memoria no compartido entre procesos | B (hoy) | M | Con varios procesos, mover a almacén compartido (Redis o tabla) | Aceptado (un proceso) |
| R-10 | Olvidar `flask db upgrade` tras actualizar el código | M | A | Guía de actualización con el paso explícito; la migración es aditiva y segura de repetir | Mitigado |

## 3. Supuestos

| ID | Supuesto | Si no se cumple |
|---|---|---|
| S-01 | Una atención dura como máximo 10 minutos (3 por asesor y franja) | Se ajusta `DURACION_MAX_ATENCION_MIN` o `CUPOS_POR_ASESOR_FRANJA`; sin cambios de código |
| S-02 | 4 sedes, 2 asesores por sede, ≈ 30 ciudadanos simultáneos en pico | Ver escenario E-2 |
| S-03 | Los ciudadanos tienen celular para el OTP | Se requeriría reserva asistida en sede (fuera de alcance) |
| S-04 | Las TV de sala tienen un navegador moderno | Alternativa: un PC pequeño conectado a la TV |
| S-05 | Un pedido se prepara en una sede (no se traslada entre sedes) | Requeriría modelar órdenes (ADR-010, alternativa descartada) |
| S-06 | El equipo de demostración tiene ≥ 4 GB RAM y MySQL 8 instalado | Usar `DATABASE_URL=sqlite:///...` solo para mostrar pantallas (no la concurrencia) |

## 4. Incertidumbres

| ID | Pregunta abierta | Cómo se resolvería |
|---|---|---|
| I-01 | ¿Cuál es la carga real en hora pico de un centro de servicio? | Medir en un piloto con la misma prueba de `simulacion.py --carga` y ajustar el modelo de [05](05-arquitectura-fisica.md) |
| I-02 | ¿Qué proveedor SMS/WhatsApp y a qué costo por mensaje? | Cotizar; el costo variable domina sobre la infraestructura |
| I-03 | ¿Qué texto de autorización de tratamiento de datos exige el negocio real? | Revisión legal (Ley 1581); agregar casilla de aceptación al reservar |
| I-04 | ¿La voz del sistema operativo es comprensible en una sala ruidosa? | Prueba de campo; si no, TTS en la nube (ADR-009, alternativa) |
| I-05 | ¿Los asesores tendrán tiempo real para preparar pedidos entre franjas? | Medir `preparacion.fecha` vs. llegada en el historial durante un piloto |
