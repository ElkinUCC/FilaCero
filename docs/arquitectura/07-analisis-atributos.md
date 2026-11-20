# 07 · Análisis de atributos de calidad

Para cada atributo: **tácticas aplicadas**, **evidencia** y **límite conocido** (lo que la arquitectura actual
no cubre y cómo cambiaría). Los escenarios medibles están en [02](02-atributos-calidad.md).

## 1. Rendimiento

| Táctica | Dónde |
|---|---|
| Un solo proceso: sin saltos de red entre módulos | ADR-001 |
| Consultas con `JOIN` y `contains_eager` para evitar N+1 en métricas | `agentes/controladores.py` |
| Índices en claves de búsqueda (`franja_id`, `usuario_id`, `agente_id`, `celular`, `fecha`) | modelos |
| Payloads pequeños para vistas frecuentes (sala ≈ 1,3 KB) | `turnos/controladores.pantalla_sala` |
| Intervalos de polling según la urgencia de cada vista (4 s a 30 s) | ADR-007 |
| La voz y el render corren en el navegador, no en el servidor | ADR-009 |

**Evidencia**: p95 de 185–331 ms con 40 usuarios simultáneos; 119 req/s sostenidos sin errores
([05 §5](05-arquitectura-fisica.md#5-evidencia-de-capacidad-medida)).
**Límite**: la consola del asesor descarga ≈ 46 KB cada 5 s (cola completa). Con colas de cientos de turnos
convendría paginar o enviar diferencias (escenario E-2).

## 2. Disponibilidad

| Táctica | Dónde |
|---|---|
| Datos confirmados solo tras `commit` en MySQL (durabilidad InnoDB) | servicios |
| Clientes que **reintentan solos** y avisan "Sin conexión, reintentando" | `utils/polling.js`, `layout/encabezado.js`, sala |
| Aviso de servidor lento (> 4 s) en toda la SPA | `api/http.js` |
| *Health checks* `/health` y `/health/listo` (este último verifica la BD) | `app/__init__.py` |
| Bitácora "best effort": si la auditoría falla, la operación principal continúa | `auditoria/servicios.registrar` |

**Evidencia**: al detener y reiniciar la API, la consola y la sala se recuperan sin recargar la página.
**Límite**: un solo nodo = punto único de falla. Disponibilidad ≈ la del equipo. Aceptado para la demo
(ADR-012); la ruta de mejora es §2 de [06](06-despliegue.md) con base de datos administrada y 2 procesos.

## 3. Seguridad

| Amenaza (STRIDE) | Táctica | Evidencia |
|---|---|---|
| **S**uplantación del ciudadano | OTP al celular + token firmado de propósito único (reserva/consulta/cancelación) y por organización | `test_seguridad_sesiones_otp.py` |
| Suplantación del personal | Contraseñas con hash scrypt (Werkzeug), bloqueo tras 5 intentos, clave temporal obligatoria de cambiar | `test_seguridad_y_publico.py` |
| **T**ampering (manipular datos ajenos) | Autorización por rol vigente en BD; el asesor solo prepara turnos de **su** sede; multiempresa en el ORM | `test_asesor_de_otra_sede_no_prepara`, `test_multiempresa.py` |
| **R**epudio | Auditoría con usuario, IP y fecha; incluye bajas y preparaciones | sección Actividad |
| **I**nformation disclosure | DTO públicos sin IDs internos, celular enmascarado, sala sin celular; mensajes de error genéricos en login y consulta | `test_pantalla_de_sala_*` |
| **D**enial of service | Límite de peticiones por IP; `MAX_CONTENT_LENGTH` 64 KB | `seguridad.limitar` |
| **E**levation of privilege | Revocación inmediata por versión de sesión; cuentas protegidas; no se puede eliminar la propia cuenta ni al último administrador | `test_rotacion_y_cuentas_protegidas.py`, `test_admin_no_se_elimina_a_si_mismo` |

Cabeceras: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; CORS con lista blanca. En el frontend, CSP en `index.html`. El código OTP de prueba solo
se entrega a peticiones desde el mismo equipo y el depurador solo se activa si la API escucha en 127.0.0.1.
**Límite**: el JWT viaja en `localStorage` (riesgo XSS mitigado en la SPA vanilla: la plantilla `html``…``` de `utils/dom.js` escapa toda interpolación y los pocos fragmentos marcados con `crudo()` se construyen con texto ya escapado; además la CSP de `index.html` usa `script-src 'self'`); el
límite de peticiones está en memoria del proceso (con varios procesos debe pasar a un almacén compartido).
La pantalla de sala muestra el nombre completo por decisión de usabilidad (ADR-008, configurable).

## 4. Costo

| Concepto | Entrega (localhost) | Referencia si se publicara (fuera de alcance) |
|---|---|---|
| Infraestructura | 0 (equipo propio) | VPS ≈ 5–12 USD/mes + MySQL administrado ≈ 0–15 USD/mes |
| Licencias | 0 (todo software libre) | 0 |
| Voz | 0 (Web Speech API del navegador) | 0 (vs. ≈ 4–16 USD por millón de caracteres en TTS en la nube) |
| SMS | 0 (modo prueba) | ≈ 0,01–0,05 USD por OTP en Colombia (variable con el proveedor) |
| Operación | Estudiante | Respaldos y parches: ≈ 2 h/mes |

Si algún día se publicara, el mayor costo variable sería el **SMS**, no la infraestructura (ver incertidumbre I-02).

## 5. Escalabilidad

| Dimensión | Hoy | Cómo escala | Primer límite |
|---|---|---|---|
| Sedes y asesores | 4 sedes, 8 asesores | Datos: sin cambios de código (cupo = asesores × 3) | CPU de la API al crecer el polling |
| Concurrencia de reservas | Serializada **por sede** | Sedes distintas reservan en paralelo | Una sede muy concurrida (bloqueo de la fila `puntos`) |
| Organizaciones | Multiempresa en un esquema | Nuevas organizaciones con `crear_organizacion.py` | Tamaño de tablas compartidas |
| Lectura en vivo | Polling | Más procesos de la API (fuera del alcance de la entrega) | Tráfico de la consola (46 KB / 5 s) |

**Evidencia**: el throughput pasa de 113 a 128 req/s al subir de 40 a 100 usuarios: el proceso ya está en su
techo de CPU. Escalar requiere **más procesos**, no más hilos. El diseño lo permite porque el estado vive en
MySQL (la API es sin estado salvo el límite de peticiones y el candado local, ambos analizados en ADR-004/E-2).

## 6. Usabilidad y accesibilidad

- Paleta del portal con mayor contraste por defecto (solicitud del docente). El menú de "Accesibilidad" se retiró
  por decisión del docente; se conservan navegación por teclado, `aria-live` y foco atrapado en modales.
- **Reserva guiada paso a paso**: una pregunta por pantalla, pasos que cambian según el tipo de trámite,
  horarios como botones y transiciones animadas.
- **Llamado por voz** desde la consola, repetido cada 20 s, con módulo de atención y nombre completo (ADR-009).
- Panel administrativo uniforme: 6 columnas con un dato por columna y **detalle al hacer clic** (menos carga cognitiva).
- Preparación previa visible para el ciudadano: reduce la incertidumbre ("¿mi equipo estará listo?").

## 7. Mantenibilidad y verificabilidad

- Estructura repetible por módulo (controlador/servicio/repositorio/modelo/DTO).
- **209 pruebas** automatizadas en verde (≈ 45 s; incluye 45 pruebas de arquitectura de capas), más 50 comprobaciones de punta a punta contra el servidor real.
- Migraciones versionadas y reversibles; la de esta entrega fue probada en subida y bajada.
- Componentes de UI reutilizables (`admin/tablaSeccion.js`, `ui/modal.js` con `abrirDetalle`) que **imponen** la regla de diseño del panel.
- Deuda técnica R-07 corregida en la entrega final y protegida por `tests/test_arquitectura_capas.py`.
