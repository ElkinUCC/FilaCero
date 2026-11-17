# Guía para aplicar la entrega final de FilaCero

Esta carpeta es la **versión completa de la entrega final**: backend, frontend (HTML + CSS + JavaScript puro, sin
frameworks), documentación de arquitectura, diagramas UML y evidencias. No incluye secretos (`.env`), entorno
virtual (`venv`) ni cachés: esos se crean en cada equipo.

## 1. Instalar o actualizar la carpeta (Windows PowerShell)

1. Detén el backend y el frontend (Ctrl+C).
2. Si ya tenías el proyecto, renombra la carpeta anterior (por ejemplo `FilaCero-anterior`) y descomprime esta en su lugar.
3. Copia desde la carpeta anterior lo que es local de tu equipo:

```powershell
Copy-Item ..\FilaCero-anterior\backend\.env backend\.env          # tus secretos y conexión a MySQL
Copy-Item -Recurse ..\FilaCero-anterior\.git .git                  # opcional: conserva el historial de Git
```

4. Crea el entorno virtual (o cópialo también desde la carpeta anterior):

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```

Si no tenías `backend/.env`, créalo con `Copy-Item .env.example .env` y completa los datos de MySQL.

## 2. Backend: migraciones obligatorias

```powershell
cd backend
.\venv\Scripts\Activate.ps1
flask --app run db upgrade
```

Deben aparecer hasta cuatro líneas `Running upgrade ...` (`a7c9e1b3d5f7`, `b8d0f2a4c6e9`, `c1e3a5b7d9f0` y `d2f4b6c8e0a1`). Son migraciones
**aditivas**: no borran datos. **Sin este paso la API falla.** Si ves `Unknown column`, repite este paso.

Para la demostración recarga los datos simulados (equipos, reclamos, módulos y estados de los asesores).
**Reemplaza los datos operativos** de la organización demo; las cuentas de `CUENTAS_PROTEGIDAS` se conservan:

```powershell
python simulacion.py --cargar --si --dias 14 --turnos 2800
```

Con `--dias 14` el tablero ejecutivo tiene semana actual **y** semana anterior para comparar. Todos los clientes
simulados quedan con una **cédula inventada**. Al final imprime las credenciales y el **cliente de la
demostración**: *Juliana Restrepo Arango*, celular **3001112233**, **cédula 1037654321**, con un Samsung listo
para recoger y un LG en reparación.

Verifica:

```powershell
python -m pytest tests/ -q          # 164 passed
python run.py
```

## 3. Frontend

HTML + CSS + JavaScript puro, sin instalar nada ni compilar (no usa Node.js):

```powershell
cd frontend
python -m http.server 5173
```

O abre `frontend/index.html` con Live Server de VS Code.

Recarga con **Ctrl+F5**.

## 4. Guion sugerido para el profesor (≈ 8 min)

| # | Qué mostrar | Dónde |
|---|---|---|
| 1 | Portal con la paleta nueva y la reserva paso a paso: "¿Qué necesitas hoy?" | `http://localhost:5173/#/` |
| 2 | **Entrega de equipo reparado** → celular `3001112233` → código de prueba → "¡Hola de nuevo, Juliana!" → aparecen **sus equipos**: el Samsung listo (seleccionable) y el LG en reparación (bloqueado) → la sede se elige sola → hora en el **desplegable** ("Lo más pronto: 16:00 – 16:30") → confirmar: aviso de traer la cédula | Portal |
| 2b | Muestra el contraste: **Cotización de repuestos** no promete preparación en la confirmación | Portal |
| 3 | **Garantía de televisor** con otro celular: elige marca y pon una fecha de compra de hace 2 años (la rechaza) y luego una reciente (muestra hasta cuándo cubre) | Portal |
| 4 | **Reclamos** → escribe el reclamo → **En línea** → radicado `RC-…` sin reservar turno | Portal |
| 5 | Consola del asesor (`carlos.mejia@filacero.co` / `Asesor12345`): estado **Disponible ▾** → En almuerzo → volver | `#/agente` |
| 6 | El asistente dice **"Llamar a Juliana"**; la cola muestra nombres y debajo `TU-XXXXXX · trámite · EQ-XXXXXX`. Suena la voz cada 20 s. Al atenderla, **Entregar equipo** pide la cédula: prueba `1037650000` (rechazada) y luego `1037654321` | Consola → Atención |
| 7 | Pestaña **Equipos**: tablero del taller; avanza una tarjeta y **Recibir equipo** (formulario) | Consola → Equipos |
| 8 | Pestaña **Reclamos**: abre el de Juliana, responde y resuelve | Consola → Reclamos |
| 9 | Vuelve al portal → Consultar mi turno → **Por celular** `3001112233`: ve turnos, equipos (con avance) y la respuesta del reclamo | Portal |
| 9b | **Minichat**: en Consultar → Por celular, abre el reclamo de Juliana y escribe "¿Cuánto vale y a qué hora abren?": el asistente responde al instante. En la consola aparece la alerta "Nuevo mensaje de un cliente" y el asesor responde en Reclamos | Portal y consola |
| 10 | Panel → **Resumen**: tablero ejecutivo (indicador principal, variación contra el periodo anterior, tendencia, demanda por hora; pasa el puntero por las gráficas; cambia Hoy/7/30/90 días y sede; CSV). El supervisor ve lo mismo con la etiqueta "Solo lectura" | `#/admin` |
| 10b | Panel (`laura.gomez@filacero.co` / `Admin12345`): Asesores con su **estado actual** (Atendiendo, En almuerzo, En pausa, Fuera de turno); Sedes alineada; Trámites con **Tipo de atención**; detalle al hacer clic; eliminar asesor | `#/admin/...` |
| 11 | Pantalla de sala con nombre completo y módulo | ícono de pantalla en Sedes |
| 12 | Documento de arquitectura: C4, ADR-002 (SPA sin frameworks), ADR-004 y ADR-010 revisados, ADR-013 a 016, seguridad (11), evolución E-1 a E-1d | `docs/arquitectura/README.md` |
| 12b | Diagramas UML: casos de uso, clases, entidad-relación, paquetes, componentes, despliegue y secuencias | `docs/diagramas/` |
| 12c | Informe PDF de decisiones arquitectónicas y guion del video | `docs/entrega/` |
| 13 | **Manual metodológico** del proyecto (se abre con doble clic, sin internet) | `docs/MANUAL_FilaCero.html` |

