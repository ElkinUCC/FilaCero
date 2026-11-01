# ADR-0007 · JWT de corta duración, rol validado en BD y revocación

- **Estado:** Aceptada
- **RAR / atributos:** RAR-06, RAR-07 · seguridad

## Contexto
Tres roles de personal (ADMIN, SUPERVISOR, AGENTE). Un JWT por sí solo no se puede invalidar: si se cambia el rol o se desactiva a alguien, su token seguiría sirviendo hasta expirar.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| JWT con rol solo en el token | Sin consultas a la BD | Cambios de rol y bajas tardan hasta 60 min en aplicar |
| Sesiones en servidor + cookie | Revocación natural | Estado de sesión compartido; CSRF |
| Proveedor de identidad externo (OAuth) | Estándar empresarial | Integración y costo extra; el taller no tiene uno |
| **JWT 60 min + rol y estado leídos de la BD en cada petición + `sesiones_desde`** (elegida) | Revocación inmediata con poco código | Una consulta por petición |

## Decisión
`requiere_rol` valida el rol actual en BD; los tokens emitidos antes de `sesiones_desde` se rechazan. Se revoca al cambiar o restablecer contraseña, cambiar rol, desactivar o cerrar sesión. Bloqueo de cuenta tras 5 fallos (15 min). Claves temporales obligan a cambiarlas al ingresar.

## Consecuencias
- ➕ Probado: cambio de rol, logout y cambio de clave invalidan la sesión anterior.
- ➖ El token se guarda en `localStorage`: mitigado con CSP estricta y expiración corta (riesgo R5).
- **Revisar si:** se integra un directorio corporativo o aumenta el riesgo de XSS.
