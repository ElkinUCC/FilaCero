# Guion del video · Video_Proyecto_Final_FilaCero.mp4

Orden exigido por el enunciado. Duración sugerida: 20–25 minutos.

## 1 · Presentación de los integrantes y del proyecto (≈ 1 min)

- [ ] Repartir el video: por ejemplo, uno presenta la demo y el frontend; el otro el informe, la arquitectura y el backend (ambos deben hablar).
- [ ] Cada integrante dice su nombre completo: Elkin Amador y Andrés Reina.
- [ ] FilaCero: turnos presenciales con franja garantizada y preparación previa para TecniVisión (4 sedes).
- [ ] Necesidad: filas físicas y pedidos que no están listos al llegar (doble espera).
- [ ] Funcionalidades: reserva sin cuenta con OTP, consola del asesor con voz, preparación previa, equipos y reclamos, panel y sala.

## 2 · Demostración en el navegador (≈ 7 min)

- [ ] Arrancar: MySQL, `flask --app run db upgrade` + `python run.py`, y `python -m http.server 5173`.
- [ ] Abrir DevTools → pestaña Network (filtro Fetch/XHR) y dejarla visible.
- [ ] Portal: reservar paso a paso. Escribir un celular que empiece por 1 → mensaje .is-invalid (validación del cliente).
- [ ] Celular 3001112233 → código OTP (modo prueba) → elegir día y hora → turno TU-XXXXXX.
- [ ] En Network: POST /api/v1/turnos/publico → 201 y su JSON (celular enmascarado).
- [ ] Repetir la misma reserva → 409 «Ya tienes una reserva activa» (error de negocio).
- [ ] Consola (#/agente, asesor de Sede Centro): el turno aparece en la cola; llamar → voz; iniciar → finalizar; preparar un pedido como LISTO.
- [ ] Portal → Consultar mi turno: el ciudadano ve «¡Tu pedido está listo!».
- [ ] Sala (#/sala?sede=1): turno llamado con módulo.
- [ ] Panel (#/admin): tablero, crear un asesor con datos inválidos (correo sin @) y luego válido; historial con filtros; usuarios y permisos; actividad (bitácora).
- [ ] Autorización: con la sesión del asesor abrir #/admin/usuarios → página 403; en Network un GET a /admin/... → 403.
- [ ] Persistencia: en MySQL Workbench o consola: SELECT codigo, estado, estado_preparacion FROM turnos ORDER BY id DESC LIMIT 3;
- [ ] Errores: apagar la API un momento → la consola muestra «Sin conexión, reintentando» y se recupera sola.

## 3 · Informe HTML y arquitectura (≈ 6 min)

- [ ] Abrir docs/entrega/Informe_Proyecto_Final_FilaCero.html (doble clic, sin internet).
- [ ] Recorrer brevemente las fases 01 y 02: solicitud, descubrimiento, requisitos, RAR, atributos de calidad, estimación.
- [ ] Fase 03: C4 contexto → contenedores → componentes (API y SPA); explicar por qué monolito modular (ADR-001).
- [ ] Arquitectura lógica (dominios × capas) y la prueba que la vigila (test_arquitectura_capas.py).
- [ ] Modelo lógico y físico, API REST con ejemplos reales, diseño de seguridad (STRIDE), computacional y despliegue.
- [ ] ADR clave: 004 (cupos, revisado con evidencia), 005 (JWT + OTP), 012 (localhost), 017 (Bootstrap y capas).
- [ ] Relación arquitectura ↔ implementación: matriz de trazabilidad (03.15).

## 4 · Frontend en VS Code (≈ 4 min)

- [ ] Estructura: index.html, public/vendor (Bootstrap local), src/css (bootstrap-tema.css), src/js.
- [ ] SPA: main.js (hashchange → resolveRoute → XPage + mountXPage), router/routes.js y guards.js.
- [ ] Estado y DOM: objeto de estado por componente, pintar() conserva el foco, html`…` escapa (XSS), delegación de eventos.
- [ ] Servicios: api/http.js (único fetch, token o slug, errores) y api/publico.api.js.
- [ ] Validación y errores: reservarTurno.js (.is-invalid), ui/modal.js (.alert-danger), ui/cargando.js (spinner), ui/toast.js.

## 5 · Backend en VS Code (≈ 5 min)

- [ ] Estructura: app/__init__.py (fábrica), transversales (seguridad, tenancy, errores, horario), dominios/.
- [ ] Capas de un dominio: agentes/controladores.py → admin_servicios.py → repositorios.py → dtos.py; modelos en usuarios/turnos.
- [ ] Recorrido completo de la reserva (05.07): turnos/controladores.py → servicios.crear_turno → franjas/repositorios.obtener_para_reserva → modelos → dtos.
- [ ] Reglas y validaciones: cupo por sede, duplicado (409), OTP; autenticación y autorización con @requiere_rol.
- [ ] ORM y migraciones: modelos SQLAlchemy, migrations/versions, `flask db current`.
- [ ] Excepciones y respuestas: errores.py y su manejador global.
- [ ] Terminar con `python -m pytest tests/ -q` → 209 passed.

## Condiciones

- Participan todos los integrantes en la parte funcional, técnica y arquitectónica.
- Resolución mínima 1080p; zoom del navegador y de VS Code al 125 % para que el código se lea.
- No mostrar contraseñas, tokens ni el archivo .env (en Network, no expandir el encabezado Authorization).
- Todo sobre la aplicación, el código y los diseños reales; nada de solo diapositivas.
