# FilaCero · Frontend

SPA hecha con HTML, CSS y JavaScript puro, con Bootstrap 5.3 para los estilos base. No usa React, Angular ni
Vue, y tampoco necesita Node.js ni compilación.

## Cómo ejecutarlo

Con el backend encendido (`python run.py` en `backend/`):

```powershell
cd frontend
python -m http.server 5173
```

Abrir `http://localhost:5173`. Hay que usar un servidor (no doble clic en `index.html`) porque los módulos ES
del navegador no cargan desde archivos locales. También funciona con Live Server de VS Code, agregando su
dirección a `CORS_ALLOWED_ORIGINS` en `backend/.env`.

La URL de la API y la organización se configuran en `src/js/config.js`.

## Estructura

```text
frontend/
├── index.html              único HTML: contenedor #app, estilos y main.js
├── public/vendor/          Bootstrap 5.3 y la fuente Onest (copias locales)
└── src/
    ├── css/                estilos por pantalla (cliente, agente, admin, sala) y responsive
    └── js/
        ├── main.js         lee la ruta, aplica la guarda y pinta la página
        ├── config.js       URL de la API y organización
        ├── router/         rutas (#/...), guardas de sesión y rol, navegación
        ├── pages/          Portal, Sala, Agente, Admin, cambio de clave, 403 y 404
        ├── components/     piezas reutilizables por rol (cliente, agente, admin, ui)
        ├── api/            http.js (único fetch) y un archivo por grupo de endpoints
        ├── auth/           sesión (token JWT) y permisos por rol
        └── utils/          pintar HTML seguro, formatos de fecha, consulta periódica, voz
```

## Cómo funciona

- **Enrutamiento:** las rutas usan el hash de la URL (`#/agente`, `#/admin/sedes`). `main.js` escucha
  `hashchange`, busca la ruta en `routes.js` y `guards.js` revisa si hay sesión y si el rol puede entrar.
- **Estado:** cada página guarda su estado en un objeto y vuelve a pintar cuando cambia. La sesión se guarda
  en `localStorage`.
- **DOM y eventos:** `utils/dom.js` arma el HTML escapando los datos (evita XSS) y usa delegación de eventos
  con `data-accion`, así cada contenedor tiene un solo listener.
- **API:** todo pasa por `api/http.js`, que agrega el token, convierte la respuesta a JSON y traduce los
  errores a mensajes para la persona.
- **Validación:** los formularios se validan antes de enviar (celular, nombre, cédula, fechas) con las clases
  `is-invalid` de Bootstrap. El backend vuelve a validar todo.
- **Datos en vivo:** la consola del asesor y la sala consultan la API cada pocos segundos (`utils/polling.js`).

Más detalle en [docs/ARQUITECTURA-SPA-VANILLA.md](docs/ARQUITECTURA-SPA-VANILLA.md) y el contrato con el
backend en [docs/CONTRATO-BACKEND-FRONTEND.md](docs/CONTRATO-BACKEND-FRONTEND.md).

## Cuentas de prueba

Después de `python simulacion.py --cargar`:

| Rol | Usuario |
|---|---|
| Administrador | laura.gomez@filacero.co |
| Asesor (Sede Centro) | carlos.mejia@filacero.co |
| Ciudadano | cualquier celular; en modo prueba el código OTP aparece en pantalla |

Las contraseñas de prueba están en `backend/simulacion.py` (`SIM_CLAVE_ADMIN` y `SIM_CLAVE_ASESOR`).
