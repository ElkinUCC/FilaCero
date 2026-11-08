# FilaCero · Guía para la presentación

## 1. FilaCero en 30 segundos

**FilaCero es una plataforma web que elimina las filas presenciales.** El ciudadano reserva un turno desde el celular (sin crear cuenta, solo verifica su número con un código SMS), elige sede, servicio y una franja de 30 minutos, y llega a su hora. En la sede, el asesor trabaja con una consola que le dice a quién llamar y qué preparar, la sala de espera muestra los turnos llamados, y el administrador ve en vivo cómo va la operación con un tablero de indicadores y un asistente de IA.

El caso de demostración es **TecniVisión**, un centro de reparación de televisores con 4 sedes, 8 asesores y unos 1.400 turnos simulados.

**La promesa del negocio:** si reservas la franja de 16:00–16:30, te empiezan a atender dentro de esa franja. El indicador principal del tablero mide exactamente eso (meta: 90 %).

## 2. Problema → solución

| Problema | Cómo lo resuelve FilaCero |
|---|---|
| Filas largas e incertidumbre del cliente | Reserva por franja, código de turno y consulta del estado en tiempo real desde el celular. |
| El asesor no sabe a quién priorizar | Asistente de despacho: proyecta la cola y recomienda llamar, adelantar, pausar o marcar ausencia. |
| Entregas lentas porque el equipo no está listo | Preparación previa: el asesor alista el pedido antes de que el cliente llegue. |
| El gerente decide sin datos | Tablero ejecutivo con comparación contra el periodo anterior y asistente IA que explica los números. |
| Varias empresas en la misma plataforma | Arquitectura multiempresa: cada organización solo ve sus datos. |

## 3. Roles y vistas

| Rol | Ruta | Qué hace |
|---|---|---|
| Ciudadano | `/` | Reserva, consulta y cancela turnos; ve sus equipos y reclamos. Sin cuenta: se identifica con el celular verificado por OTP. |
| Asesor | `/agente` | Atiende la cola (llamar → atender → finalizar), registra y entrega equipos verificando la cédula, responde reclamos, usa el Copiloto IA. |
| Pantalla de sala | `/sala?sede=1` | TV de la sala de espera con los turnos llamados y anuncio por voz. |
| Supervisor | `/admin` | Tablero e indicadores en modo de solo lectura. |
| Administrador | `/admin` | Sedes, trámites, asesores, usuarios y permisos, historial, bitácora de actividad y FilaCero IA. |

## 4. Arquitectura (para explicarla en 1 minuto)

- **Frontend:** React 19 + Vite. Una SPA sin librerías de UI: enrutador propio, guardas por rol y CSS propio (sistema de diseño con variables). Responsive desde 360 px.
- **Backend:** Python + Flask organizado por **dominios** (organizaciones, usuarios, sedes, trámites, franjas, turnos, agentes, equipos, reclamos, auditoría, asistente). Cada dominio tiene modelos, DTOs, servicios y controladores.
- **Base de datos:** MySQL 8 con SQLAlchemy y migraciones Alembic. SQLite para las pruebas.
- **Seguridad:** JWT con revocación y versión de sesión, roles verificados contra la base de datos en cada petición, OTP por SMS para el ciudadano, límite de intentos por IP, bloqueo de cuenta, contraseñas con hash, CORS restringido, cabeceras de seguridad en nginx y validación que impide arrancar en producción con configuración insegura.
- **Multiempresa:** cada consulta y escritura se filtra automáticamente por la organización del token (`app/tenancy.py`).
- **Despliegue:** `docker compose up` levanta MySQL + API (waitress) + web (nginx como proxy inverso).
- **Calidad:** 168 pruebas automatizadas con pytest (concurrencia de reservas, seguridad, multiempresa, despacho, asistente IA…).

## 5. La "inteligencia" del sistema (pregunta segura en la sustentación)

Hay tres piezas. Conviene explicarlas con honestidad:

