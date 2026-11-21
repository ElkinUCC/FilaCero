# ADR-017 · Bootstrap 5.3 como base visual de la SPA y capas estrictas en el backend

- **Estado**: Aceptado · **Atributos**: mantenibilidad, consistencia visual, verificabilidad, disponibilidad de la demo
- **Relacionados**: ADR-001 (capas), ADR-002 (SPA sin frameworks), riesgo R-07 (cerrado)

## Contexto
El enunciado de la entrega final exige, para el frontend, **HTML5 + CSS3 + JavaScript moderno con Bootstrap o
Tailwind CSS** y prohíbe frameworks de interfaz (React, Angular, Vue). Para el backend exige una arquitectura
monolítica modular por capas con **controladores, servicios, repositorios, DTO y modelos**.

Al revisar el código frente a esos requisitos se encontró:
1. La SPA tenía un sistema de estilos propio (tokens CSS) sin Bootstrap ni Tailwind.
2. La fuente *Onest* se descargaba de Google Fonts: sin internet la demo cambiaba de aspecto.
3. Algunos controladores consultaban la base de datos (`agentes`, `usuarios/admin`, `turnos` sala,
   `franjas/disponibilidad`, `organizaciones`): deuda R-07 declarada en 04 y 09.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Bootstrap 5.3 (CSS local) como base + tema que mapea los tokens de FilaCero a sus variables CSS** | Cumple el requisito; Reboot, grilla, utilidades, botones, tablas, alertas, toasts, spinners y validación listos; el diseño aprobado por el docente no cambia; sin CDN | Hay que conciliar Reboot con las proporciones tipográficas propias y evitar choques de nombres (`.modal`, `.toast`) |
| Tailwind CSS | Utilidades atómicas | Necesita Node.js y un paso de compilación para producir el CSS; reescribir todas las clases de 54 módulos |
| Reescribir la interfaz solo con componentes de Bootstrap | Más "Bootstrap puro" | Pierde la identidad visual ya validada (paleta de alto contraste, sala, consola); alto riesgo a días de la entrega |
| Bootstrap también en JS (`bootstrap.bundle.js`) | Modales y menús listos | Dos capas manipularían el mismo DOM (la SPA repinta con `pintar()`); la SPA ya maneja foco, Esc y bloqueo de fondo |

| Alternativa (backend) | A favor | En contra |
|---|---|---|
| **Mover consultas a repositorios, reglas a servicios (`admin_servicios`, `consultas`, `sala`) y respuestas a DTO; prueba automática de capas** | Cumple el requisito y cierra R-07; la regla queda verificada por pytest | Más archivos por módulo |
| Mantener la deuda declarada | Cero cambios | Incumple el requisito explícito del curso |

## Decisión
**Frontend**
- `public/vendor/bootstrap/bootstrap.min.css` 5.3.9 (licencia MIT) se carga primero; `src/css/bootstrap-tema.css`
  asigna los tokens de FilaCero a las variables `--bs-*` (tipografía, colores, bordes, botones, tablas).
- Componentes de Bootstrap usados: `.btn` (con variantes FilaCero vía `--bs-btn-*`), `.table .table-hover
  .align-middle .table-responsive` (todas las tablas del panel), `.alert .alert-danger` (errores de formulario),
  `.toast .show` (avisos), `.spinner-border` (botones en espera), `.row .row-cols-* .g-*` (formularios en dos
  columnas), `.is-invalid` + `.invalid-feedback` (validación en el cliente) y `.visually-hidden` (accesibilidad).
- Solo el CSS de Bootstrap: el comportamiento lo maneja la SPA. La clase propia `.modal` se renombró a `.ventana`
  para no chocar con la de Bootstrap.
- La fuente *Onest* (OFL) se sirve desde `public/vendor/fuentes`; la CSP queda en `'self'` (sin Google Fonts).

**Backend**
- Ningún controlador importa `db`, usa `.query` ni importa un repositorio (siempre pasa por el servicio del
  dominio): lo verifica `tests/test_arquitectura_capas.py`.
- Nuevos archivos: `agentes/consultas.py` (consola y vista en vivo), `agentes/admin_servicios.py` (asesores,
  historial, métricas), `usuarios/admin_servicios.py`, `turnos/sala.py`, `organizaciones/{servicios,repositorios,dtos}.py`,
  `auditoria/{repositorios,dtos}.py`; `franjas/disponibilidad.py` queda como controlador delgado.

## Consecuencias
- (+) Cumple los requisitos técnicos 1 y 2 del enunciado sin alterar el diseño aprobado: la comparación de
  capturas antes/después difiere en menos de 0,1 % de píxeles (solo el reloj en vivo).
- (+) La demo funciona igual sin internet (Bootstrap y la fuente son locales).
- (+) R-07 queda **cerrado**; la regla de dependencias es verificable (58 pruebas de arquitectura).
- (+) Errores de los endpoints refactorizados con el formato uniforme `{"success": false, "error": ...}` y
  código según el tipo de error de dominio (p. ej. 409 si el correo del asesor ya existe).
- (−) +230 KB de CSS (se descarga una vez y queda en caché; ≈ 0,2 s en una LAN de 10 Mbps).
- (−) Hay que conocer la especificidad de Reboot al agregar estilos nuevos (documentado en `bootstrap-tema.css`).
