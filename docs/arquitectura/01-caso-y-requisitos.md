# 1. Caso, alcance y requisitos arquitectónicamente relevantes

## 1.1 Problema

En un centro de servicio técnico con varias sedes (caso de referencia: **TecniVisión**, reparación de televisores, 5 sedes en Antioquia y Córdoba) las personas llegan sin cita, hacen fila sin saber cuánto esperarán y la demanda se concentra en horas pico. Un sistema de turnos tradicional reduce la fila física, pero **no garantiza cuándo** será atendida la persona: un turno reservado para "las 4:00 p. m." puede terminar atendiéndose a las 5:10 p. m.

**FilaCero** resuelve un problema más específico:

> Si una persona reserva la franja de 4:00–4:30 p. m., su atención debe **empezar dentro de esa franja**.

Esa promesa es la fuerza que más condiciona la arquitectura.

## 1.2 Alcance

| Incluido | Fuera del alcance actual |
|---|---|
| Reserva pública sin cuenta, verificando el celular | Pagos, facturación, seguimiento de la reparación del equipo |
| Franjas de 30 min, todos los días de 8:00 a 18:00 | Agenda distinta por sede o festivos (configurable a futuro) |
| Consola del asesor con asistente de despacho | Integración con el sistema de inventario del taller |
| Panel de administración, supervisión y auditoría | App móvil nativa (la web es adaptable) |
| Pantalla de sala de espera con anuncios por voz | Envío real de SMS (proveedor por contratar, ver ADR-0008) |

## 1.3 Actores

| Actor | Necesidad principal | Canal |
|---|---|---|
| Ciudadano | Reservar sin registrarse, saber su espera, cancelar | Portal web (celular o PC) |
| Asesor | Saber a quién llamar, cuánto tiempo le queda, no retrasar la franja | Consola del asesor |
| Administrador | Configurar sedes, servicios y personal; medir el cumplimiento | Panel de administración |
| Supervisor | Ver el estado y los indicadores sin poder modificar | Panel (solo lectura) |
| Sala de espera | Mostrar y anunciar quién sigue | Pantalla en TV (`/sala`) |
| Proveedor de SMS (externo) | Entregar el código de verificación | API HTTPS (pendiente) |

## 1.4 Restricciones

| ID | Restricción | Origen |
|---|---|---|
| C1 | Proyecto académico: equipo pequeño, un semestre, presupuesto bajo | Curso |
| C2 | Stack del curso: Python/Flask, base de datos relacional (MySQL), frontend web | Programa del curso |
| C3 | Horario de atención 8:00–18:00 todos los días, franjas de 30 min | Negocio |
| C4 | Atención máxima de 10 min por persona | Regla de negocio (puntualidad) |
| C5 | El ciudadano no debe crear cuenta ni contraseña | Usabilidad / inclusión |
| C6 | Datos personales (nombre, celular) protegidos — Ley 1581 de 2012 (Colombia) | Legal |
| C7 | Debe poder ejecutarse en Windows (equipo de desarrollo) y en Linux (servidor) | Entorno del equipo |

## 1.5 Requisitos arquitectónicamente relevantes (RAR)

| ID | Requisito | Por qué es arquitectónico | Decisiones que condiciona |
|---|---|---|---|
| **RAR-01** | Una reserva aceptada debe poder atenderse dentro de su franja | Obliga a limitar la demanda por capacidad real y a ordenar la cola por plazo | ADR-0002, ADR-0003 |
| **RAR-02** | Nunca aceptar más reservas que el cupo, aun con reservas simultáneas | Exige control de concurrencia en la persistencia | ADR-0004 |
| **RAR-03** | El cupo depende de los asesores activos de cada sede (3 por asesor y franja) | La capacidad es dinámica y se comparte entre todos los servicios de la sede | ADR-0002 |
| **RAR-04** | El asesor y el administrador ven cambios casi en tiempo real (≤ 5–15 s) | Define el mecanismo de actualización cliente-servidor | ADR-0005 |
| **RAR-05** | Reservar sin cuenta, pero evitando reservas falsas o suplantación | Define identidad del ciudadano e integración externa (SMS) | ADR-0008 |
| **RAR-06** | Tres roles de personal con permisos distintos; cambios de rol efectivos de inmediato | Define autenticación, autorización y revocación | ADR-0007 |
| **RAR-07** | Trazabilidad de acciones sensibles (ingresos, roles, contraseñas, catálogo) | Requiere un componente de auditoría transversal | Componente Auditoría |
| **RAR-08** | Operable por un equipo pequeño, con bajo costo y despliegue simple | Favorece un solo desplegable y un solo servidor | ADR-0001, ADR-0006 |
| **RAR-09** | Accesible (WCAG 2.2 AA) para personas con baja visión o que usan lector de pantalla | Afecta la presentación y agrega la pantalla de sala con voz | Frontend `ui/Accesibilidad` |

## 1.6 Supuestos de partida

| ID | Supuesto | Cómo se validaría |
|---|---|---|
| S1 | ~8 asesores y ~500 turnos/día como máximo (5 sedes × 20 franjas × cupo) | Datos reales de TecniVisión tras un mes de operación |
| S2 | Los ciudadanos tienen celular colombiano (10 dígitos, inicia en 3) | Porcentaje de reservas rechazadas por formato |
| S3 | La mayoría de atenciones dura ≤ 10 min (simulación: 95 %) | Indicador "Dentro de 10 min" en producción |
| S4 | Una sola instancia de la API es suficiente para la carga esperada | Prueba de carga con MySQL en el servidor real |
