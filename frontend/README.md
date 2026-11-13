# FilaCero · Frontend (HTML + CSS + JavaScript puro)

SPA sin frameworks: **no usa React, Angular, Vue ni librerías**, no necesita Node.js, npm ni compilación.
El navegador carga `index.html`, los estilos de `src/css/` y los módulos ES de `src/js/`.

## Cómo ejecutarlo

1. Enciende el backend (`cd backend && python run.py` → `http://127.0.0.1:5000`).
2. Sirve esta carpeta con un servidor estático (los módulos ES no funcionan con doble clic sobre el archivo):

```powershell
cd frontend
python -m http.server 5173
```

Abre `http://localhost:5173`. También sirve la extensión **Live Server** de VS Code (`http://127.0.0.1:5500`).

El origen que uses debe estar en `CORS_ALLOWED_ORIGINS` de `backend/.env`.
La URL de la API y la organización están en `src/js/config.js`.

## Estructura

```text
frontend/
├── index.html                  # contenedor único #app + hojas de estilo + main.js
├── public/favicon.svg
├── nginx.conf · Dockerfile     # despliegue con Docker (nginx sirve los archivos tal cual)
└── src/
    ├── css/                    # index (tokens) · ui · cliente · agente · admin · sala · asistente · responsive
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
        │   ├── ui/             # modal · toast · chat · icon · cambiarClave · asistenteIA
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
