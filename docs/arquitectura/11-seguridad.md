# 11 · Revisión de seguridad (iteración 3)

Revisión hecha sobre el código de la entrega final con el modelo **STRIDE**, auditoría de dependencias y
pruebas automatizadas. Cada hallazgo indica si se **corrigió** en esta iteración o si queda como **riesgo
aceptado** con su mitigación y su camino de evolución.

## 1. Hallazgos corregidos

| # | STRIDE | Hallazgo | Impacto | Corrección | Evidencia |
|---|---|---|---|---|---|
| S-1 | Suplantación | Un equipo se entregaba con solo el celular del cliente | Cualquiera con el teléfono podía llevarse el televisor | Cédula registrada al recibir el equipo y **exigida y comparada en el servidor** al entregarlo (`409` si no coincide) — [ADR-015](adr/ADR-015-cedula-y-codigos-visibles.md) | `test_entregado_no_retrocede`, `test_registrar_equipo_exige_cedula_coherente` |
| S-2 | Divulgación | La consulta y la cancelación pública buscaban el turno **antes** de validar la verificación del celular; el mensaje de error distinto permitía saber si un par código–celular existía | Enumeración de turnos | Se valida primero el token firmado (propósito, organización, código) y después se busca el turno; ambas fallas responden igual | `test_consulta_con_codigo_corto`, `test_consulta_con_codigo_visible_tu` |
| S-3 | Divulgación | Datos personales nuevos (cédula) | Exposición en la API | La cédula **nunca** sale completa: `···4321` en todos los DTO; la comparación se hace en el servidor | `test_cedula_se_muestra_enmascarada` |
| S-4 | Elevación | `run.py` podía levantar el depurador de Werkzeug si `FLASK_DEBUG=true` y `FLASK_HOST=0.0.0.0` | Ejecución remota de código desde la red | El depurador solo se activa en loopback (`127.0.0.1`, `localhost`, `::1`); si no, se ignora y se avisa | `backend/run.py` |
| S-5 | Denegación | Endpoint nuevo de tablero con rangos libres | Consultas pesadas | Rango máximo de 92 días, parámetros validados (`400`), solo `ADMIN` y `SUPERVISOR` (`403` al asesor) | `test_tablero_ejecutivo_para_admin_y_supervisor` |
| S-6 | Manipulación | La preparación previa se podía marcar en trámites que no la tienen | Mensajes engañosos al ciudadano | Se deriva del tipo de atención en el servidor; el cliente no puede activarla | `test_tramite_sin_preparacion_no_genera_pendientes` |

### Iteración 4
| # | STRIDE | Hallazgo / cambio | Control |
|---|---|---|---|
| S-7 | Divulgación | Consulta "por código" sin pedir celular | El código de verificación solo llega al celular registrado en el turno y se muestra enmascarado; sin ese SMS no hay datos. Límite de 5 solicitudes por minuto contra el barrido de códigos |
| S-8 | Manipulación / divulgación | Minichat público | Solo con token OTP vigente del celular dueño; el radicado debe pertenecer a ese celular; mensajes de máximo 600 caracteres; la SPA escapa el contenido con la plantilla `html``…``` (`utils/dom.js`) |

## 2. Controles que ya existían y se verificaron

| Control | Dónde |
|---|---|
| Contraseñas con hash (`werkzeug.security`) y política de contraseña segura | `app/seguridad.py` |
| Bloqueo de cuenta tras intentos fallidos (`429`) y revocación inmediata de sesiones (`ver` en el JWT) | `usuarios/servicios.py`, ADR-005 |
| Autorización por rol en cada endpoint (`@requiere_rol`) y por sede para equipos, reclamos y preparación (`409` a otra sede) | controladores y servicios |
| Ciudadano sin cuenta: OTP de 6 dígitos + token firmado con propósito, organización y vigencia | `turnos/otp.py`, `turnos/controladores.py` |
| Límite de peticiones por IP en OTP, consulta y radicación | `app/seguridad.py` (`limitar`) |
| Cabeceras: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `X-Frame-Options`, `nosniff` en la API; CSP estricta en el frontend (`<meta>` en `index.html`) | `app/__init__.py`, `frontend/index.html` |
| CORS con lista blanca de orígenes (`CORS_ALLOWED_ORIGINS`) | `app/config.py` |
| Código OTP de prueba solo para peticiones desde el mismo equipo; depurador solo en 127.0.0.1; aviso si la clave JWT es corta | `turnos/otp.py`, `run.py`, `app/config.py` |
| Aislamiento multiempresa por `organizacion_id` en cada consulta | ADR-006 |
| Celular y serial enmascarados en las vistas públicas | DTO públicos |
| Bitácora de acciones sensibles (entregas, bajas, cambios de rol) | módulo `auditoria` |

## 3. Auditoría de dependencias (7 de noviembre de 2026, repetida el 19 de noviembre de 2026)

| Herramienta | Alcance | Resultado |
|---|---|---|
| `pip-audit -r requirements.txt` | 16 paquetes de ejecución con versión fija | **0 vulnerabilidades conocidas** |
| Frontend | HTML + CSS + JavaScript propio; única dependencia: CSS de Bootstrap 5.3.9 (copia local, sin JavaScript de terceros) | Versión fijada sin vulnerabilidades conocidas; se sirve desde el mismo origen (CSP `'self'`) |

Repetir antes de cada entrega: `pip-audit -r requirements.txt`.

## 4. Riesgos aceptados (con mitigación y evolución)

| Riesgo | Por qué se acepta hoy | Mitigación actual | Evolución |
|---|---|---|---|
| JWT guardado en `localStorage` | SPA sin servidor propio de sesiones; despliegue en un nodo | Expiración de 60 min, revocación por versión de sesión, CSP estricta contra XSS, la plantilla `html``…``` escapa el contenido | Cookie `HttpOnly` + `SameSite=Strict` con token CSRF |
| Límite de peticiones en memoria | Un solo proceso (ADR-012) | Suficiente en localhost | Redis compartido al escalar a varias instancias |
| Modo de prueba del OTP (el código se muestra en pantalla) | Demostración en localhost sin proveedor de SMS | Solo se muestra a peticiones desde el mismo equipo | Integrar proveedor SMS/WhatsApp (fuera de alcance) |
| Cédula en texto plano en la base | Se necesita comparar al entregar | Nunca se expone por la API; acceso a la base restringido | Guardar hash con sal (comparación sin leerla) o cifrado en reposo |
| HTTP sin TLS | La entrega es solo en localhost / LAN del aula | Tráfico por loopback o red local; nada se publica en internet | TLS si algún día se publicara (fuera de alcance) |
| Archivo `backend/.env` con secretos en la carpeta del proyecto | Necesario para correr | Está en `.gitignore` y **no** viaja en el paquete de entrega | Si alguna vez se compartió, rotar `SECRET_KEY`, `JWT_SECRET_KEY` y la contraseña de MySQL |

## 5. Cómo verificarlo

```powershell
cd backend
python -m pytest tests/ -q                 # 209 passed, 1 skipped
pip-audit -r requirements.txt              # No known vulnerabilities found
```
