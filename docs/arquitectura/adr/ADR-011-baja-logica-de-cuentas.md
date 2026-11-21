# ADR-011 · Baja lógica de cuentas del personal

- **Estado**: Aceptado · **Atributos**: trazabilidad, integridad, seguridad

## Contexto
El docente señaló que no era posible **eliminar un asesor**. Existía "Retirar" (desactivar, reversible). Un
asesor tiene turnos atendidos, preparaciones y eventos de auditoría que apuntan a él; borrarlo físicamente
rompería claves foráneas o, peor, borraría la historia y alteraría los indicadores.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| `DELETE` físico | Desaparece de verdad | Falla por claves foráneas o destruye el historial |
| `DELETE` + `agente_id = NULL` en sus turnos | Libera la fila | Se pierde quién atendió: auditoría inválida |
| Solo desactivar ("Retirar") | Ya existía | No es "eliminar": sigue en las listas y ocupa el correo |
| **Baja lógica** (`eliminado_en`) | Desaparece de listas, no puede ingresar, libera el correo, conserva la historia | Las consultas de listados deben excluir eliminados |

## Decisión
`DELETE /api/v1/admin/agentes/{id}` (y `/admin/usuarios/{id}`) marcan `eliminado_en`, desactivan, revocan
sesiones, quitan sede y módulo, reemplazan el correo por uno reservado (queda libre para una cuenta nueva) y
registran el correo original en la auditoría. Reglas: no con turno en curso, no la propia cuenta, no cuentas
protegidas, no el último administrador. "Retirar" se mantiene como pausa reversible.

## Consecuencias
- (+) Historial e indicadores intactos (probado: el historial sigue mostrando quién atendió).
- (−) Una cuenta eliminada no se puede restaurar desde la interfaz (decisión explícita; queda en la BD).
