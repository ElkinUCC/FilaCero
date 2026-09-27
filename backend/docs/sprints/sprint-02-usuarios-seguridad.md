# 🔐 SPRINT 02 — USUARIOS Y SEGURIDAD

## 1. Información general

**Proyecto:** FilaCero — Gestión inteligente de turnos y tiempos de atención

**Sprint:** 02

**Nombre:** Usuarios y Seguridad

**Estado:** Completado

---

## 2. Objetivo

Implementar el módulo de usuarios de FilaCero y establecer la primera capa de autenticación y seguridad del backend.

El sprint permite registrar usuarios, autenticar sus credenciales y generar tokens de acceso mediante JWT.

Además, se establece la estructura inicial para trabajar posteriormente con los diferentes roles definidos para el sistema.

---

## 3. Roles del sistema

FilaCero contempla inicialmente tres perfiles:

```text
CLIENTE
AGENTE
ADMIN
CLIENTE

Es el usuario que utiliza la plataforma para consultar información y solicitar turnos.

Entre sus responsabilidades futuras estarán:

Consultar sedes.
Consultar trámites.
Consultar franjas disponibles.
Solicitar turnos.
Consultar el estado de sus turnos.
Consultar historial.
Cancelar turnos cuando corresponda.
AGENTE

Es el perfil operativo encargado de gestionar la atención de los turnos.

Sus funcionalidades futuras estarán relacionadas con:

Consultar la cola de atención.
Llamar el siguiente turno.
Atender turnos.
Marcar inasistencias.
Pasar turnos.
Consultar el historial de atención.
ADMIN

Es el perfil encargado de la administración general de la plataforma.

Sus funcionalidades futuras estarán relacionadas con:

Gestionar sedes.
Gestionar trámites.
Gestionar franjas horarias.
Gestionar agentes.
Gestionar ventanillas.
Consultar información general.
Consultar métricas y reportes.
4. Módulo de usuarios

El módulo se encuentra dentro de:

app/
└── dominios/
    └── usuarios/

Su estructura es:

usuarios/
├── controladores.py
├── servicios.py
├── repositorios.py
├── modelos.py
├── dtos.py
└── __init__.py
5. Modelo de usuario

La entidad Usuario representa a las personas que utilizan el sistema.

La tabla asociada es:

usuarios

Sus principales atributos son:

id
nombre
correo
password_hash
rol
activo
fecha_creacion
Descripción
Campo	Función
id	Identificador único
nombre	Nombre del usuario
correo	Correo utilizado para autenticación
password_hash	Contraseña protegida
rol	Perfil dentro del sistema
activo	Estado del usuario
fecha_creacion	Fecha de creación
6. Persistencia

La información de usuarios se almacena en:

Base de datos: filacero_db
Tabla: usuarios

La conexión se realiza utilizando:

SQLAlchemy
PyMySQL
MySQL
7. Registro de usuarios

Se implementó el endpoint:

POST /api/v1/usuarios/registro

Este endpoint recibe:

{
    "nombre": "Elkin",
    "correo": "elkin@filacero.com",
    "password": "12345678"
}

El sistema realiza las siguientes operaciones:

Solicitud
   ↓
Validación DTO
   ↓
Verificación de correo
   ↓
Hash de contraseña
   ↓
Creación del usuario
   ↓
Repositorio
   ↓
Base de datos

El usuario registrado públicamente recibe inicialmente el rol:

CLIENTE
8. Validación del correo

Antes de crear un usuario se verifica que el correo no se encuentre registrado previamente.

Si existe un usuario con el mismo correo, el sistema devuelve un error indicando que el correo ya está registrado.

Esto evita duplicar usuarios dentro del sistema.

9. Protección de contraseñas

Las contraseñas no se almacenan directamente en la base de datos.

Se utiliza:

generate_password_hash()

para generar un hash seguro.

Durante el login se utiliza:

check_password_hash()

para verificar la contraseña introducida.

El sistema almacena únicamente:

password_hash

y nunca la contraseña original.

10. Inicio de sesión

Se implementó:

POST /api/v1/usuarios/login

Solicitud:

{
    "correo": "elkin@filacero.com",
    "password": "12345678"
}

El sistema realiza:

Solicitud
   ↓
Validación de datos
   ↓
Búsqueda del usuario
   ↓
Validación de estado
   ↓
Verificación de contraseña
   ↓
Generación JWT
   ↓
Respuesta
11. JWT

Después de una autenticación exitosa, el backend genera un:

JSON Web Token

El token permite identificar al usuario en las solicitudes posteriores que requieran autenticación.

El token contiene la identidad del usuario y su rol.

Ejemplo conceptual:

Usuario
   ↓
Login correcto
   ↓
JWT
   ↓
Solicitudes protegidas
12. Control de acceso

Se creó una estructura de seguridad para proteger endpoints mediante JWT.

También se estableció la posibilidad de restringir determinadas operaciones según el rol.

La estructura contempla:

requiere_token()

para verificar autenticación.

Y:

requiere_rol()

para verificar autorización según el rol del usuario.

Esto permitirá aplicar posteriormente reglas como:

CLIENTE → funcionalidades de cliente
AGENTE  → funcionalidades operativas
ADMIN   → funcionalidades administrativas
13. DTOs y validación

Se implementaron esquemas para validar la información recibida.

Registro

Se valida:

Nombre obligatorio.
Longitud del nombre.
Correo válido.
Contraseña obligatoria.
Longitud mínima de la contraseña.
Login

Se valida:

Correo obligatorio.
Formato correcto del correo.
Contraseña obligatoria.

La validación se realiza antes de ejecutar la lógica de negocio.

14. Capa de servicios

La lógica de negocio relacionada con usuarios se encuentra en:

servicios.py

Se implementaron operaciones principales para:

registrar_usuario()
iniciar_sesion()

Esta capa evita colocar la lógica de negocio directamente en los controladores.

15. Capa de repositorios

La persistencia se concentra en:

repositorios.py

Se implementaron operaciones para:

buscar_por_correo()
buscar_por_id()
guardar()

Esto mantiene separadas las operaciones de acceso a datos de la lógica de negocio.

16. Migración de base de datos

Después de implementar el modelo Usuario, se generó la migración mediante:

python -m flask --app "app:create_app()" db migrate -m "Crear usuarios"

Posteriormente se aplicó mediante:

python -m flask --app "app:create_app()" db upgrade

La migración creó la estructura necesaria para almacenar los usuarios.

17. Tabla de usuarios

La tabla creada es:

usuarios

La estructura conceptual es:

usuarios
│
├── id
├── nombre
├── correo
├── password_hash
├── rol
├── activo
└── fecha_creacion

Además, el correo se definió como único para evitar registros duplicados.

18. Pruebas realizadas

Se realizaron pruebas funcionales directamente contra la API.

Prueba 1 — Registro

Endpoint:

POST /api/v1/usuarios/registro

Se registró un usuario de prueba:

Nombre: Elkin
Correo: elkin@filacero.com

Resultado:

Usuario registrado correctamente
Prueba 2 — Login

Endpoint:

POST /api/v1/usuarios/login

Se utilizaron las credenciales del usuario registrado.

Resultado:

Inicio de sesión exitoso

La respuesta incluyó un:

access_token

correspondiente al JWT generado por el backend.

Prueba 3 — Base de datos

Se verificó directamente la tabla:

filacero_db.usuarios

Se confirmó la persistencia del usuario registrado.

También se verificó que la contraseña no se almacena como texto plano, sino mediante password_hash.

19. Arquitectura del módulo

El flujo completo implementado es:

                 HTTP
                  │
                  ▼
          ┌───────────────┐
          │ Controlador   │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │     DTO       │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │   Servicio    │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │  Repositorio  │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │    MySQL      │
          └───────────────┘
20. Seguridad implementada

Al finalizar el sprint se cuenta con:

Hash de contraseñas.
Validación de credenciales.
Validación de usuario activo.
JWT.
Identificación del usuario mediante token.
Claims asociados al rol.
Estructura para autorización por roles.
Variables sensibles fuera del código fuente mediante .env.
21. Evidencias

Las evidencias del sprint corresponden a:

Evidencia 1

Migración generada correctamente.

Crear usuarios
Evidencia 2

Migración aplicada mediante:

db upgrade
Evidencia 3

Usuario registrado exitosamente mediante la API.

Evidencia 4

Inicio de sesión exitoso.

Evidencia 5

Generación del access_token.

Evidencia 6

Usuario almacenado en la tabla:

filacero_db.usuarios
22. Resultado del Sprint

El Sprint 02 permitió implementar la primera funcionalidad de negocio real del backend.

FilaCero cuenta actualmente con un módulo de usuarios funcional que permite:

Registro
   ↓
Persistencia
   ↓
Autenticación
   ↓
Generación de JWT
   ↓
Preparación para autorización por roles

La base de seguridad queda preparada para que los siguientes módulos puedan utilizar autenticación y autorización.

23. Estado actual del proyecto

Al finalizar los dos primeros sprints:

Sprint 01
BASE DEL PROYECTO
        ↓
Arquitectura
Configuración
Base de datos
Migraciones
API Flask
Sprint 02
USUARIOS Y SEGURIDAD
        ↓
Registro
Login
Hash
JWT
Roles
24. Próximo sprint

El siguiente sprint se enfocará en comenzar la implementación del modelo de negocio principal de FilaCero.

Se trabajará progresivamente con:

Sedes
Trámites
Franjas
Turnos

La implementación de estos dominios permitirá comenzar a construir el flujo principal de solicitud y gestión de turnos.


---

# 🏁 Estado del proyecto al cerrar hoy

Así queda nuestra hoja de ruta:

```text
SPRINT 01 ─── BASE DEL PROYECTO
     │
     │ ✅ COMPLETADO
     ▼
SPRINT 02 ─── USUARIOS Y SEGURIDAD
     │
     │ ✅ COMPLETADO
     ▼
SPRINT 03 ─── MODELO DE NEGOCIO
     │
     │ ⏳ SIGUIENTE
     ▼
SPRINT 04 ─── ADMIN
     │
     ▼
SPRINT 05 ─── CLIENTE
     │
     ▼
SPRINT 06 ─── AGENTE
     │
     ▼
SPRINT 07 ─── TIEMPOS / INTELIGENCIA
     │
     ▼
SPRINT 08 ─── MÉTRICAS
     │
     ▼
SPRINT 09 ─── CALIDAD Y SEGURIDAD
     │
     ▼
SPRINT 10 ─── INTEGRACIÓN Y ENTREGA