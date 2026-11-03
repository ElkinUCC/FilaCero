# Contrato backend ↔ frontend

## 1. Reglas generales

- **Base:** `VITE_API_URL` (en desarrollo `http://127.0.0.1:5000/api/v1`).
- **Autenticación:** `Authorization: Bearer <access_token>`; lo agrega `http.js` si hay sesión. Las rutas públicas se llaman con `{ sinToken: true }`.
- **Éxito:** `{"success": true, ...datos}`. Los datos van en la raíz (por ejemplo `turno`, `puntos` o `access_token`).
- **Error:** `{"success": false, "error": "mensaje para la persona", "detalles"?: {"campo": ["..."]}}`. `formatApiError` muestra `error` y, si existe, el primer detalle.

| Código | Significado | Reacción del frontend |
|---|---|---|
| 400 | Datos inválidos | Mensaje junto al formulario |
| 401 | Sin sesión, token vencido o revocado | Cierra la sesión y vuelve a `/?ingresar=1` |
| 403 | Rol insuficiente | Mensaje o página 403, **sin** cerrar sesión |
| 404 | No existe | Mensaje |
| 409 | Ya existe o hay conflicto (nombre repetido, sede con turnos) | Mensaje en el modal |
| 429 | Demasiados intentos o cuenta bloqueada | Mensaje con la espera |

> Diferencia con la referencia: allí el éxito es `{"data": ...}` y el error `{"error": {"message": ...}}`. FilaCero mantiene los datos en la raíz y `error` como texto para no romper las pruebas existentes (ADR-0009).

## 2. Por pantalla

### Portal (`publico.api.js`)

| Función | Petición | Respuesta usada |
|---|---|---|
| `obtenerHorario()` | `GET /horario` | `hora_apertura`, `hora_cierre`, `todos_los_dias` |
| `listarSedes()` · `listarTramites()` | `GET /sedes/` · `GET /tramites/` | `puntos[]` · `tramites[]` |
| `franjasDisponibles({sedeId, tramiteId, fecha})` | `GET /franjas/disponibles?sede_id&tramite_id&fecha` | `franjas[]: {franja_id, hora_inicio, hora_fin, disponibles, capacidad}` |
| `solicitarCodigo(celular)` | `POST /turnos/publico/solicitar-codigo` `{celular}` | `codigo_prueba` (solo en desarrollo) |
| `verificarCodigo(celular, codigo, proposito, codigoTurno)` | `POST /turnos/publico/verificar-codigo` | `token_verificacion` ligado al propósito y, para consulta/cancelación, al código del turno |
| `reservarTurno(datos)` | `POST /turnos/publico` `{nombre, celular, token_verificacion, punto_id, tramite_id, franja_id}` | 201 `turno`, `espera`, permiso temporal `token_consulta` |
| `consultarTurno(codigo, celular, token)` · `cancelarTurno(codigo, celular, token)` | `POST /turnos/publico/consultar` · `/cancelar` | `turno`, `espera`; ambos requieren permiso OTP |
| `pantallaSala(sedeId)` | `GET /turnos/publico/sala?sede_id` | `sede`, `sedes[]`, `llamados[]`, `siguientes[]`, `horario` (sin datos personales) |

### Acceso del personal (`auth.api.js`)

| Función | Petición | Respuesta usada |
|---|---|---|
| `login(correo, password)` | `POST /usuarios/login` | `access_token`, `usuario {id, nombre, rol, debe_cambiar_clave}` |
| `cambiarClave(actual, nueva)` | `POST /usuarios/me/clave` | `access_token` nuevo, `usuario` |
| `logout()` | `POST /usuarios/logout` | — (revoca todos los tokens) |

### Consola del asesor (`agente.api.js`)

| Función | Petición |
|---|---|
| `obtenerPanel()` | `GET /agente/panel`: `agente`, `actual`, `cola[]`, `franja_actual`, `recomendacion`, `resumen`, `recientes[]`, `en_horario`, `ahora` |
| `llamarSiguiente()` | `POST /agente/llamar-siguiente` |
| `llamar(id)` · `iniciar(id)` · `finalizar(id)` · `noAsistio(id)` · `devolver(id)` | `POST /agente/turnos/<id>/<acción>` |

### Panel (`catalogo.api.js`, `admin.api.js`)

| Función | Petición |
|---|---|
| `listar(tipo, {todos})` · `crear` · `actualizar` · `eliminar` | `/sedes/` y `/tramites/`, con `?todos=1` |
| `metricas(rango)` · `metricasPorSede` · `metricasPorTramite` | `GET /admin/agentes/metricas[/sedes\|/tramites]?desde&hasta` |
| `enVivo()` | `GET /admin/agentes/en-vivo`: `sedes[]`, `recientes[]` |
| `historial(filtros)` | `GET /admin/agentes/historial?pagina&por_pagina&estado&punto_id&desde&hasta&buscar` |
| `listarAgentes` · `crearAgente` · `actualizarAgente` | `/admin/agentes/` |
| `listarUsuarios` · `crearUsuario` · `actualizarUsuario` · `restablecerClave` | `/admin/usuarios/` |
| `auditoria(filtros)` | `GET /admin/usuarios/auditoria?pagina&por_pagina&accion` |
