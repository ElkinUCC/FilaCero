# Arquitectura del SPA de FilaCero

## 1. Por qué React y no JavaScript *vanilla*

El proyecto de referencia (*frontend-alojamientos*) es un SPA *vanilla*, y su propio material (anexos 03 y 04) presenta React como la evolución natural cuando las pantallas tienen mucho estado vivo. FilaCero es justamente ese caso: la consola del asesor se refresca cada 5 s y lleva reloj, cronómetros y alertas; el panel combina 4 consultas cada 15 s; la sala habla en voz alta. Por eso se usa React, **con la misma organización por capas** de la referencia.

## 2. Equivalencia con la referencia

| Referencia (*vanilla*) | FilaCero (React) | Responsabilidad |
|---|---|---|
| `index.html` + `#app` | `index.html` + `#root` | Contenedor único |
| `src/js/main.js` (`render`, `navigate`) | `App.jsx` + `router/navegacion.js` | Pinta la página de la URL actual |
| `router/routes.js` (`routeList`) | `router/routes.jsx` (`routeList`, `matchRoute`) | Tabla de rutas con `public`, `requiresAuth`, roles y parámetros `:id` |
| `router/guards.js` (`requireAuth`, `requireAdmin`) | `router/guards.js` (`requireAuth`, `requireRole`, `resolveRoute`) | Decide entre página, redirección, 403 o 404 |
| `api/http.js` (`request`, `formatApiError`) | `api/http.js` (`request`, `http`, `query`) + `utils/errorMessages.js` (`formatApiError`) | Único punto de red |
| `api/auth.api.js`, `alojamientos.api.js`... | `api/auth.api.js`, `publico.api.js`, `agente.api.js`, `catalogo.api.js`, `admin.api.js` | Un módulo por recurso |
| `auth/session.service.js` | `auth/session.service.js` | `saveSession`, `getToken`, `clearSession`, `hasSession` |
| `auth/permissions.js` | `auth/permissions.js` | `isAuthenticated`, `isAdmin`, `getCurrentRole`, `hasRole`, `homeFor` |
| `pages/*Page.js` (`XPage()` + `mountXPage()`) | `pages/*Page.jsx` (componente) | Una página por ruta |
| `components/layout/Navbar.js` | `components/layout/{Marca,Encabezado,Enlace}.jsx` | Piezas comunes |
| `utils/{storage,formatters,errorMessages}.js` | `utils/{storage,formatters,errorMessages}.js` | Utilidades sin interfaz |
| `css/main.css` + Bootstrap | `css/*.css` con *tokens* propios | Estilos (sin framework: el diseño y el contraste se controlan para WCAG AA) |
| Delegación `data-view` + `navigate()` | `<Enlace href>` + `navegar()` | Navegación sin recargar, con `<a>` reales |

## 3. Flujo de una pantalla

```
URL (/admin/usuarios)
  │ useRutaActual()             (router/navegacion.js: popstate + History API)
  ▼
matchRoute(pathname)            (router/routes.jsx)  → { route, params: { seccion: "usuarios" } }
  ▼
resolveRoute(match, usuario)    (router/guards.js)
  ├── sin sesión               → redirect "/?ingresar=1"
  ├── clave temporal            → redirect "/cambiar-clave"
  ├── rol insuficiente          → ForbiddenPage (403, la sesión sigue)
  └── ok                        → <AdminPage params usuario .../>
                                     ▼
                         components/admin/Usuarios.jsx
                                     ▼  usePolling(() => adminApi.listarUsuarios())
                         api/admin.api.js → api/http.js → GET /api/v1/admin/usuarios/
```

## 4. Manejo de sesión y errores

| Respuesta | Qué hace `http.js` | Qué ve la persona |
|---|---|---|
| 2xx | Devuelve el JSON | La pantalla con datos |
| 400 / 404 / 409 | Lanza `Error(mensaje del backend)` | El mensaje en el formulario o en un aviso |
| 401 con sesión | `clearSession()` + evento `filacero:sesion-expirada` | Vuelve al portal con el acceso del personal abierto |
| 403 | Lanza `Error` con `status = 403` | "No tienes permisos…" **sin cerrar sesión** |
| 429 | Lanza `Error` | "Demasiados intentos…" |
| Sin red | `status = 0` | "No hay conexión con el servidor…" |

## 5. Estado en vivo sin botones de actualizar

`hooks/usePolling(cargar, intervaloMs, deps)` consulta periódicamente, pausa cuando la pestaña está oculta, conserva el último dato si una consulta falla y expone `{ datos, error, actualizado, refrescar }`. `Encabezado` muestra "En vivo · hh:mm:ss" o "Sin conexión, reintentando" (ADR-0005).

## 6. Accesibilidad

- `SaltarAlContenido` en cada pantalla; `main#contenido` recibe el foco al cambiar de sección.
- Modales con foco atrapado y Escape; desplegables con el patrón *combobox* de ARIA.
- `hooks/useAccesibilidad.js`: texto grande, alto contraste y lectura en voz alta (Web Speech API), recordados en el navegador; `anunciar()` usa una región `aria-live`.
- Auditoría con axe-core: 0 violaciones WCAG 2.2 AA en portal, panel, consola, sala, 403 y 404.
