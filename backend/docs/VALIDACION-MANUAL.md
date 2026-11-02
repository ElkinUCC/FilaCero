# Validación manual de la API

Guía para comprobar la API a mano (Postman o PowerShell) antes de la sustentación. Cada paso dice qué hacer y qué debe pasar.

## Preparación

```powershell
cd backend ; .\venv\Scripts\Activate.ps1
flask db upgrade
python simulacion.py --cargar --si --desde 2026-10-25 --hasta 2026-10-30
python app.py
```

En Postman, importa `docs/postman/FilaCero.postman_collection.json` y el entorno `FilaCero.local.postman_environment.json`. Completa `clave_admin` y `clave_agente` con las claves que imprimió `--cargar`, y pon en `fecha` la fecha de mañana.

## 1. Salud

| # | Acción | Resultado esperado | ✓ |
|---|---|---|---|
| 1.1 | `GET /health` | 200 · `{"success": true, "status": "ok"}` | |
| 1.2 | `GET /health/listo` | 200 · `base_de_datos: ok` (503 si MySQL está apagado) | |
| 1.3 | `GET /api/v1/no-existe` | 404 · `{"success": false, "error": "Recurso no encontrado."}` | |

## 2. Ciudadano (sin cuenta)

| # | Acción | Resultado esperado | ✓ |
|---|---|---|---|
| 2.1 | Listar sedes y trámites | 5 sedes y 5 servicios de TecniVisión | |
| 2.2 | Franjas disponibles para mañana | Franjas de 30 min entre 8:00 y 18:00; `capacidad` = 3 × asesores de la sede | |
| 2.3 | Solicitar código con celular `3001234567` | 200; en desarrollo trae `codigo_prueba` | |
| 2.4 | Verificar con un código errado | 400 · "Código incorrecto…" | |
| 2.5 | Verificar con el código correcto | 200 · `token_verificacion` | |
| 2.6 | Reservar | 201 · código `FC-AAAAMMDD-XXXXXX` | |
| 2.7 | Consultar con otro celular | 400, sin revelar si el turno existe | |
| 2.8 | Consultar con el celular correcto | 200 · celular enmascarado `300****567` | |
| 2.9 | Pantalla de sala | 200 · sin nombres completos ni celulares | |

## 3. Personal

| # | Acción | Resultado esperado | ✓ |
|---|---|---|---|
| 3.1 | Login con clave errada | 401 · "Correo o contraseña incorrectos." | |
| 3.2 | 5 intentos errados seguidos y luego la clave correcta | 429 · cuenta bloqueada 15 min (desbloquear con `scripts/promover_admin.py`) | |
| 3.3 | Login de asesor | 200 · `access_token` | |
| 3.4 | Asesor → `GET /admin/usuarios/` | 403 | |
| 3.5 | Asesor → llamar siguiente, iniciar y finalizar | 200 en cada paso; la cola baja | |
| 3.6 | Asesor → llamar siguiente con un turno en curso | 400 · "Ya tienes un turno en curso…" | |

## 4. Administración

| # | Acción | Resultado esperado | ✓ |
|---|---|---|---|
| 4.1 | Crear la sede "Sede Centro" (ya existe) | **409** · "Ya existe una sede con ese nombre." | |
| 4.2 | Editar la sede 999 | **404** · "La sede no existe." | |
| 4.3 | Crear un trámite con `tiempo_estimado: 0` | 400 | |
| 4.4 | Eliminar una sede con turnos | 409 · "Desactívala en lugar de eliminarla." | |
| 4.5 | Crear un supervisor | 201 · clave temporal mostrada una sola vez | |
| 4.6 | Supervisor intenta crear una sede | 403 (solo lectura) | |
| 4.7 | Cambiar de rol a un asesor con sesión abierta | Su siguiente petición responde 401 | |
| 4.8 | Bitácora | Aparecen los eventos anteriores, con IP | |

## 5. Sesión

| # | Acción | Resultado esperado | ✓ |
|---|---|---|---|
| 5.1 | Cambiar mi contraseña | 200 · token nuevo; el token anterior responde 401 | |
| 5.2 | Cerrar sesión y reutilizar el token | 401 de inmediato | |

## 6. Automatizado

```powershell
python -m pytest            # 87 pruebas (94 con las del equipo)
python simulacion.py        # 50/50
npx newman run docs/postman/FilaCero.postman_collection.json -e <entorno con claves>
```
