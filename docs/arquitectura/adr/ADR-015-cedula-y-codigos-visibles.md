# ADR-015 · Cédula para entregar equipos y códigos visibles uniformes

- **Estado**: Nuevo (iteración 3) · **Atributos**: seguridad (autorización de la entrega), usabilidad, privacidad

## Contexto
1. Un equipo se podía entregar con solo el celular del cliente. El celular **identifica** (llega el código SMS),
   pero no prueba que quien está en el módulo sea el dueño: cualquiera con el teléfono prestado podía llevarse el televisor.
2. La consola mostraba identificadores largos (`FC-20261107-6B6B50`) mientras equipos y reclamos usaban códigos cortos
   (`EQ-9877E2`, `RC-D4079A`). Tres formatos distintos confundían a asesores y ciudadanos.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Cédula registrada al recibir el equipo y exigida al entregarlo** | Práctica habitual en talleres; cero hardware; el backend compara | Dato personal: hay que protegerlo |
| Código de retiro de un solo uso por SMS | No guarda documentos | Depende de tener el celular en mano; no prueba identidad |
| Firma digital / biometría | Fuerte | Hardware y costo fuera del alcance |

Para los códigos: renombrar los turnos en la base (migración destructiva) frente a **mostrar un código corto**
derivado del existente.

## Decisión
- `usuarios.documento` (6–12 dígitos). Se registra al **recibir** el equipo (formulario del asesor o garantía
  "Por recibir → Recibido") y se exige y compara al **entregar** (`409` si no coincide).
- La cédula **nunca viaja completa** a la interfaz: los DTO devuelven `···4321`. La verificación ocurre en el servidor.
- Código visible del turno `TU-XXXXXX` (los 6 caracteres finales), igual que `EQ-XXXXXX` y `RC-XXXXXX`. El código
  completo se mantiene en la base y en los tokens. La consulta pública acepta cualquiera de los dos **más** el
  celular verificado (sin el celular, 6 caracteres no bastan).
- La consola llama **por nombre** ("Llamar a Juliana") y deja el código como dato secundario.

## Consecuencias
- (+) La entrega queda autorizada por un dato que el cliente presenta físicamente; queda en la bitácora quién entregó.
- (+) Un solo formato de código en todo el sistema.
- (−) Se guarda un dato personal más (mitigado: mínimo necesario, enmascarado, sin exponerlo en la API).
- Evolución: cifrar `documento` en reposo o guardar solo su hash con sal si la operación no necesita leerlo.