1. **Asistente de despacho (consola del asesor).** Combina una **regresión lineal** sobre el historial de cada sede para estimar cuánto dura cada trámite, una planificación **EDF (Earliest Deadline First)**, que atiende primero la franja que vence antes, y reglas de negocio que recomiendan llamar, adelantar, tomar pausa o marcar "no asistió". Está en `backend/app/dominios/agentes/despacho.py`.
2. **Asistente FilaCero IA (nuevo).** Es un chat en el panel administrativo y en la consola del asesor:
   - Un **motor de lenguaje natural local** entiende la pregunta en español (sin importar tildes ni mayúsculas), detecta una o varias intenciones y entidades (sede, trámite, persona de la cola) y responde con **datos reales** del tablero, la operación en vivo, la cola y el taller.
   - Cada respuesta trae **fichas de indicadores**, **botones de acción** (por ejemplo "Llamar a Valentina", "Alistar pedido" o "Abrir reclamos") y **preguntas sugeridas** para seguir la conversación. También acepta **dictado por voz**.
   - Si se configura `ANTHROPIC_API_KEY`, **Claude (modelo de lenguaje)** redacta la respuesta usando esos mismos datos. Antes de enviarlos se quitan los celulares, las cédulas y los apellidos. Si el servicio externo falla, responde el motor local. Por eso la demo funciona sin internet.
   - El asistente **no toca la base de datos directamente**: reutiliza los servicios ya probados y respeta los roles (un asesor nunca recibe datos gerenciales) y el aislamiento multiempresa.
3. **Asistente de métricas (tablero).** Convierte los indicadores en hallazgos ("La puntualidad bajó…", "Sede Itagüí tiene la asistencia más baja…") con reglas explicables.

> Frase útil: *"No es una caja negra. Las cifras siempre salen del sistema; la IA solo ayuda a interpretarlas y a redactarlas, y cada recomendación se puede auditar."*

## 6. Qué se mejoró en esta versión

**Diseño responsive (celular, tableta y computador)**
- Panel administrativo: los KPIs ya no se recortan en celular. El bloque "Sedes ahora" quedaba aplastado por un error de CSS que pisaba la regla de tableta; ahora pasa a una columna y cada sede se ve como tarjeta. El ranking de sedes y todas las tablas de las secciones (Sedes, Trámites, Asesores, Usuarios, Historial, Actividad) se convierten en tarjetas legibles en celular. También se eliminó el desplazamiento horizontal de toda la página.
- Consola del asesor: barra superior reorganizada en celular y tableta, pestañas que caben completas y cola con nombre, estado y acciones visibles. En celular el orden de las secciones prioriza la atención: asistente → puesto → cola → jornada → últimas atenciones.
- Filtros, segmentos y botones con área táctil adecuada.

**Vista del ciudadano (sin chat)**
- Se quitó el minichat. Al consultar por celular se ve **una sola lista a la vez** (pestañas Turnos · Equipos · Reclamos) en tarjetas compactas.
- Al tocar un turno, **el detalle reemplaza la lista y aparece arriba**, con el botón "Volver a mis turnos". Ya no hay que bajar para encontrarlo.
- Los reclamos muestran la última respuesta del asesor, sin chat.

**Consola del asesor más profesional**
- Nueva sección "Tu jornada de hoy" con indicadores, íconos y colores según la meta.
- Pestañas más claras, textos de cola consistentes ("3 para hoy · 38 en total") y Copiloto IA integrado.

**Asistente FilaCero IA**: ver la sección 5.

**Producción**
- `backend/Dockerfile`, `backend/wsgi.py`, `docker-compose.yml` y `.env.docker.example`.
- `.gitignore` raíz para no subir secretos. Variables nuevas del asistente documentadas en `backend/.env.example`.
- 11 pruebas nuevas (168 en total).

## 7. Guion de demostración (8–10 minutos)

1. **Ciudadano en el celular** (abre la página en el teléfono o en modo responsive del navegador):
   - Reserva un turno: servicio → celular (en modo de prueba el código aparece en pantalla) → día y hora → confirmar. Muestra el código `TU-…`.
   - "Consultar mi turno" → "Por celular" → `3001112233` (cliente demo Juliana): se ven sus equipos, uno listo para recoger.
2. **Asesor** (`carlos.mejia@filacero.co` / `Asesor12345`):
   - Muestra el asistente de despacho y su recomendación. Llama al siguiente, inicia y finaliza la atención (cronómetro y tope de 10 minutos).
   - Abre **Copiloto IA** y pregunta: *"¿Quién sigue?"*, *"¿Qué tengo que alistar?"* y *"¿Cómo voy hoy?"*. Usa el botón de acción "Llamar a…".
3. **Sala** (`/sala?sede=1`) en otra pestaña: aparece el turno llamado.
4. **Administrador** (`laura.gomez@filacero.co` / `Admin12345`):
   - Tablero: puntualidad, KPIs y gráficas. Cambia el periodo a 30 días.
   - Abre **FilaCero IA**: *"¿Cómo vamos esta semana?"*, *"¿Qué me recomiendas hacer?"*, *"¿Cómo está Itagüí?"* y *"¿Qué esperar mañana?"*.
   - Muestra que en el celular el panel se adapta: KPIs completos y tablas convertidas en tarjetas.
5. **Cierre:** muestra en la terminal las pruebas en verde (`168 passed`).

