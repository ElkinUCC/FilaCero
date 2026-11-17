# FilaCero · Guion del video de sustentación (≈ 10 minutos)

> Consejo: graba primero la demo (pantalla) y luego la parte de arquitectura con los diagramas en pantalla
> completa. Antes de grabar: MySQL encendido, `python run.py` en `backend/` y `python -m http.server 5173` en
> `frontend/`. Ten abiertos el portal, la consola del asesor, el panel, la sala y la carpeta `docs/`.

| Min | Sección | Qué se ve en pantalla | Qué se dice (idea central) |
|---|---|---|---|
| 0:00 – 0:45 | **1. Problema** | Portada + 01-sintesis-problema | En los puntos de atención hay doble espera: la fila y la preparación. FilaCero vende solo los cupos que los asesores pueden atender (franjas de 30 min, 3 personas por asesor) y prepara el pedido antes de que llegue la persona. Caso simulado: TecniVisión, 4 sedes, 8 asesores. |
| 0:45 – 1:30 | **2. Actores y casos de uso** | `docs/diagramas/casos-de-uso.png` | Cinco actores: ciudadano (sin cuenta, con OTP), asesor, supervisor, administrador y la TV de sala; un sistema externo: el proveedor SMS. Mostrar los `include` de OTP y los `extend` de entrega y garantía. |
| 1:30 – 2:30 | **3. Atributos de calidad y RAR** | 02-atributos-calidad (tabla de prioridad) | El atributo nº 1 es la consistencia de cupos: si se sobrevende, la promesa es falsa. Luego seguridad (Ley 1581), usabilidad, rendimiento. Los RAR son los requisitos que, si cambian, cambian la arquitectura (RAR-01 a RAR-12). |
| 2:30 – 3:45 | **4. Estilo: monolito modular por capas y dominios** | `docs/diagramas/paquetes.png` + ADR-001 | Un solo proceso backend; 11 módulos de dominio (corte vertical) y dentro de cada uno capas controlador → servicio → repositorio → modelo + DTO (corte horizontal). Transversales: seguridad, multiempresa, errores, horario. Por qué no microservicios: un desarrollador, costo cero, transacción local para los cupos (trade-off T-01). |
| 3:45 – 4:30 | **5. Frontend SPA sin frameworks** | `frontend/index.html`, `src/js/` + ADR-002 revisado | SPA = una sola página `#app` que cambia de vista sin recargar. HTML + CSS + JS puro con módulos ES: router y guardas, páginas `XPage()+mountXPage()`, un solo `http.js`. Explicar que la interfaz se reescribió sin frameworks para cumplir el requisito y que la API no cambió gracias al versionado `/api/v1` (escenario E-1d). |
| 4:30 – 5:30 | **6. Vistas C4** | 03-vistas-c4 (C1 → C2 → C3) | Mismos nombres en todas las vistas: SPA FilaCero, API FilaCero, Base de datos FilaCero. La sala no es otro contenedor sino una ruta de la misma SPA; la voz es una capacidad del navegador. |
| 5:30 – 6:30 | **7. Modelo de datos y persistencia** | `docs/diagramas/clases.png` y `entidad-relacion.png` + ADR-003/006 | MySQL InnoDB por ACID y bloqueo de fila; migraciones Alembic aditivas y reversibles; multiempresa con `organizacion_id` y filtro automático del ORM; baja lógica para conservar la historia. |
| 6:30 – 7:30 | **8. Decisión clave: consistencia de cupos** | `docs/diagramas/secuencia-reserva.png` + ADR-004 + 05 §5 | Candado por sede + `SELECT … FOR UPDATE` + `READ COMMITTED`. Evidencia: 18 reservas simultáneas a una franja de 6 cupos → antes 18 aceptadas (sobreventa del 300 % con REPEATABLE READ), ahora 6 aceptadas y 12 rechazadas. Se sacrifica: las reservas de una sede se serializan (T-02). |
| 7:30 – 8:30 | **9. Arquitectura computacional y despliegue** | `docs/diagramas/despliegue.png` + 05 | Solo localhost: un equipo con tres procesos (MySQL, API Python y servidor estático). Carga estimada ≈ 6 req/s; capacidad medida ≈ 120 req/s con 2 vCPU (≈ 20× de margen); el cuello de botella sería la CPU de la API. Se compararon contenedores, PaaS y VM y se descartaron (ADR-012): costo cero y sin depender de la red del aula. |
| 8:30 – 9:15 | **10. Seguridad, riesgos y supuestos** | 11-seguridad (STRIDE) + 09 | JWT con versión de sesión (revocación inmediata), OTP (código en pantalla solo desde el mismo equipo), roles verificados en BD, rate limit, CSP en `index.html`, escape de HTML, auditoría. Riesgos abiertos: token en `localStorage`, rate limit en memoria, deuda R-07, ciclo `turnos ↔ agentes` (R-11). Supuestos: atención ≤ 10 min, 4 sedes. |
| 9:15 – 9:50 | **11. Evolución** | 10-evolucion | Escenarios ejecutados: E-1 (retroalimentación del docente), E-1d (frontend sin frameworks: la API no se enteró) y E-1e (alcance solo localhost). Analizados: más sedes → varios procesos de la API; tiempo real → SSE. |
| 9:50 – 10:00 | **12. Cierre** | Terminal con `pytest` (164 passed) | 164 pruebas automatizadas, 16 ADR, 8 diagramas UML, documento de arquitectura completo. La promesa: "llega a tu hora y sal con lo que viniste a buscar". |

## Demo corta (si el video la incluye, 3 – 4 min extra)
1. Portal → Entrega de equipo → celular `3001112233` → código de prueba → elegir el Samsung listo → hora → confirmar.
2. Consola (`carlos.mejia@filacero.co`) → "Llamar a Juliana" (voz) → Iniciar → Entregar equipo (cédula `1037654321`) → Finalizar.
3. Sala (`http://localhost:5173/#/sala?sede=1`) mostrando el llamado.
4. Panel (`laura.gomez@filacero.co`) → Resumen ejecutivo y Asesores con su estado.

## Frases útiles para justificar
- "Cada decisión tiene un ADR con contexto, alternativas, decisión y consecuencias; cuando la implementación cambió la decisión, el ADR se **revisó**, no se borró."
- "El número que importa no es el throughput, es el método: la prueba de carga es reproducible con `simulacion.py --carga`."
- "Virtualizar o contenerizar no cambia la arquitectura lógica; cambia quién es responsable de la infraestructura y cuánto cuesta."
