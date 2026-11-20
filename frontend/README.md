# FilaCero · Frontend (HTML + CSS + JavaScript puro)

SPA sin frameworks de interfaz (no usa React, Angular ni Vue) y con **Bootstrap 5.3.9** como base de estilos; no necesita Node.js, gestores de paquetes ni compilación.
El navegador carga `index.html`, Bootstrap y la fuente desde `public/vendor/` (copia local: funciona sin internet), los estilos de `src/css/` y los módulos ES de `src/js/`.

## Cómo ejecutarlo

1. Enciende el backend (`cd backend && python run.py` → `http://127.0.0.1:5000`).
2. Sirve esta carpeta con un servidor estático (los módulos ES no funcionan con doble clic sobre el archivo):

```powershell
cd frontend
python -m http.server 5173
```

Abre `http://localhost:5173`. También sirve la extensión **Live Server** de VS Code (`http://127.0.0.1:5500`).

El origen que uses debe estar en `CORS_ALLOWED_ORIGINS` de `backend/.env`.
La URL de la API (se calcula sola a partir del equipo: `http://<equipo>:5000/api/v1`) y la organización están en `src/js/config.js`.

## Estructura

```text
frontend/
├── index.html                  # contenedor único #app + hojas de estilo + main.js
├── public/
│   ├── favicon.svg
│   └── vendor/                 # bootstrap/ (5.3.9, MIT) · fuentes/onest (OFL)
└── src/
    ├── css/                    # bootstrap-tema (puente con Bootstrap) · fuentes · index (tokens) · ui · cliente · agente · admin · sala · asistente · responsive
    └── js/
        ├── main.js             # render(): URL → ruta → guarda → XPage() + mountXPage()
        ├── config.js           # API_URL y ORGANIZATION_SLUG
        ├── router/
        │   ├── routes.js       # tabla de rutas (public, requiresAuth, roles, :params)
        │   ├── guards.js       # requireAuth, requireRole, resolveRoute → página/redirect/403/404
        │   └── navegacion.js   # navigate(), rutaActual() con rutas #/
        ├── pages/              # PortalPage · SalaPage · AgentePage · AdminPage · CambioClavePage · 403 · 404
        ├── components/
        │   ├── cliente/        # reservarTurno (asistente por pasos) · consultarTurno · ficha · login
        │   ├── agente/         # equipos (taller) · reclamos (minichat) · prepararTurno · verificarCedula …
        │   ├── admin/          # resumen (tablero) · catalogo · agentes · usuarios · historial · actividad · graficas (SVG)
        │   ├── ui/             # modal · toast · cargando (spinner) · chat · icon · cambiarClave · asistenteIA
        │   └── layout/         # marca · encabezado
        ├── api/                # http.js (único fetch) + auth · publico · agente · catalogo · admin · asistente
        ├── auth/               # session.service.js (token en localStorage) · permissions.js (roles)
        └── utils/              # dom.js · formatters.js · polling.js · voz.js · storage.js · errorMessages.js
```

Arquitectura detallada y patrones: [`docs/ARQUITECTURA-SPA-VANILLA.md`](docs/ARQUITECTURA-SPA-VANILLA.md).
Contrato con el backend: [`docs/CONTRATO-BACKEND-FRONTEND.md`](docs/CONTRATO-BACKEND-FRONTEND.md).

## Cuentas de demostración

Después de `python simulacion.py --cargar --si` en el backend:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | laura.gomez@filacero.co | Admin12345 |
| Asesor (Sede Centro) | carlos.mejia@filacero.co | Asesor12345 |
| Ciudadano | celular 3001112233 | código OTP (en modo prueba se muestra en pantalla) |

## Bootstrap en la SPA

Bootstrap 5.3.9 se carga desde `public/vendor/bootstrap/bootstrap.min.css` (sin CDN) y `src/css/bootstrap-tema.css`
le asigna los colores, la tipografía y los radios de FilaCero mediante sus variables `--bs-*`. Solo se usa su CSS:
el comportamiento (ventanas, avisos, menús) lo maneja el JavaScript de la SPA (ADR-017).

| Bootstrap | Dónde se usa |
|---|---|
| Reboot + variables `--bs-*` | Base de toda la interfaz (`bootstrap-tema.css`) |
| `.btn` | Todos los botones; las variantes `btn--primario`, `btn--suave`, `btn--peligro`… fijan `--bs-btn-*` |
| `.table .table-hover .align-middle .table-responsive` | Tablas del panel (`admin/tablaSeccion.js`, `admin/resumen.js`) |
| `.row .row-cols-1 .row-cols-sm-2 .g-3` | Formularios en dos columnas (usuarios, asesores, equipos) |
| `.is-invalid` + `.invalid-feedback` | Validación en el cliente (celular, nombre, fecha de garantía, cédula) |
| `.alert .alert-danger` | Mensajes de error de formularios (`ui/modal.js → mensajeError`) |
| `.toast .show` | Avisos breves (`ui/toast.js`) |
| `.spinner-border-sm` | Botones en espera (`ui/cargando.js`) |
| `.visually-hidden` | Textos solo para lectores de pantalla |