> Tip: deja corriendo `python simulacion.py --en-vivo` durante la demo para que lleguen reservas solas y se vean los avisos en vivo.

## 8. Comandos clave

### Primera vez (Windows PowerShell)

```powershell
# Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env          # solo si no tienes ya tu .env
flask --app run db upgrade           # aplica migraciones pendientes
python run.py                        # API en http://127.0.0.1:5000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                          # web en http://localhost:5173
```

### Para la demo

```powershell
python simulacion.py --cargar --si             # datos demo frescos (TecniVisión)
python simulacion.py --en-vivo                 # reservas llegando solas (Ctrl+C para parar)
python simulacion.py --en-vivo --cada 10 --por-ciclo 3
python simulacion.py                           # verificación rápida sin tocar tu base
python -m pytest tests/ -q                     # 168 pruebas
python -m pytest tests/test_asistente_ia.py -v # solo las pruebas del asistente IA
```

### Probar el asistente desde la terminal (opcional)

```powershell
# 1) iniciar sesión y copiar el access_token
curl.exe -X POST http://127.0.0.1:5000/api/v1/usuarios/login -H "Content-Type: application/json" -d "{\"correo\":\"laura.gomez@filacero.co\",\"password\":\"Admin12345\"}"
# 2) preguntar
curl.exe -X POST http://127.0.0.1:5000/api/v1/asistente/preguntar -H "Content-Type: application/json" -H "Authorization: Bearer TU_TOKEN" -d "{\"pregunta\":\"¿Qué me recomiendas hacer?\"}"
```

### Activar Claude en el asistente (opcional)

En `backend/.env`:

```env
ANTHROPIC_API_KEY=tu_clave
IA_MODELO=claude-haiku-5-5
```

Reinicia la API. El panel del asistente dirá "Conectado a Claude" y cada respuesta indicará "Redactado por Claude con tus datos".

### Producción

```bash
npm run build                    # frontend optimizado en frontend/dist
docker compose up -d --build     # MySQL + API + nginx
python scripts/generate_secret.py
```

## 9. Preguntas probables y cómo responderlas

**¿Por qué Flask y React sin librerías de componentes?**
Por control y liviandad. El bundle pesa unos 128 KB comprimido, no depende de terceros para la interfaz y el diseño es propio y accesible.

**¿Cómo evitan que dos personas reserven el último cupo al mismo tiempo?**
La reserva valida el cupo dentro de una transacción con bloqueo y hay pruebas de concurrencia (`test_reservas_concurrentes.py`, `test_concurrencia.py`).

**¿Cómo protegen los datos personales?**
El ciudadano no crea contraseña: usa un OTP con vigencia y número máximo de intentos. La sala de espera nunca muestra el celular, los datos se enmascaran (`310****638`), los roles se validan en cada petición y la IA externa solo recibe indicadores sin datos sensibles.

**¿Qué pasa si se cae internet o el proveedor de IA?**
El asistente sigue funcionando con el motor local. La IA externa es opcional.

**¿Cómo escala a otra empresa?**
Con `scripts/crear_organizacion.py`. Cada organización tiene sus sedes, trámites, horario y usuarios, aislados por `organizacion_id`.

**¿Qué falta para operar con clientes reales?**
Integrar un proveedor de SMS real, desplegar con HTTPS y una base de datos administrada con copias de seguridad, hacer pruebas de carga contra MySQL y una auditoría de seguridad independiente.

**"¿Lo hiciste con IA?"**
Respuesta honesta y fuerte: *"Usé IA como asistente de desarrollo, igual que hoy se usa en la industria, pero las decisiones de diseño, las reglas de negocio y la validación son mías. Cada funcionalidad está cubierta por pruebas automatizadas y puedo explicar cómo funciona cualquier parte."* Antes de la presentación, repasa las secciones 4 y 5 y abre estos archivos para conocerlos:
- `backend/app/dominios/agentes/despacho.py`: el algoritmo de despacho.
- `backend/app/dominios/asistente/motor.py`: el asistente IA.
- `backend/app/tenancy.py`: el aislamiento multiempresa.
- `frontend/src/pages/AgentePage.jsx`: la consola del asesor.

## 10. Credenciales de la demo (después de `simulacion.py --cargar`)

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | laura.gomez@filacero.co | Admin12345 |
| Asesor (Sede Centro) | carlos.mejia@filacero.co | Asesor12345 |
| Cliente demo | celular 3001112233 · cédula 1037654321 | código OTP en pantalla (modo prueba) |

> En un servidor público cambia estas claves con las variables `SIM_CLAVE_ADMIN` y `SIM_CLAVE_ASESOR`, y no actives el modo OTP de prueba.
