# 01 · Síntesis del problema

## 1. Problema

En los puntos de atención presencial (centros de servicio técnico, notarías, oficinas de servicios
públicos) la persona llega sin saber cuánto esperará, hace fila física y, cuando por fin la atienden,
muchas veces lo que necesita **no está listo**: el equipo no ha sido probado, la garantía no se ha
revisado o falta un documento. El resultado es doble espera: la de la fila y la de la preparación.

FilaCero resuelve las dos:

1. **Fila cero**: el ciudadano reserva una franja de 30 minutos y el sistema solo ofrece los cupos que
   los asesores alcanzan a atender. *Si apartas de 1:30 a 2:00, te atienden en ese rango.*
2. **Preparación previa** (entrega final): al reservar, la persona dice qué necesita; el asesor alista
   el pedido antes de la llegada y el ciudadano ve su avance ("¡Tu pedido está listo!"). En el módulo
   solo recoge o firma.

Caso de negocio simulado: **TecniVisión**, centro de reparación de televisores con 4 sedes en el Valle de
Aburrá, 8 asesores, atención todos los días en franjas de 30 minutos.

## 2. Alcance

| Dentro del alcance | Fuera del alcance (declarado) |
|---|---|
| Reserva, consulta y cancelación sin cuenta, con verificación OTP del celular | Pagos en línea |
| Franjas de 30 min con cupo por sede = asesores activos × 3 | Integración con un ERP externo (los equipos se registran en FilaCero) |
| Consola del asesor: cola proyectada, asistente de despacho, llamado por voz, preparación previa | App móvil nativa |
| Pantalla de sala para TV por sede | Envío real de SMS (modo prueba en localhost; ver supuestos) |
| Panel administrativo: resumen en vivo, sedes, trámites, asesores, usuarios y permisos, historial, actividad | Alta disponibilidad multi-nodo (se analiza como evolución) |
| Equipos de clientes (recepción → reparación → listo → entregado), garantía (≤ 1 año) y reclamos en línea o en persona | Inventario de repuestos y facturación |
| Multiempresa (varias organizaciones aisladas en la misma instalación) | Despliegue en internet o en servidores (la entrega se ejecuta **solo en localhost**) |

## 3. Actores

| Actor | Tipo | Objetivo principal | Canal |
|---|---|---|---|
| **Ciudadano** | Persona externa, sin cuenta | Reservar una franja, saber si su pedido está listo, ser atendido a tiempo | Portal web (SPA) |
| **Asesor** | Personal (rol `AGENTE`) | Atender la cola sin salirse de la franja; preparar pedidos antes de la llegada | Consola del asesor |
| **Administrador** | Personal (rol `ADMIN`) | Configurar sedes, trámites, asesores y permisos; supervisar | Panel administrativo |
| **Supervisor** | Personal (rol `SUPERVISOR`) | Consultar operación e indicadores (solo lectura) | Panel administrativo |
| **Público en sala de espera** | Personas en la sede (vía TV con navegador) | Ver y escuchar qué turno se llama y a qué módulo acercarse | Vista pública `#/sala` |
| **Proveedor SMS** | Sistema externo | Entregar el código OTP al celular | API HTTP (simulado en modo prueba) |

## 4. Restricciones

| Tipo | Restricción | Consecuencia arquitectónica |
|---|---|---|
| Académica | Monolito modular por capas, profesional, demostrable en **localhost** | Un proceso backend, módulos de dominio con capas internas; sin microservicios (ADR-001, ADR-012) |
| Tecnológica | Python/Flask, MySQL 8; frontend **sin frameworks** (HTML + CSS + JavaScript puro), exigencia del curso | SQLAlchemy + Alembic en el backend; SPA vanilla con módulos ES, sin compilación (ADR-002) |
| Operativa | Equipo de 2 integrantes (Elkin Amador y Andrés Reina), sin presupuesto de nube | Costo de infraestructura ≈ 0; despliegue en un nodo (ADR-012) |
| De negocio | Atención máxima de 10 min ⇒ 3 cupos por asesor y franja | Regla de capacidad centralizada en `app/horario.py` |
| Legal | Ley 1581 de 2012 (protección de datos personales, Colombia) | Mínimos datos del ciudadano (nombre + celular), celular enmascarado en vistas públicas, nunca en la sala (ADR-008) |
| Temporal | Entrega final en la semana 16 | Cambios pequeños, reversibles y probados; sin reescrituras |

## 5. Requisitos arquitectónicamente relevantes (RAR)

Son los requisitos que, si cambian, cambian la arquitectura (no solo una pantalla).

| ID | Requisito | Por qué es arquitectónico | Respuesta |
|---|---|---|---|
| RAR-01 | **Nunca vender más cupos de los que se pueden atender**, aunque varias personas reserven al mismo tiempo | Exige control de concurrencia y transacciones | Bloqueo por sede + `SELECT … FOR UPDATE` + `READ COMMITTED` (ADR-004) |
| RAR-02 | El ciudadano reserva **sin crear cuenta**, pero solo él puede ver o cancelar su turno | Define el modelo de identidad pública | OTP al celular + token firmado de propósito único (ADR-005) |
| RAR-03 | Un cambio de rol, desactivación o baja **corta el acceso de inmediato**, aun con sesión abierta | Invalida el modelo JWT "sin estado" puro | Versión de sesión en el token, verificada en cada petición (ADR-005) |
| RAR-04 | Varias organizaciones en la misma instalación **sin ver datos ajenos** | Afecta persistencia y todas las consultas | `organizacion_id` + filtro automático en el ORM (ADR-006) |
| RAR-05 | Asesor, sala y panel ven el estado **casi en tiempo real** (≤ 5 s en sala y consola) | Define el mecanismo de integración cliente-servidor | Polling con intervalos por vista (ADR-007) |
| RAR-06 | El pedido del ciudadano se **prepara antes de la llegada** y él lo ve | Nuevo ciclo de vida asociado al turno | Subestado de preparación en `turnos` (ADR-010) |
| RAR-07 | El llamado se **anuncia por voz** y se repite cada 20 s hasta que la persona llega | Integración con capacidades del dispositivo | Web Speech API en el navegador del asesor (ADR-009) |
| RAR-08 | La historia de atenciones es **inmutable** aunque se elimine un asesor | Integridad referencial e indicadores | Baja lógica (ADR-011) |
| RAR-09 | Toda acción sensible queda en una **bitácora** (quién, qué, cuándo, desde dónde) | Componente transversal | Módulo `auditoria` invocado desde los controladores |
| RAR-10 | Se demuestra en **localhost** con una sola orden por componente | Restricción de despliegue | Un nodo, tres procesos (ADR-012) |
| RAR-11 | Con **solo el celular verificado** el ciudadano ve sus equipos y reclamos y elige qué recoger | Identidad sin cuenta para datos que viven más que un turno | Módulos `equipos` y `reclamos` + token OTP (ADR-013) |
| RAR-12 | El panel muestra **qué hace cada asesor ahora** (atendiendo, pausa, almuerzo, fuera de turno) | Nuevo estado del personal | Presencia declarada + turno en curso (ADR-014) |
