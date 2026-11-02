# FilaCero en internet, gratis (demostración de unos días)

| Pieza | Servicio gratuito | Dirección que tendrás |
|---|---|---|
| Base de datos MySQL | **Aiven** (plan Free, sin tarjeta) | interna |
| Backend (API Flask) | **Render** (Web Service Free) | `https://filacero-api.onrender.com` |
| Frontend (React) | **Vercel** (plan Hobby) | `https://filacero.vercel.app` (o el nombre libre que te asigne) |

> **Dominio:** las direcciones `.onrender.com` y `.vercel.app` son gratis. Un dominio propio (`filacero.com`) cuesta alrededor de 10 USD al año; se puede agregar después en Vercel sin cambiar nada más.
>
> **SMS:** enviar SMS reales no es gratis (las pruebas gratuitas de los proveedores solo envían a números que tú verificas). Para la demostración, el código se muestra en pantalla con `DEMO_PUBLICA=true`.

---

## 0. Antes de empezar

1. Copia los archivos del zip encima de tu proyecto y prueba en localhost como siempre (`python run.py` y `npm run dev`). Los cambios solo se activan con variables de entorno, así que tu localhost sigue igual.
2. Sube a GitHub:
   ```powershell
   cd C:\Users\USUARIO\Documents\Visual-core-Elkin\FilaCero
   git add -A
   git commit -m "Preparar despliegue de demostración"
   git push origin main
   ```
3. Genera dos claves y guárdalas en un bloc de notas (las usarás en Render):
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   python scripts\generate_secret.py
   ```

---

## 1. Base de datos en Aiven

1. Entra a https://aiven.io y crea una cuenta (no pide tarjeta).
2. **Create service → MySQL → plan Free**. Ponle de nombre `filacero-db`.
3. Cuando esté en verde (*Running*), copia el **Service URI**. Se ve así:
   `mysql://avnadmin:CLAVE@mysql-filacero-xxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`
   FilaCero lo entiende tal cual: no hay que modificarlo.

### Cargar los datos desde tu PC

En una terminal **nueva** (las variables solo duran mientras esté abierta):

```powershell
cd C:\Users\USUARIO\Documents\Visual-core-Elkin\FilaCero\backend
.\venv\Scripts\Activate.ps1

$env:DATABASE_URL = "PEGA_AQUÍ_EL_SERVICE_URI_DE_AIVEN"
$env:CUENTAS_PROTEGIDAS = "elkinadmin@filacero.com,elkinagente@filacero.com"
$env:SIM_CLAVE_ADMIN = "UnaClaveAdmin2026"      # cámbialas: el link será público
$env:SIM_CLAVE_ASESOR = "UnaClaveAsesor2026"

flask --app run db upgrade
python simulacion.py --cargar --dias 15          # escribe BORRAR; crea las sedes y los datos
python scripts\crear_cuenta.py elkinadmin@filacero.com ADMIN "Elkin Administrador"
python scripts\crear_cuenta.py elkinagente@filacero.com AGENTE "Elkin Asesor" "Sede Centro"
```

Cuando termine, **cierra esa terminal**. Así tu PC vuelve a usar tu MySQL local.

> **Importante:** mientras `$env:DATABASE_URL` esté definida, todos los comandos van contra la base en la nube.

---

## 2. Backend en Render

1. Entra a https://render.com y regístrate con tu cuenta de GitHub.
2. **New → Web Service → elige el repositorio `FilaCero`**.
3. Configura:

| Campo | Valor |
|---|---|
| Name | `filacero-api` |
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `flask --app run db upgrade && waitress-serve --host 0.0.0.0 --port $PORT --threads 8 run:app` |
| Instance Type | **Free** |
| Health Check Path (en *Advanced*) | `/health/listo` |

4. En **Environment Variables** agrega:

| Variable | Valor |
|---|---|
| `PYTHON_VERSION` | `3.12.7` |
| `FLASK_ENV` | `production` |
| `FLASK_DEBUG` | `false` |
| `SECRET_KEY` | la primera clave que generaste |
| `JWT_SECRET_KEY` | la segunda clave |
| `DATABASE_URL` | el Service URI de Aiven |
| `DEMO_PUBLICA` | `true` |
| `FILACERO_OTP_TEST_MODE` | `true` |
| `CUENTAS_PROTEGIDAS` | `elkinadmin@filacero.com,elkinagente@filacero.com` |
| `REGISTRO_PUBLICO` | `false` |
| `PROXIES_CONFIABLES` | `1` |
| `CORS_ALLOWED_ORIGINS` | por ahora `http://localhost:5173` (en el paso 3 pones la dirección de Vercel) |

5. **Create Web Service**. Cuando diga *Live*, abre `https://filacero-api.onrender.com/health/listo`. Debe responder `"base_de_datos": "ok"`.

---

## 3. Frontend en Vercel

1. Entra a https://vercel.com y regístrate con GitHub.
2. **Add New → Project → importa `FilaCero`**.
3. Configura:

| Campo | Valor |
|---|---|
| Root Directory | `frontend-react` |
| Framework Preset | Vite |
| Environment Variable | `VITE_API_URL` = `https://filacero-api.onrender.com/api/v1` |

4. **Deploy**. Copia la dirección que te da, por ejemplo `https://filacero.vercel.app`.
5. Vuelve a Render → `filacero-api` → **Environment** y cambia
   `CORS_ALLOWED_ORIGINS` = `https://filacero.vercel.app` (tu dirección exacta, sin `/` al final). Guarda y espera a que se redespliegue.

Listo: comparte `https://filacero.vercel.app`.
El archivo `frontend-react/vercel.json` hace que funcionen las direcciones `/admin`, `/agente` y `/sala` al abrirlas directo.

---

## 4. Que no se duerma (opcional)

Render apaga el servicio gratuito tras **15 minutos sin visitas** y tarda **cerca de un minuto** en despertar. Mientras tanto la app muestra *"Conectando con el servidor…"*.

Para evitarlo, crea un monitor gratuito en https://uptimerobot.com:
- Tipo HTTP(s), URL `https://filacero-api.onrender.com/health`, cada 5 minutos.

Un solo servicio encendido todo el mes gasta unas 744 horas, dentro de las 750 gratuitas.

---

## 5. Durante la demostración

- Para que tus amigos vean reservas llegando solas, desde tu PC (terminal con `$env:DATABASE_URL` de Aiven):
  `python simulacion.py --en-vivo`
- No publiques las claves de administrador. Las cuentas de asesor puedes compartirlas si quieres que prueben la consola.

## 6. Al terminar

- Render → `filacero-api` → **Suspend**.
- Aiven → `filacero-db` → **Power off** (o *Delete* si ya no lo necesitas).
- Vercel puede quedar publicado sin costo.

## Si algo falla

| Síntoma | Solución |
|---|---|
| El portal dice "No hay conexión con el servidor" | Revisa `VITE_API_URL` en Vercel y vuelve a desplegar (*Redeploy*) |
| Error de CORS en la consola del navegador | `CORS_ALLOWED_ORIGINS` en Render debe ser exactamente la dirección de Vercel |
| Render falla al arrancar con "Configuración insegura" | Faltan `SECRET_KEY`/`JWT_SECRET_KEY` largas o `DEMO_PUBLICA=true` |
| Render no conecta a la base | Copia de nuevo el Service URI de Aiven y verifica que el servicio esté *Running* |
| Tarda en cargar la primera vez | Normal en el plan gratuito; espera hasta un minuto (o usa el paso 4) |