La voz funciona en **Chrome o Edge**; sube el volumen antes de empezar.

## 5. Si algo falla

| Síntoma | Solución |
|---|---|
| Error 500 o `Unknown column` | `flask --app run db upgrade` y reinicia `python run.py` |
| "No encontramos equipos pendientes con este celular" | Recarga datos con `python simulacion.py --cargar --si` o registra uno en Consola → Equipos → Recibir equipo |
| El trámite no muestra el paso de equipo/garantía/reclamo | Panel → Trámites → Editar → **Tipo de atención** (la migración lo deduce por el nombre) |
| No suena la voz | Chrome/Edge, botón "Repetir", revisa "Voz activada" |
| "La cédula no coincide" al entregar | Es el control nuevo: usa la cédula registrada (Juliana: `1037654321`). Los equipos antiguos sin cédula la registran en la primera entrega |
| El tablero no compara con el periodo anterior | Carga datos de 14 días: `python simulacion.py --cargar --si --dias 14 --turnos 2800` |
| "Demasiadas solicitudes" al pedir códigos | Es el límite anti-abuso (5 códigos por minuto); espera un minuto |
| Estilos viejos | Ctrl+F5 |
| Una cuenta protegida no puede entrar | `python simulacion.py --cuentas --probar-clave`: dice si no existe (o si existe con otro dominio, `.co` / `.com`), si está bloqueada (`--desbloquear`) o si la contraseña no coincide. Para fijar una contraseña nueva: `python scripts/crear_cuenta.py correo ROL "Nombre"` |
| En `--en-vivo` los asesores no atienden | Una ejecución anterior se detuvo con turnos abiertos: la simulación los libera sola si llevan más de 10 min |
