
# Instalación local — FilaCero

## Requisitos

- Python compatible con las dependencias del proyecto.
- Entorno virtual de Python.
- Base de datos configurada según `app/config.py`.
- Dependencias instaladas desde el archivo de dependencias existente.

## Preparación en Windows PowerShell

Desde la carpeta `backend`:

```powershell
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Si el entorno virtual no existe, créalo utilizando la versión de Python compatible con el proyecto y vuelve a instalar las dependencias.

## Configuración

1. Revisar `app/config.py`.
2. Configurar la conexión a la base de datos mediante el mecanismo que utiliza el proyecto.
3. Configurar una clave JWT segura para el entorno local.
4. No publicar contraseñas ni claves secretas en Git.
5. Confirmar que la base de datos esté disponible.

No sobrescribir la configuración actual sin verificar qué variables utiliza la aplicación.

## Validar migraciones

```powershell
flask db current
flask db check
```

Si existen cambios de esquema pendientes, revisarlos antes de generar o aplicar migraciones.

## Ejecutar pruebas

```powershell
python -m pytest -q
```

## Revisar rutas registradas

```powershell
flask routes
```

## Ejecutar el servidor

Utilizar el comando de arranque que ya tenga configurado el proyecto. Confirmar el puerto de escucha y actualizar `base_url` en Postman.

## Resultado esperado

- Aplicación iniciada sin errores.
- Conexión a la base de datos funcional.
- Migraciones verificadas.
- Pruebas automatizadas aprobadas.
- Rutas esperadas registradas.
- Health check accesible.
