# 05 · Arquitectura computacional y física

La arquitectura lógica (04) se materializa en **tres unidades ejecutables** sobre **un nodo físico** para la
demostración. Este documento justifica CPU, RAM, almacenamiento, E/S, red y capacidad **a partir de la carga
y de mediciones**, y compara las alternativas de ejecución (máquina física/VM, contenedores, nube).

## 1. Nodos y unidades ejecutables

| Nodo | Unidad ejecutable | Proceso | Puerto | Responsabilidad lógica |
|---|---|---|---|---|
| **Equipo de demostración** (portátil del estudiante, Windows) | SPA FilaCero | Servidor estático (`python -m http.server 5173` o Live Server) que entrega HTML, CSS y módulos ES **sin compilar** — en producción: nginx | 5173 | Presentación |
| ″ | API FilaCero | `python run.py` (Werkzeug multihilo) o `waitress-serve --threads=8 run:app` | 5000 | Negocio, seguridad, multiempresa |
| ″ | Base de datos FilaCero | `mysqld` (MySQL 8) | 3306/3307 | Persistencia |
| **Navegadores cliente** (mismo equipo o TV/otros PC de la LAN) | — | Chrome/Edge | — | Ejecutan la SPA y la voz (Web Speech API) |

> La SPA se **ejecuta en el navegador**: el nodo solo la sirve. La voz y la presentación consumen CPU del cliente,
> no del servidor (por eso ADR-009 no agrega carga al backend).

## 2. Modelo de carga (caso TecniVisión)

Supuestos de la operación (S-01..S-04 en [09](09-tradeoffs-riesgos.md)): 4 sedes, 2 asesores por sede, 48
franjas diarias, 3 cupos por asesor y franja.

| Fuente de carga | Cálculo | Peticiones/s en hora pico |
|---|---|---|
| Pantallas de sala | 4 TV × 1 petición / 4 s | 1,0 |
| Consolas de asesor | 8 asesores × 1 / 5 s | 1,6 |
| Panel administrativo | 3 personas × 4 peticiones / 15 s | 0,8 |
| Ciudadanos reservando o consultando | 30 simultáneos × 10 peticiones / 120 s | 2,5 |
| **Total estimado** | | **≈ 6 req/s** |

Capacidad máxima de negocio: 4 sedes × 2 asesores × 3 cupos × 48 franjas = **1 152 turnos/día**.

## 3. Recursos por unidad

| Recurso | API FilaCero | Base de datos FilaCero | SPA (servidor) | Justificación |
|---|---|---|---|---|
| **CPU** | 1 núcleo efectivo (Python con GIL); escala con más procesos, no con más hilos | < 0,5 núcleo a la carga estimada | Despreciable (estático) | Medido: con 2 vCPU la API satura en ~120 req/s, 20× la carga estimada |
| **RAM** | ≈ 190 MB (medido, proceso en reposo con datos demo) | ≈ 130 MB (MariaDB, medido) · 512 MB recomendados para MySQL 8 | ≈ 20 MB (servidor estático de Python, medido). No hay Node.js en el nodo | Total recomendado del nodo: **4 GB** (hay holgura para navegador y SO) |
| **Almacenamiento** | Código < 5 MB | ≈ 0,44 KB por turno con índices (1 435 turnos = 0,63 MB medidos) ⇒ a capacidad máxima ≈ 0,5 MB/día ≈ **185 MB/año**; franjas ≈ 0,19 KB c/u | Frontend sin compilar: 54 módulos ES + 12 hojas CSS ≈ 504 KB | Un disco SSD de cualquier tamaño sobra; el riesgo no es espacio sino **respaldo** (R-03) |
| **E/S** | Baja; sin archivos | Escrituras pequeñas por turno; lecturas dominadas por la consola (consulta de cola) | — | Índices en `turnos.franja_id`, `turnos.usuario_id`, `turnos.agente_id`, `usuarios.celular` |
| **Red** | Panel del asesor ≈ 46 KB cada 5 s ⇒ 8 asesores ≈ 74 KB/s (0,6 Mbps); sala ≈ 1,3 KB cada 4 s | Local (loopback) | Carga inicial ≈ 504 KB por loopback o LAN (≈ 0,4 s en una LAN de 10 Mbps); luego el navegador los guarda en caché | Una LAN de 10 Mbps soporta la operación de una sede con holgura |

## 4. Comunicaciones

| Desde | Hacia | Protocolo | Puerto | Seguridad (localhost) |
|---|---|---|---|---|
| Navegador | SPA | HTTP | 5173 | localhost o LAN del aula; CSP en `index.html` |
| Navegador (SPA) | API | HTTP + JSON | 5000 | CORS restringido a los orígenes de `CORS_ALLOWED_ORIGINS`; JWT Bearer |
| API | Base de datos | MySQL protocol (PyMySQL) | 3307 | loopback (MySQL en el mismo equipo) |
| API | Proveedor SMS | — | — | No se usa: el OTP se muestra en pantalla (modo prueba) |

## 5. Evidencia de capacidad medida

