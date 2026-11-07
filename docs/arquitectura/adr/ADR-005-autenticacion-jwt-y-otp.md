# ADR-005 · JWT con versión de sesión y OTP para ciudadanos

- **Estado**: Aceptado · **Atributos**: seguridad, usabilidad · **Riesgos**: R-04

## Contexto
Dos públicos: el **personal** (cuentas con rol) y el **ciudadano** (no debe crear cuenta). El administrador
necesita que eliminar, bloquear o cambiar de rol a alguien tenga efecto inmediato.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Sesiones en servidor (cookie) | Revocación natural | Estado en el servidor; CSRF; peor para varios clientes |
| JWT puro | Sin estado | No se puede revocar antes de que expire |
| **JWT + `version_sesion` en BD** verificada por `requiere_rol` | Revocación inmediata, multi-cliente | Una consulta a `usuarios` por petición |
| Ciudadano con cuenta y contraseña | Identidad fuerte | Fricción: abandono de la reserva |
| **Ciudadano con OTP al celular** y token firmado por propósito | Sin cuenta; solo el dueño del celular ve o cancela | Costo de SMS en producción |

## Decisión
Personal: JWT de 60 min con claims `rol`, `org_id` y `ver`. Cambio de clave, rol, desactivación o **baja**
incrementan `version_sesion` y el token anterior deja de servir. Ciudadano: OTP de 6 dígitos (5 min, 5 intentos)
y token firmado con propósito (`reserva`, `consulta`, `cancelacion`) y código de turno.

## Consecuencias
- (+) La baja lógica de un asesor (ADR-011) corta su consola en la siguiente petición (probado).
- (−) Una lectura de usuario por petición autenticada (barata, por clave primaria).
