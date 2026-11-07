# Cambios de la entrega final

## Iteración 4 (minichat, alertas y celular)

| Pedido | Implementación |
|---|---|
| "Por código" y "Por celular" sin mezclarse | Por código solo pide el código (TU-…); el SMS llega al celular registrado en el turno y se muestra enmascarado. Por celular solo pide el celular |
| Minichat cliente ↔ asesor | Cada reclamo o consulta tiene su conversación; nueva categoría **Consulta o diagnóstico previo**. Contadores de no leídos en el portal y en la consola |
| Asistente que responde solo | Responde al instante con reglas y datos reales (horario, estado del equipo, cédula, garantía); no inventa precios: lo confirma el asesor (ADR-016) |
| Avisos al asesor | Alertas emergentes: quedan ≤ 5 min de la franja con personas pendientes; la siguiente persona está en riesgo o atrasada (botón "Llamar a …"); mensaje nuevo de un cliente |
| Vista en celular | Portal compacto: encabezado corto, servicios en lista, días que caben en pantalla, botones Atrás/Continuar fijos abajo, tarjetas de equipo y chat adaptados |
| Tablero sin huecos y con IA de métricas | Filas parejas con márgenes iguales; **Asistente de métricas** con hallazgos accionables (alertas, hora pico, sede con menor asistencia, equipos sin recoger, reclamos sin atender) |

Migración `d2f4b6c8e0a1`. Pruebas: 155 en verde (+3).

## Iteración 3 (ajustes finales)

| Pedido | Implementación |
|---|---|
| Hora sin cuadrícula ni desplazamiento | Paso "Cuándo": días en una tira y la **hora en un desplegable** agrupado por Madrugada/Mañana/Tarde/Noche con franjas "10:00 – 10:30" y cupos; atajo "Lo más pronto" |
| Mensaje de preparación solo cuando aplica | La preparación se deriva del tipo de atención: solo **Entrega de equipo** y **Garantía**. Textos propios: "Tu equipo te espera listo… trae tu cédula" / "Revisamos tu garantía…"; en reclamo se muestra el radicado. Migración `c1e3a5b7d9f0` corrige los datos existentes |
| Consola sin números largos, llamado por nombre | Botones "Llamar a Juliana"; puesto con avatar de iniciales, nombre grande y debajo *trámite · Turno TU-XXXXXX · celular · C.C. ···4321*; cola y últimas atenciones por nombre |
| Cédula para dejar y recoger | `usuarios.documento`. Recibir un equipo exige la cédula del titular; **entregar** la pide en un modal y el servidor la compara. Cédulas inventadas para todos los clientes de la simulación |
| Códigos coherentes | Un solo formato visible: **TU-XXXXXX** (turno), **EQ-XXXXXX** (equipo), **RC-XXXXXX** (reclamo), en portal, consola, sala y panel; la consulta acepta el código corto |
| Tablero ejecutivo (admin = supervisor sin edición) | `GET /admin/agentes/tablero` + Resumen nuevo: indicador principal con meta, 6 tarjetas con contador animado, variación vs. periodo anterior y tendencia; turnos por día (actual vs. anterior) con cruz y tooltip; demanda por hora; desempeño por sede; taller y reclamos; filtro por sede; Hoy/7/30/90 días; tabla y CSV |
| Seguridad | Revisión STRIDE en `docs/arquitectura/11-seguridad.md`: verificación antes de buscar en consultas públicas (sin enumeración), cédula enmascarada, depurador solo en loopback, rango del tablero acotado; `pip-audit` y `npm audit` sin vulnerabilidades |
| Manual | `docs/MANUAL_FilaCero.html`, mismo formato que el manual de referencia |

Pruebas: 152 en verde (+5). ADR-010 revisado, ADR-015 nuevo, escenario E-1c en evolución.

## Iteración 2 (revisión de la simulación)

| Pedido | Implementación |
|---|---|
| Quitar Accesibilidad | Menú retirado de portal, consola, panel y sala; se limpian preferencias guardadas. La voz del llamado del asesor se mantiene |
| Vista del cliente más dinámica | `ReservarTurno.jsx` reescrito como **asistente paso a paso** con transiciones: ¿qué necesitas? → tu celular → (equipo / televisor / reclamo) → cuándo → confirmar. Horarios como botones (mañana, tarde, noche) |
| Recoger un producto: buscar por celular y elegir cuál | Tras verificar el celular se consultan sus equipos (`POST /equipos/publico/mios`); solo los **LISTO** se pueden elegir, los demás muestran su avance; la sede se fija sola; el nombre se completa si ya es cliente |
| Garantía: marca y fecha ≤ 1 año | Paso "Tu televisor": marcas, fecha de compra validada en vivo y en el servidor (365 días), falla. Al reservar se crea el equipo "Por recibir" |
| Reclamos separados de garantía, en línea o en persona | Trámite "Reclamos": motivo, sede, equipo opcional, texto; **En línea** radica sin turno; **En persona** radica y reserva |
| Consola: crear/ingresar solicitudes | Pestañas **Atención · Equipos · Reclamos**. Tablero del taller (Por revisar → En reparación → Listo → Entregado) con "Recibir equipo"; en el puesto: "Entregar equipo", "Recibir equipo" o "¿Deja un equipo? Registrarlo" |
| Asesores: estado = lo que hace ahora | Selector **Disponible / En pausa / En almuerzo / Fuera de turno** en la consola; el panel muestra Atendiendo, Llamando o la presencia |
| Sedes alineada | Columnas numéricas y estado centrados, anchos por sección |
| Trámites sin preguntas adicionales | Se quitaron preguntas, "ayuda para reservar" y la vista previa; se agregó **Tipo de atención** (General, Entrega, Garantía, Reclamo) |

Backend: módulos nuevos `app/dominios/equipos` y `app/dominios/reclamos` (modelo, repositorio, servicio, DTO, controlador),
presencia del asesor, `tramites.tipo_flujo`, vínculos `turnos.equipo_id`/`reclamo_id`. Migración `b8d0f2a4c6e9`.
Pruebas: `tests/test_equipos_reclamos.py` (9 casos). Simulación: equipos, reclamos, estados de asesores y cliente demo.

## Iteración 1

| Observación | Implementación |
|---|---|
| Color de accesibilidad como principal en el cliente | Paleta de alto contraste por defecto en el portal |
| Voz al llamar y cada 20 s con turno/nombre y módulo | `hooks/useLlamadoPorVoz.js`, botón Voz, Repetir, Silenciar |
| Sala con nombre completo | `SALA_NOMBRE_COMPLETO` (por defecto true) |
| Panel uniforme con detalle al clic | `TablaSeccion` (6 columnas) + `PanelDetalle` |
| Eliminar asesor | Baja lógica que conserva el historial |
| Preparación previa | Por preparar / En preparación / Listo / Con novedad |
| Corrección de concurrencia | `READ COMMITTED` en MySQL: ya no se sobrevenden franjas (ADR-004) |

## Totales

155 pruebas en verde · 50/50 comprobaciones de punta a punta contra MySQL · 0 sobreventas en la prueba de concurrencia ·
15 ADR · documento de arquitectura en `docs/arquitectura/`.
