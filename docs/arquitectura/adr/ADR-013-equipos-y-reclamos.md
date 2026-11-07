# ADR-013 · Equipos y reclamos como módulos de dominio propios

- **Estado**: Nuevo (entrega final, iteración 2) · **Atributos**: cumplimiento de la promesa, modificabilidad, privacidad

## Contexto
Para que "cuando el ciudadano llegue, todo esté hecho", el sistema necesita saber **qué equipos tiene cada
cliente con nosotros y en qué estado están**. Además, los reclamos no deben obligar a ir a la sede: se radican en
línea y, si la persona quiere, se siguen en persona. En la iteración 1 la preparación era un subestado del turno
(ADR-010); eso no alcanza para un equipo que pasa días en el taller y existe antes y después de cualquier cita.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Seguir con campos dentro de `turnos` | Sin tablas nuevas | Un equipo vive más que un turno; no se puede consultar "mis equipos" |
| **Módulos `equipos` y `reclamos`** con sus capas (modelo, repositorio, servicio, DTO, controlador) | Ciclo de vida propio, reutilizable desde reserva, consola y consulta | Dos tablas y endpoints nuevos |
| Integración con un ERP externo | Datos reales | No existe en el caso; acoplamiento y costo |

## Decisión
- `equipos`: orden de servicio por cliente (celular) y sede: `POR_RECIBIR → RECIBIDO → EN_REPARACION → LISTO → ENTREGADO`.
  El asesor lo recibe desde la consola; el ciudadano lo ve tras verificar su celular.
- `reclamos`: `RADICADO → EN_GESTION → RESUELTO`, con respuesta visible para el ciudadano; opción "en persona" que además reserva un turno.
- `tramites.tipo_flujo` (`GENERAL`, `ENTREGA`, `GARANTIA`, `RECLAMO`) decide qué pasos muestra el asistente de reserva:
  ENTREGA exige un equipo **LISTO** del mismo celular; GARANTIA exige marca, falla y compra de **máximo 1 año**.
- El turno solo **referencia** el equipo o el reclamo (`turnos.equipo_id`, `turnos.reclamo_id`).
- La identidad del ciudadano sigue siendo el **celular verificado por OTP** (`turnos/otp.celular_del_token`), sin cédula ni contraseña.

## Consecuencias
- (+) La reserva deja de ser solo "una hora": la persona elige *qué* va a recoger y el asesor lo tiene identificado.
- (+) Los reclamos en línea no consumen cupos de atención.
- (+) Dependencias en una sola dirección: `turnos` y `agentes` usan servicios de `equipos`/`reclamos`; estos no conocen el despacho.
- (−) Más superficie de datos personales: el serial se muestra parcialmente al ciudadano y el celular nunca en vistas públicas.
- (−) No hay inventario de repuestos: la demora se comunica con la nota del equipo o con `NOVEDAD` en la preparación.
