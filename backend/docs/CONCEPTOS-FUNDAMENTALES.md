# Conceptos fundamentales del backend de FilaCero

Esta guía explica los conceptos que aplica la API. Cada uno lleva un ejemplo real del código, para que cualquier integrante del equipo pueda sustentarlo.

## 1. App factory (`crear_app`)

La aplicación no se crea al importar el módulo. La crea una función, `app/__init__.py::crear_app(test_config=None)`. Así:

- las pruebas crean una app nueva con SQLite en memoria (`tests/conftest.py`);
- `app.py` (desarrollo), `wsgi.py` (producción) y `simulacion.py` reutilizan la misma fábrica;
- las extensiones (`db`, `migrate`, `jwt`) se crean una sola vez y se conectan dentro de la fábrica.

## 2. Monolito modular por dominios

Hay un solo programa, dividido en dominios con límites claros: `usuarios`, `sedes`, `tramites`, `franjas`, `turnos`, `agentes` y `auditoria`. Cada uno registra su **Blueprint** con un prefijo (`/api/v1/sedes`). La justificación está en el ADR-0001: la carga esperada es de unas 5 peticiones por segundo y el cupo exige transacciones consistentes, así que separar en microservicios no aporta.

## 3. Capas dentro de cada dominio

| Capa | Pregunta que responde | No debe |
|---|---|---|
| `controladores.py` | ¿Qué llega por HTTP y qué se responde? | Contener reglas de negocio |
| `dtos.py` | ¿Los datos tienen la forma correcta? ¿Qué se muestra al público? | Consultar la base de datos |
| `servicios.py` | ¿Se cumple la regla de negocio? | Conocer códigos HTTP |
| `repositorios.py` | ¿Cómo se consulta o guarda? | Decidir reglas |
| `modelos.py` | ¿Cómo es la tabla? | Saber de HTTP |

Ejemplo: `turno_publico_response` (DTO) enmascara el celular (`315****811`) antes de responder.

## 4. Excepciones de dominio y manejador global

Los servicios lanzan errores con nombre de negocio y sin pensar en HTTP:

```python
if _nombre_duplicado(nombre):
    raise SedeDuplicadaError("Ya existe una sede con ese nombre.")   # ConflictoError → 409
```

`app/errores.py` registra **un** `errorhandler(ErrorDeDominio)` que traduce cualquier subclase a su código HTTP y al formato `{"success": false, "error": "..."}`. Los controladores quedan cortos y el código de cada error se define una sola vez.

## 5. Autenticación con JWT y versión de sesión

- `POST /usuarios/login` entrega un JWT de 60 minutos con los claims `sub` (id), `rol` y `ver` (versión de sesión).
- En cada petición se vuelve a leer al usuario de la BD (`user_lookup_loader`). Si está inactivo o si `ver` ya no coincide, la respuesta es 401.
- Cambiar la contraseña, cambiar el rol, desactivar la cuenta o cerrar sesión sube `version_sesion`, y los tokens anteriores dejan de servir **en la siguiente petición** (ADR-0007).

## 6. Autorización por rol (`requiere_rol`)

```python
@admin_bp.post("/")
@requiere_rol("ADMIN")          # SUPERVISOR y AGENTE → 403
def crear(): ...
```

El decorador compara el rol **actual de la BD**, no el que venía en el token. Por eso un asesor degradado pierde el acceso al instante. Ocultar botones en el frontend no es seguridad: la decisión real está aquí.

## 7. Defensa contra fuerza bruta

- Límite de peticiones por IP y por minuto (`@limitar("LIMITE_LOGIN_POR_MINUTO")`).
- Cuenta bloqueada 15 minutos tras 5 fallos (`CuentaBloqueadaError`, 429).
- Mismo mensaje y tiempo de respuesta parecido si el correo no existe, para no revelar qué cuentas hay.

## 8. Regla de negocio central: cupo por sede

`horario.capacidad_sede = cupos_por_asesor (30 // 10 = 3) × asesores activos`. La misma función la usan la disponibilidad y la reserva, así que una regla existe en un solo lugar (ADR-0002).

## 9. Concurrencia

Dos personas pueden pedir el último cupo al mismo tiempo. La reserva toma un **candado por sede** y, en MySQL, un `SELECT … FOR UPDATE` sobre la sede. Luego vuelve a contar y solo entonces inserta (ADR-0004). Lo comprueban `test_reservas_concurrentes.py` y `simulacion.py --carga`: con 18 intentos sobre 6 cupos se aceptan 6.

## 10. Despacho EDF

`agentes/despacho.py` ordena la cola por el **fin de la franja** (*Earliest Deadline First*), estima la duración con una regresión lineal sobre el historial y recomienda la siguiente acción: llamar, iniciar, finalizar, marcar ausente a los 3 minutos, adelantar o hacer una pausa activa (ADR-0003).

## 11. Migraciones

Alembic versiona el esquema. Hay 8 migraciones en cadena; la última, `e5a7c9d1f3b4`, agrega `version_sesion`. Nunca se edita una migración ya aplicada: se crea una nueva.

## 12. Configuración por entorno

`config.py` lee el `.env`. `validar_configuracion` impide arrancar en producción con claves débiles, con el modo de prueba de OTP activo o con orígenes CORS abiertos. Ninguna contraseña real vive en el código.

## 13. Pruebas

- `pytest.ini` define `testpaths = tests` y `pythonpath = .`.
- `conftest.py` ofrece fixtures (`client`, `crear_personal`, `admin_auth`...).
- Cada prueba usa SQLite en memoria y es independiente del orden.
- La simulación (`simulacion.py`) complementa las pruebas: recorre la app completa como lo harían el ciudadano, el asesor y el administrador.
