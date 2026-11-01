# 8. Riesgos, trade-offs, supuestos e incertidumbres

## 8.1 Matriz de riesgos

| ID | Riesgo | Probabilidad | Impacto | Cómo se detectaría | Mitigación / respuesta |
|---|---|---|---|---|---|
| R1 | Atenciones que superan 10 min de forma habitual en un servicio | Media | Alto (rompe la promesa) | Indicador "Dentro de 10 min" < 90 % por servicio | Alertas del asistente a los 8 y 10 min; ajustar `DURACION_MAX_ATENCION_MIN` o cupo de ese servicio |
| R2 | Asesor ausente sin desactivar → la sede queda sobre-agendada | Media | Alto | "En riesgo" > 0 en el panel; asesor sin turnos atendidos | Desactivar al asesor reduce el cupo de inmediato; revisión diaria del supervisor |
| R3 | Escalar a varias instancias de la API sin mover el estado en memoria (OTP, límite por IP, candado por sede) | Baja hoy | Alto | Diferencias de límites entre instancias; códigos OTP "inválidos" | No escalar horizontalmente sin Redis; el `FOR UPDATE` de MySQL mantiene la integridad del cupo |
| R4 | Proveedor SMS lento o caído | Media | Alto (nadie puede reservar en línea) | Errores 503 en `/solicitar-codigo`; monitoreo del proveedor | Escenario de evolución: timeout + reintento + verificación en sede |
| R5 | XSS roba el token guardado en `localStorage` | Baja | Alto | Auditoría con accesos desde IP extrañas | CSP estricta sin scripts externos; React escapa el contenido; tokens de 60 min; revocación por logout |
| R6 | Capacidad real con MySQL y red distinta a la medida en local | Media | Medio | Prueba de carga en el servidor | Repetir `simulacion.py --carga` en el servidor antes de abrir al público |
| R7 | Pérdida de datos por falla del disco de la VM | Baja | Alto | Fallo del volumen | Respaldo diario externo + prueba de restauración (pendiente) |
| R8 | Ciudadanos sin celular o con número extranjero | Media | Medio (exclusión) | Llamadas o quejas en sede | Reserva asistida por el asesor en sede (operativo); ampliar validación de números |

## 8.2 Trade-offs aceptados

| Decisión | Se gana | Se sacrifica |
|---|---|---|
| Cupo por sede (ADR-0002) | Promesa cumplible por construcción | Menos reservas aceptadas en horas pico |
| Monolito modular (ADR-0001) | Simplicidad, transacciones locales | Escalado y despliegue independiente por dominio |
| Candado por sede (ADR-0004) | Cero sobrecupo | Reservas de una misma sede en serie |
| Consulta periódica (ADR-0005) | Operación simple detrás de nginx | Hasta 5 s de demora en avisos; tráfico constante |
| Rol validado en BD (ADR-0007) | Revocación inmediata | Una consulta extra por petición |
| Reserva con OTP (ADR-0008) | Sin cuentas ni contraseñas para el ciudadano | Dependencia y costo de un proveedor externo |
| Un servidor (ADR-0006) | Costo bajo | Punto único de fallo |

## 8.3 Supuestos (vigentes)

| ID | Supuesto | Estado |
|---|---|---|
| S1 | ≤ 8 asesores y ≈ 500 turnos/día | Supuesto del caso TecniVisión |
| S2 | Celulares colombianos de 10 dígitos | Validado en el código; pendiente medir rechazos |
| S3 | ≈ 95 % de atenciones ≤ 10 min | Solo simulado |
| S4 | Una instancia es suficiente | Medido en local con margen ≈ 25×; pendiente en servidor real |
| S5 | Los navegadores de sede soportan síntesis de voz en español | Chrome/Edge sí; depende del equipo de la sala |

## 8.4 Incertidumbres declaradas (no se inventaron datos)

- **Costo mensual** de la VM y del proveedor de SMS: a cotizar.
- **SLA** del proveedor de SMS: desconocido.
- **Tiempo de recuperación** real tras una caída del servidor: no cronometrado.
- **Puntualidad real**: el 99,8 % proviene de la simulación; el valor real se conocerá tras operar con el indicador del panel.