Comando reproducible (con el servidor encendido, `RATE_LIMIT_ACTIVO=false` y datos cargados):

```powershell
python simulacion.py --cargar --si
python simulacion.py --carga --url http://127.0.0.1:5000 --usuarios 40 --segundos 20
```

Entorno de la medición registrada aquí: 2 vCPU, 7,8 GB RAM, Linux, MariaDB 10.11 (compatible MySQL 8) en el
mismo nodo, datos de 7 días (≈ 1 400 turnos). **Repítala en su equipo antes de la presentación** y reemplace la
tabla si los números cambian: el método importa más que el número.

| Servidor de aplicación | Usuarios | Operación | p50 ms | p95 ms | máx ms | Errores | Throughput |
|---|---|---|---|---|---|---|---|
| Werkzeug (`python run.py`) | 40 | Horario | 148 | 207 | 407 | 0 | 113 req/s |
| ″ | 40 | Disponibilidad | 193 | 274 | 499 | 0 | |
| ″ | 40 | Pantalla de sala | 228 | 400 | 668 | 0 | |
| **waitress 8 hilos** | 40 | Horario | 126 | 185 | 369 | 0 | **119 req/s** |
| ″ | 40 | Disponibilidad | 174 | 248 | 498 | 0 | |
| ″ | 40 | Pantalla de sala | 212 | 331 | 582 | 0 | |
| waitress 8 hilos | **100** | Horario | 617 | 760 | 1 083 | 0 | 128 req/s |
| ″ | 100 | Pantalla de sala | 716 | 1 134 | 1 224 | 0 | |

**Repetición en la entrega final (19 de noviembre de 2026)** — 2 vCPU, 7,8 GB RAM, MariaDB 10.11, `python run.py`,
datos de `simulacion.py --cargar --si` (1 530 turnos), 40 usuarios durante 15 s:

| Operación | peticiones | p50 ms | p95 ms | máx ms | errores |
|---|---|---|---|---|---|
| Horario | 520 | 175 | 246 | 452 | 0 |
| Disponibilidad | 520 | 232 | 323 | 555 | 0 |
| Pantalla de sala | 520 | 262 | 587 | 690 | 0 |
| **Rendimiento** | | | | | **104 req/s** |

Concurrencia: 18 reservas simultáneas contra 6 cupos ⇒ **6 aceptadas, 12 rechazadas** (HTTP 409). Verificación
funcional `simulacion.py --url`: **50/50**.

**Concurrencia de cupos** (misma corrida): 18 reservas simultáneas contra una franja con 6 cupos ⇒
**6 aceptadas, 12 rechazadas**. Antes de la corrección de ADR-004 la misma prueba sobre MySQL aceptaba **18**
(sobreventa del 300 %); el defecto no aparecía en la suite con SQLite porque ese motor serializa escrituras.

Lectura de los resultados:
- La **saturación es de CPU** (≈ 120–128 req/s con 2 núcleos): al pasar de 40 a 100 usuarios el throughput casi
  no sube y la latencia se multiplica. Es el comportamiento esperado de un proceso Python.
- La carga estimada (≈ 6 req/s) usa **≈ 5 %** de la capacidad medida: el monolito en un nodo es suficiente
  para el caso con un margen de ~20×.
- El primer cuello de botella al crecer será la CPU de la API, no la base de datos (ver escenario E-2 en [10](10-evolucion.md)).

## 6. Alternativas de ejecución comparadas

| Criterio | A. Nodo local (elegida para la demo) | B. Contenedores (Docker Compose) | C. Nube PaaS (Render/Railway + MySQL administrado) | D. VM IaaS (VPS) |
|---|---|---|---|---|
| Problema que resuelve | Demostrar sin dependencias externas | Reproducibilidad idéntica entre equipos | Disponibilidad pública, HTTPS y respaldos gestionados | Control total con IP pública |
| Responsabilidades que introduce | Instalar Python y MySQL (el frontend no necesita Node.js ni compilación) | Mantener imágenes, volúmenes y red de contenedores; Docker Desktop en Windows (≈ 2 GB RAM extra) | Variables de entorno, límites del plan, arranque en frío | Parches del SO, firewall, TLS, respaldos, monitoreo |
| Costo mensual estimado | 0 | 0 (local) | 0 en plan gratuito con suspensión; ≈ 7–25 USD/mes para siempre activo | ≈ 5–12 USD/mes |
| Riesgo en la presentación | Bajo (sin red) | Medio (Docker en Windows/WSL2) | Alto (red del aula, arranque en frío de 30–60 s) | Medio (red del aula) |
| Disponibilidad | La del portátil | La del portátil | 99,x % del proveedor | Depende del operador |
| Encaje con "monolito modular" | Total | Total (1 contenedor por unidad) | Total | Total |

**Decisión** (ADR-012): **A, solo localhost**. Las alternativas B, C y D se analizaron y se descartaron para esta
entrega: no se incluyen artefactos de contenedores, servidores web ni nube en el repositorio.
Virtualizar o contenerizar no cambia la arquitectura lógica: solo mueve **quién** es responsable de la
infraestructura y **cuánto** cuesta.
