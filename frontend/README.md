# FilaCero · Frontend

> SPA en React para las cuatro caras de FilaCero: el portal del ciudadano, el panel de administración, la consola del asesor y la pantalla de la sala.

[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff.svg)](https://vite.dev/)
[![WCAG](https://img.shields.io/badge/WCAG%202.2-AA-0f2a2e.svg)](docs/VALIDACION-MANUAL-FRONTEND.md)

## Arquitectura

La organización por capas es la misma del proyecto de referencia, implementada en React. La equivalencia archivo por archivo está en [`docs/ARQUITECTURA-SPA-REACT.md`](docs/ARQUITECTURA-SPA-REACT.md).

```
src/
├── main.jsx                    # Monta <App/> y los estilos base
├── App.jsx                     # Sesión + enrutador + avisos (equivale a main.js)
├── api/
│   ├── http.js                 # request(): base URL, Bearer, 204, errores, 401 global
│   ├── publico.api.js          # horario, catálogo, franjas, OTP, reservar, consultar, sala
│   ├── auth.api.js             # login, logout, mi cuenta, cambiar clave
│   ├── agente.api.js           # panel y ciclo de atención
│   ├── catalogo.api.js         # sedes y trámites (CRUD)
│   └── admin.api.js            # métricas, historial, asesores, usuarios, bitácora
├── auth/
│   ├── session.service.js      # saveSession · getToken · getUsuario · clearSession
│   └── permissions.js          # isAdmin · isAgente · hasRole · canEdit · homeFor
├── router/
│   ├── routes.jsx              # routeList: path, public, requiresAuth, roles, page
│   ├── guards.js               # requireAuth · requireRole · resolveRoute
│   └── navegacion.js           # navegar() y useRutaActual() con la History API
├── pages/                      # Una página por ruta
│   ├── PortalPage.jsx          # /
│   ├── SalaPage.jsx            # /sala
│   ├── AdminPage.jsx           # /admin y /admin/:seccion
│   ├── AgentePage.jsx          # /agente
│   ├── CambioClavePage.jsx     # /cambiar-clave
│   ├── ForbiddenPage.jsx       # 403 (no cierra la sesión)
│   └── NotFoundPage.jsx        # 404
├── components/
│   ├── layout/                 # Marca, Encabezado, Enlace
│   ├── ui/                     # Dropdown, Modal, Toast, Switch, Icon, Accesibilidad
│   ├── cliente/                # ReservarTurno, ConsultarTurno, Ficha, Login
│   └── admin/                  # Resumen, Catalogo, Agentes, Historial, Usuarios, Actividad
├── hooks/                      # usePolling, useToast, useAccesibilidad
├── utils/                      # formatters, storage, errorMessages
└── css/                        # index (tokens), ui, cliente, admin, agente, sala, paginas
```

## Rutas y guardas

| Ruta | Acceso | Si no cumple |
|---|---|---|
| `/` | Público (el personal con sesión pasa a su inicio) | — |
| `/sala?sede=1` | Público | — |
| `/admin`, `/admin/:seccion` | ADMIN o SUPERVISOR (`usuarios` y `actividad`: solo ADMIN) | Sin sesión → `/?ingresar=1` · otro rol → 403 |
| `/agente` | AGENTE | Igual |
| `/cambiar-clave` | Cualquier cuenta con una clave temporal | Se exige antes de cualquier otra pantalla |
| Otra | — | 404 |

Las guardas solo evitan mostrar pantallas que van a fallar. **La seguridad real está en el backend**, que valida el rol en cada petición.

## Principios

1. **Ningún componente usa `fetch`.** Todo pasa por `api/http.js` mediante un módulo `*.api.js`.
2. **401 cierra la sesión** en toda la app (evento global). **403 no la cierra**: muestra "sin permiso".
3. **Estados de la interfaz:** cargando, error, vacío, éxito y sin permiso, en cada pantalla.
4. **Sin botones de "actualizar":** `usePolling` refresca cada 4–20 s y pausa cuando la pestaña está oculta.
5. **Accesibilidad:** salto al contenido, foco atrapado en los modales, combobox ARIA, texto grande, alto contraste y lectura en voz alta.

## Ejecutar

```powershell
npm install
npm run dev        # http://localhost:5173  (el backend debe estar en :5000)
npm run lint       # oxlint
npm run build      # dist/ para producción (nginx)
```

`VITE_API_URL` se define en `.env.development` (`http://127.0.0.1:5000/api/v1`) y en `.env.production` (`/api/v1`, detrás de nginx).

## Documentación

- [`docs/ARQUITECTURA-SPA-REACT.md`](docs/ARQUITECTURA-SPA-REACT.md): capas, flujo y equivalencia con la referencia.
- [`docs/CONTRATO-BACKEND-FRONTEND.md`](docs/CONTRATO-BACKEND-FRONTEND.md): qué envía y recibe cada pantalla.
- [`docs/VALIDACION-MANUAL-FRONTEND.md`](docs/VALIDACION-MANUAL-FRONTEND.md): lista de comprobación antes de la sustentación.
