# 10 · Evolución de la arquitectura

Aquí analizamos dos cambios que podrían llegar después de la entrega y cómo los absorbería la arquitectura
actual sin cambiar de estilo.

## E-2 · Crecimiento a 40 sedes y 200 asesores

**Estímulo**: TecniVisión se expande a una red nacional.

| Carga | Hoy | Escenario | Cálculo |
|---|---|---|---|
| Consolas | 1,6 req/s | 40 req/s | 200 asesores / 5 s |
| Salas | 1,0 req/s | 10 req/s | 40 TV / 4 s |
| Ciudadanos | 2,5 req/s | 25 req/s | × 10 |
| **Total** | ≈ 6 req/s | **≈ 80 req/s** | ≈ 65 % de un proceso medido (≈ 120 req/s) |
| Red de consolas | 0,6 Mbps | ≈ 15 Mbps | 46 KB × 40 / s |

**Qué se afecta y ajuste proporcional** (sin cambiar de estilo):

| Elemento | Ajuste | Nuevo trade-off |
|---|---|---|
| Despliegue | 2–3 procesos waitress detrás de nginx en un VPS de 4 vCPU; MySQL administrado | +costo (≈ 20–40 USD/mes), +operación |
| ADR-004 | Sigue válido: `FOR UPDATE` coordina entre procesos; el candado en memoria queda como optimización local | — |
| ADR-007 | Respuestas condicionales (`ETag`/`304`) en el panel del asesor o SSE para la sala | +complejidad en el cliente |
| Límite de peticiones (R-09) | Mover a almacén compartido | +dependencia (Redis o tabla) |
| Consola | Paginar la cola (solo hoy + próximos N) con `COLA_SOLO_HOY=true` | El asesor ve menos días |
| Datos | ≈ 15 MB/día a capacidad máxima (28 800 turnos × 0,44 KB + franjas) ⇒ archivar `turnos` por año | Consultas históricas más lentas |

Umbral para reconsiderar ADR-001: si un módulo (p. ej. la sala) necesita escalar 10× más que el resto, se
extrae como servicio de solo lectura alimentado por la misma BD o por eventos.

## E-3 · Avisar al ciudadano cuando su pedido esté listo

**Estímulo**: el negocio pide enviar un SMS/WhatsApp al pasar a `LISTO` o `NOVEDAD`.

| Elemento | Impacto |
|---|---|
| `scripts/turnos/preparacion.py` | Publica un evento "preparación cambiada" después del `commit` |
| Nuevo componente *Notificaciones* | Envía por el proveedor (reutiliza la interfaz de `scripts/turnos/otp.py`) con reintentos |
| Integración | Envío asíncrono (cola en tabla o Redis) para que un proveedor lento no frene al asesor |
| Costo | Variable por mensaje (I-02) |
| Privacidad | Consentimiento explícito del canal al reservar (I-03) |

El cambio es **local a un módulo nuevo** y a un punto de extensión ya identificado: la arquitectura lo absorbe
sin tocar reserva, despacho ni sala.
