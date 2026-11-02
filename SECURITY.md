# Seguridad de FilaCero

Resumen de los controles implementados, cómo se verifican y qué falta antes de publicar.

## Controles implementados

| Amenaza | Control | Dónde | Prueba |
|---|---|---|---|
| Robo/adivinación de contraseñas | Hash scrypt (Werkzeug), mínimo 8 caracteres con letras y números | `app/seguridad.py` | `test_usuarios_permisos.py` |
| Fuerza bruta | Límite por IP (login 10/min) **y** bloqueo de cuenta 15 min tras 5 fallos | `seguridad.limitar`, `usuarios/servicios.py` | `test_bloqueo_tras_5_intentos...` |
| Enumeración de usuarios | Mismo mensaje para correo inexistente, clave errada o cuenta inactiva; tiempo de respuesta igualado | `iniciar_sesion` | `test_login_con_mensaje_generico...` |
| Token robado o desactualizado | JWT de 60 min; el rol se valida contra la BD en cada petición; tokens revocados al instante (versión de sesión en el token) al cambiar clave/rol, desactivar o cerrar sesión | `app/__init__.py`, `requiere_rol` | `test_cambio_de_rol...`, `test_logout_revoca...` |
| Escalamiento de privilegios | Roles ADMIN / SUPERVISOR (solo lectura) / AGENTE; un admin no puede quitarse su rol ni desactivarse; siempre queda ≥1 admin | `usuarios/admin_controladores.py` | `test_protecciones_del_administrador` |
| Claves temporales filtradas | Se muestran una sola vez y obligan a cambiarlas al ingresar (validado en el servidor) | `requiere_rol` (`CAMBIAR_CLAVE`) | `test_admin_crea_supervisor...` |
| Suplantación de ciudadano | Reserva pública exige verificar el celular con código de 6 dígitos (5 intentos, 5 min) | `turnos/otp.py` | `test_otp_*` |
| Exposición de datos personales | Consultar/cancelar exige código **y** celular; respuestas públicas con celular enmascarado; pantalla de sala con nombre + inicial | `turnos/dtos.py`, `/publico/sala` | `test_pantalla_de_sala_no_expone...` |
| IDOR (turnos ajenos) | Responde 404 sin revelar existencia | `prediccion.py` | `test_espera_de_turno_ajeno_responde_404` |
| Sobrecupo por concurrencia | Candado por sede + `SELECT ... FOR UPDATE` | `turnos/servicios.py` | `test_reservas_concurrentes.py`, `simulacion.py --carga` |
| CORS / clickjacking / MIME | CORS solo orígenes configurados; `X-Frame-Options DENY`, `nosniff`, CSP, `Referrer-Policy` | `app/__init__.py`, `nginx.conf` | `test_cors_solo_origen_permitido...` |
| Errores con información interna | Manejadores globales: 400/401/403/404/429 en español, 500 genérico y registro en log | `_registrar_manejadores` | `test_validacion_devuelve_400...` |
| Configuración insegura | En `FLASK_ENV=production` no arranca con claves cortas, OTP de prueba, debug o CORS `*` | `config.validar_configuracion` | `test_produccion_rechaza...` |
| Trazabilidad | Bitácora de ingresos, fallos, bloqueos, cambios de rol, claves y catálogo con IP | `dominios/auditoria` | `test_auditoria_registra...` |
| Dependencias vulnerables | Versiones fijas; `pip-audit` y `npm audit` sin hallazgos (01/11/2026) | `requirements.txt`, `package-lock.json` | ver comandos abajo |

## Verificar

```bash
cd backend
python -m pytest                       # pruebas automáticas
python simulacion.py                   # verificación de punta a punta
pip install pip-audit && pip-audit -r requirements.txt
cd ../frontend-react && npm audit
```

## Pendiente antes de publicar en un dominio

1. **HTTPS obligatorio** (Let's Encrypt o el proveedor) y activar `Strict-Transport-Security` en `nginx.conf`.
2. **Proveedor de SMS real** para el código de verificación (`turnos/otp.py::_enviar_sms`) y `FILACERO_OTP_TEST_MODE=false`. Sin esto la reserva pública responde 503 en producción (comportamiento intencional).
3. **Claves nuevas** de 48 caracteres en `deploy/.env.produccion` (nunca en Git) y cambiar las contraseñas de demostración.
4. **Copias de seguridad** programadas de MySQL (volumen `datos_mysql`) y prueba de restauración.
5. Si se usan **varias instancias** de la API: mover el límite por IP y los códigos OTP de memoria a Redis (ver ADR-0004 y riesgos R3/R4).
6. Token en `localStorage`: mitigado con CSP estricta y expiración de 60 min; evaluar cookies `HttpOnly` + CSRF si el riesgo de XSS aumenta (riesgo R5).
