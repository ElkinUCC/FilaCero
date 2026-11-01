# ADR-0008 · Reserva sin cuenta verificando el celular (OTP)

- **Estado:** Aceptada · integración con proveedor SMS **pendiente**
- **RAR / atributos:** RAR-05 · usabilidad, seguridad

## Contexto
Pedir registro y contraseña a cada ciudadano reduce la adopción (C5). Sin verificación, cualquiera podría llenar los cupos con reservas falsas o suplantar a otra persona.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Registro obligatorio con contraseña | Identidad fuerte | Fricción; contraseñas olvidadas; más datos personales |
| Reserva sin verificación | Cero fricción | Reservas falsas que bloquean cupos reales |
| **Reserva sin cuenta + código de 6 dígitos al celular** (elegida) | Poca fricción; liga la reserva a un celular real | Depende de un proveedor externo de SMS y su costo |

## Decisión
`turnos/otp.py` genera el código (6 dígitos, 5 min, 5 intentos) y lo envía a través de un adaptador único. En desarrollo, el **modo prueba** muestra el código en pantalla; en producción ese modo está prohibido por configuración. Límite de 3 turnos activos por celular.

## Consecuencias
- ➕ Consultar y cancelar exigen código de turno **y** celular.
- ➖ Mientras no se contrate el proveedor, en producción la reserva pública responde 503 (comportamiento intencional: no se crean reservas sin verificar).
- **Revisar si:** el proveedor no cumple un SLA aceptable → ver la alternativa degradada en `09-evolucion.md`.
