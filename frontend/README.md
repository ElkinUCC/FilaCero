# FilaCero · Frontend

Aplicación SPA construida con React 19 y Vite. Incluye portal ciudadano, consola de asesor, sala de turnos y panel administrativo.

## Requisitos

- Node.js 22 o compatible con Vite 8.

## Instalación

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

La aplicación se sirve en `http://localhost:5173`.

Variables de entorno:

- `VITE_API_URL`: URL base de la API, por defecto `http://127.0.0.1:5000/api/v1`.
- `VITE_ORGANIZATION_SLUG`: slug del tenant que recibe las solicitudes públicas, por defecto `filacero-demo`.

El slug se envía como `X-Organization-Slug` cuando la petición no lleva sesión autenticada. Las peticiones autenticadas se asocian al tenant del JWT y no dependen del slug configurado en el navegador.

## Scripts

```powershell
npm run dev
npm run build
npm run preview
npm run lint
```

Consulta el README de la raíz para iniciar backend, base de datos y frontend conjuntamente.
