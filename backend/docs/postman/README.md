# Postman · FilaCero

## Archivos

- `FilaCero.postman_collection.json`: 66 peticiones en 9 carpetas con aserciones, que recorren los flujos principales de la API (52 de las 76 rutas). Equipos, reclamos y el asistente se prueban con `pytest` y `simulacion.py`; la lista completa de rutas sale con `flask --app run routes`.
- `FilaCero.local.postman_environment.json`: entorno local. Las claves van vacías y se llenan en Postman.

## Preparación

1. En `backend/`: `python simulacion.py --cargar` (muestra las claves de prueba) y `python run.py`.
2. En Postman, importa la colección y el entorno, y selecciona **FilaCero - Local**.
3. Completa `clave_admin` y `clave_agente`. Cambia `fecha` por la fecha de mañana.
4. Ejecuta la colección completa con **Run collection**. Los login guardan los tokens solos (`token_admin`, `token_agente`, `token_cliente`) y la reserva guarda `codigo_turno`.

## Carpetas

| Carpeta | Qué demuestra |
|---|---|
| 01 Salud | API y base de datos vivas |
| 02 Portal del ciudadano | OTP → reserva → consulta autorizada → OTP nuevo para cancelar → sala |
| 03 Autenticación | Login de administrador y asesor; 401 con una clave errada |
| 04 Consola del asesor | Ciclo de atención completo; 403 al intentar entrar a admin |
| 05 Catálogo | CRUD; **409** con un nombre repetido |
| 06 Supervisión | Métricas, en vivo, historial, asesores |
| 07 Usuarios y bitácora | Crear, editar rol, restablecer clave, auditoría |
| 08 Cliente con cuenta | Rutas de compatibilidad de los primeros sprints |
| 09 Cierre de sesión | Cambia y restaura la clave; *logout* → el token responde **401** al instante |

## Desde la terminal (opcional)

```powershell
npx newman run FilaCero.postman_collection.json -e FilaCero.local.postman_environment.json `
  --env-var clave_admin=<clave> --env-var clave_agente=<clave> --env-var fecha=2026-11-02
```

Resultado de referencia: 64 peticiones y 21 aserciones, con 0 fallos.
