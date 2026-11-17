# Arquitectura del SPA de FilaCero (HTML + CSS + JavaScript puro)

## 1. Por qué JavaScript *vanilla*

El curso exige un frontend **sin frameworks** de JavaScript. FilaCero se escribe con lo que
trae el navegador: HTML5, CSS3, módulos ES (`import`/`export`), `fetch`, `localStorage`, la API de historial
(`hashchange`), `ResizeObserver` (gráficas) y Web Speech API (voz del llamado). No hay `package.json`,
`node_modules` ni paso de compilación. La organización por capas es la misma del proyecto de referencia
(*frontend-alojamientos*).

## 2. Equivalencia con la referencia

| Referencia (*vanilla*) | FilaCero | Responsabilidad |
|---|---|---|
| `index.html` + `#app` | `index.html` + `#app` | Contenedor único |
| `src/js/main.js` (`render`, `navigate`) | `src/js/main.js` (`render`) + `router/navegacion.js` (`navigate`) | Pinta la página de la URL actual |
| `router/routes.js` (`routeList`) | `router/routes.js` (`routeList`, `matchRoute`) | Tabla de rutas con `public`, `requiresAuth`, roles y parámetros `:seccion` |
| `router/guards.js` (`requireAuth`, `requireAdmin`) | `router/guards.js` (`requireAuth`, `requireRole`, `resolveRoute`) | Decide entre página, redirección, 403 o 404 |
| `api/http.js` (`request`, `formatApiError`) | `api/http.js` (`request`, `http`, `query`) + `utils/errorMessages.js` | Único punto de red |
| `api/auth.api.js`, `alojamientos.api.js`… | `api/auth.api.js`, `publico.api.js`, `agente.api.js`, `catalogo.api.js`, `admin.api.js`, `asistente.api.js` | Un módulo por recurso |
| `auth/session.service.js` | `auth/session.service.js` | `saveSession`, `getToken`, `clearSession`, `hasSession` |
| `auth/permissions.js` | `auth/permissions.js` | `isAuthenticated`, `isAdmin`, `hasRole`, `canEdit`, `homeFor` |
| `pages/*Page.js` (`XPage()` + `mountXPage()`) | `pages/*Page.js` (`XPage()` + `mountXPage()`) | Una página por ruta |
| `components/layout/Navbar.js` | `components/layout/{marca,encabezado}.js` | Piezas comunes |
| `utils/{storage,formatters,errorMessages}.js` | `utils/{storage,formatters,errorMessages,dom,polling,voz}.js` | Utilidades sin interfaz |
| `css/main.css` + Bootstrap | `src/css/*.css` con *tokens* propios | Estilos |
| Delegación `data-view` + `navigate()` | Delegación `data-accion` + enlaces `href="#/..."` | Navegación sin recargar |

## 3. Flujo de una pantalla

```
URL (#/admin/usuarios)
  │ evento "hashchange"             (main.js)
  ▼
matchRoute("/admin/usuarios")       (router/routes.js) → { route, params: { seccion: "usuarios" } }
  ▼
resolveRoute(match, usuario)        (router/guards.js)
  ├── sin sesión                   → redirect "/?ingresar=1"
  ├── clave temporal                → redirect "/cambiar-clave"
  ├── rol insuficiente              → ForbiddenPage (403, la sesión sigue)
  └── ok                            → app.innerHTML = AdminPage(ctx); limpiar = mountAdminPage(ctx)
                                         ▼
                             components/admin/usuarios.js → montarUsuarios(contenedor)
                                         ▼  crearSondeo(() => adminApi.listarUsuarios(), 20000, render)
                             api/admin.api.js → api/http.js → GET /api/v1/admin/usuarios/
```

Al cambiar de ruta, `main.js` llama la función de limpieza que devolvió `mountXPage()`: así se detienen
las consultas periódicas, relojes y la voz de la página anterior.

## 4. Patrones de código

### 4.1 Página = `XPage()` + `mountXPage()`

```js
export function SalaPage() {             // 1) devuelve el HTML inicial
  return html`<div data-sala></div>`;
}
export function mountSalaPage() {        // 2) enlaza eventos y carga datos
  const raiz = document.querySelector("[data-sala]");
  const sondeo = crearSondeo(() => pantallaSala(sedeId), 4000, ({ datos }) => pintar(raiz, vistaSala(datos)));
  return () => sondeo.detener();         // 3) limpieza al salir de la página
}
```

### 4.2 HTML seguro con la plantilla `html```

`utils/dom.js` define la plantilla etiquetada `html`. Todo valor interpolado se **escapa** (`<` → `&lt;`…),
así un nombre como `<script>` se muestra como texto y no se ejecuta (protección contra XSS). Los iconos y
otros fragmentos ya seguros se marcan con `crudo()`.

```js
html`<strong>${turno.usuario_nombre}</strong>`   // seguro aunque el nombre traiga HTML
```

### 4.3 Estado + repintado

Cada componente guarda su estado en un objeto (`const s = { paso, celular, ... }`) y tiene una función
`render()` que vuelve a generar su HTML. `pintar(el, html)` reemplaza el contenido **conservando el foco y
el cursor** del campo en que se escribe; `pintarSiCambia()` no toca el DOM si el HTML no cambió (útil en
pantallas que se actualizan cada pocos segundos).

### 4.4 Delegación de eventos

Un solo `addEventListener("click")` por contenedor; los botones llevan `data-accion`:

```js
contenedor.addEventListener("click", (e) => {
  const b = e.target.closest("[data-accion]");
  if (b) acciones[b.dataset.accion](b);       // p. ej. data-accion="llamar" data-id="42"
});
```

### 4.5 Datos en vivo sin botón de actualizar

`utils/polling.js` → `crearSondeo(cargar, ms, alCambiar)` consulta cada `ms`, se pausa con la pestaña
oculta, conserva el último dato si una consulta falla y expone `refrescar()`, `poner()` (cambios
optimistas) y `detener()`. El encabezado muestra "En vivo · hh:mm:ss" o "Sin conexión, reintentando".

## 5. Manejo de sesión y errores (`api/http.js`)

| Respuesta | Qué hace `http.js` | Qué ve la persona |
|---|---|---|
| 2xx | Devuelve el JSON | La pantalla con datos |
| 400 / 404 / 409 | Lanza `Error(mensaje del backend)` | El mensaje en el formulario o en un aviso |
| 401 con sesión | `clearSession()` + evento `filacero:sesion-expirada` | Vuelve al portal con el acceso del personal abierto |
| 403 | Lanza `Error` con `status = 403` | "No tienes permisos…" **sin cerrar sesión** |
| 429 | Lanza `Error` | "Demasiados intentos…" |
| Sin red | `status = 0` | "No hay conexión con el servidor…" |

## 6. Accesibilidad

- "Saltar al contenido", ventanas con foco atrapado y Escape, pestañas con flechas (patrón ARIA).
- Regiones `aria-live` para avisos (`utils/voz.js` → `anunciar()`), llamado por voz con la Web Speech API.
- Desplegables nativos `<select>` (accesibles por teclado y lectores de pantalla sin código extra).
