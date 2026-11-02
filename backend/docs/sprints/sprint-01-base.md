# Sprint 01 — Base del Proyecto FilaCero

## 1. Información general

**Proyecto:** FilaCero — Gestión inteligente de turnos y tiempos de atención

**Sprint:** 01

**Nombre:** Base del proyecto

**Estado:** Completado.

---

## 2. Objetivo del sprint

Construir la base técnica del backend de FilaCero, estableciendo la estructura inicial del proyecto, el entorno de desarrollo, la configuración de Flask, la conexión con la base de datos y la arquitectura modular que será utilizada durante los siguientes sprints.

El objetivo principal es disponer de una base organizada y ejecutable sobre la cual puedan desarrollarse progresivamente las funcionalidades del sistema.

---

## 3. Contexto

FilaCero busca solucionar problemas relacionados con la concentración de personas y los tiempos de espera en procesos de atención presencial.

La propuesta consiste en permitir que un usuario pueda consultar un trámite, seleccionar una franja disponible y solicitar un turno remoto, evitando que tenga que permanecer físicamente en una fila durante todo el proceso.

Para construir esta solución se decidió utilizar inicialmente un backend desarrollado con Python y Flask, organizado como un monolito modular.

---

## 4. Decisión arquitectónica

Para la primera versión del proyecto se seleccionó una arquitectura de **monolito modular**.

El backend estará compuesto por un único proyecto ejecutable, pero internamente estará dividido en dominios independientes.

La decisión permite mantener una estructura organizada y facilita la evolución progresiva del proyecto sin introducir desde el inicio la complejidad asociada a una arquitectura de microservicios.

### Arquitectura general

```text
Cliente
   |
   v
API REST
   |
   v
Backend Flask
   |
   +----------------------+
   |                      |
   v                      v
Dominios              Servicios
   |                      |
   +----------+-----------+
              |
              v
        Repositorios
              |
              v
          MySQL

##5. Organización por dominios
Se estableció una estructura basada en dominios de negocio

app/
├── dominios/
│   ├── franjas/
│   ├── sedes/
│   ├── tramites/
│   ├── turnos/
│   └── usuarios/
│
├── __init__.py
├── config.py
└── seguridad.py

Los dominios representan conceptos propios del negocio y no simplemente los perfiles de usuario.

Los principales dominios definidos inicialmente son:

Usuarios
Sedes
Trámites
Franjas
Turnos

Posteriormente podrán incorporarse otros dominios, como ventanillas, si el desarrollo del proyecto lo requiere.

6. Estructura interna de los dominios

Cada dominio seguirá una estructura similar:

dominio/
├── controladores.py
├── servicios.py
├── repositorios.py
├── modelos.py
├── dtos.py
└── __init__.py


Responsabilidad de cada componente
controladores.py

Define los endpoints de la API y recibe las solicitudes HTTP.

dtos.py

Define la estructura y validación de los datos recibidos y enviados.

servicios.py

Contiene la lógica de negocio.

repositorios.py

Se encarga de las operaciones relacionadas con la persistencia de información.

modelos.py

Define las entidades y estructuras utilizadas para representar los datos en la base de datos.

7. Flujo de una solicitud

El flujo establecido para las funcionalidades del backend es:

Cliente
   ↓
Controlador
   ↓
DTO
   ↓
Servicio
   ↓
Repositorio
   ↓
Base de datos

La respuesta realiza el recorrido inverso:

Base de datos
   ↓
Repositorio
   ↓
Servicio
   ↓
Controlador
   ↓
JSON
   ↓
Cliente

Esta separación permite evitar que los controladores concentren toda la lógica del sistema.

8. Tecnologías utilizadas

Durante este sprint se estableció la base tecnológica:

Backend
Python
Flask
Persistencia
MySQL
SQLAlchemy
Migraciones
Flask-Migrate
Alembic
Seguridad
Flask-JWT-Extended
Werkzeug
Configuración
python-dotenv
API
Flask-CORS
Pruebas
pytest
9. Entorno virtual

Se creó un entorno virtual independiente para el proyecto:

backend/
└── venv/

El entorno permite mantener las dependencias de FilaCero separadas de otras aplicaciones Python instaladas en el equipo.

Para trabajar en el proyecto se utiliza:

.\venv\Scripts\Activate.ps1
10. Dependencias

Las dependencias principales del proyecto fueron registradas en:

requirements.txt

Entre ellas se encuentran:

Flask
Flask-JWT-Extended
Flask-Migrate
Flask-SQLAlchemy
PyMySQL
Flask-CORS
python-dotenv
marshmallow
pytest
11. Configuración de Flask

Se creó una fábrica de aplicación mediante:

create_app()

Esta función permite crear y configurar la aplicación Flask.

La configuración incluye:

Clave secreta.
Configuración JWT.
Conexión con MySQL.
SQLAlchemy.
Flask-Migrate.
CORS.
Registro de Blueprints.
12. Configuración de base de datos

FilaCero utiliza una instancia independiente de MySQL.

Host: localhost
Puerto: 3307
Base de datos: filacero_db
Usuario: filacero_user

Se utiliza un puerto diferente al utilizado por otros proyectos para evitar compartir la misma instancia de base de datos.

13. Variables de entorno

La información sensible de configuración se maneja mediante variables de entorno.

Se establecieron variables para:

SECRET_KEY
JWT_SECRET_KEY
JWT_EXP_MINUTES

DB_USER
DB_PASSWORD
DB_HOST
DB_PORT
DB_NAME
DB_CHARSET

El archivo .env no debe ser incluido en el repositorio.

Por esta razón se incluye dentro de .gitignore.

14. Archivo .gitignore

Se configuró el repositorio para evitar subir archivos innecesarios o sensibles.

Entre ellos:

venv/
.env
__pycache__/
.pytest_cache/
.vscode/
.idea/

Esto evita versionar credenciales y archivos generados automáticamente.

15. Aplicación principal

Se estableció run.py como punto de entrada para ejecutar el backend.

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)

La aplicación queda disponible inicialmente en:

http://localhost:5000
16. Endpoints iniciales

Se implementaron endpoints básicos para comprobar que la API se encuentra funcionando.

Endpoint principal
GET /

Respuesta:

{
    "proyecto": "FilaCero",
    "mensaje": "API funcionando"
}
Health check
GET /health

Respuesta:

{
    "status": "ok",
    "service": "filacero-api",
    "version": "v1"
}

Este endpoint permite verificar rápidamente el estado básico de la API.

17. Sistema de migraciones

Se configuró Flask-Migrate para controlar la evolución de la estructura de la base de datos.

Se inicializó el sistema de migraciones mediante:

python -m flask --app "app:create_app()" db init

Esto generó la estructura:

migrations/
├── versions/
├── env.py
├── README
└── script.py.mako

Las migraciones permiten registrar los cambios realizados sobre el modelo de datos y aplicarlos de forma controlada.

18. Estructura resultante

Al finalizar el sprint, la estructura principal del backend quedó:

FilaCero/
└── backend/
    ├── app/
    │   ├── dominios/
    │   │   ├── franjas/
    │   │   ├── sedes/
    │   │   ├── tramites/
    │   │   ├── turnos/
    │   │   └── usuarios/
    │   │
    │   ├── __init__.py
    │   ├── config.py
    │   └── seguridad.py
    │
    ├── docs/
    │   └── sprints/
    │
    ├── migrations/
    │   └── versions/
    │
    ├── tests/
    ├── venv/
    ├── .env
    ├── .env.example
    ├── .gitignore
    ├── requirements.txt
    └── run.py
19. Resultado del sprint

Al finalizar el Sprint 01 se obtuvo una base funcional para el desarrollo del backend.

Se cuenta con:

Proyecto Flask configurado.
Entorno virtual independiente.
Dependencias definidas.
Arquitectura modular.
Organización por dominios.
Configuración mediante variables de entorno.
Conexión preparada con MySQL.
Flask-SQLAlchemy configurado.
Flask-Migrate configurado.
JWT preparado para autenticación.
CORS configurado.
Endpoints básicos de prueba.
Estructura inicial para pruebas.
Control de archivos mediante Git.
20. Evidencias

Las principales evidencias del sprint son:

Evidencia 1

Estructura de carpetas del backend.

Evidencia 2

Entorno virtual activo.

Evidencia 3

Aplicación Flask ejecutándose.

Evidencia 4

Respuesta exitosa del endpoint:

GET /health
Evidencia 5

Conexión configurada con la base de datos filacero_db.

Evidencia 6

Inicialización de Flask-Migrate.

21. Cierre

El Sprint 01 establece la infraestructura inicial sobre la cual se desarrollará FilaCero.

La arquitectura permite incorporar progresivamente los diferentes dominios del sistema manteniendo separadas las responsabilidades y evitando acoplar la lógica de negocio directamente a los endpoints.

El proyecto queda preparado para comenzar la implementación de usuarios y seguridad en el siguiente sprint.




## Historias de usuario relacionadas
| ID | Historia | Criterio de aceptación |
|---|---|---|
| HU-01 | Como equipo de desarrollo, queremos una base organizada para mantener el sistema. | La aplicación inicia con configuración centralizada y dominios organizados. |
| HU-02 | Como equipo, queremos persistencia y migraciones controladas. | La conexión y el mecanismo de migraciones funcionan localmente. |
| HU-03 | Como consumidor, quiero una API versionada para integrar módulos. | Las rutas principales quedan registradas bajo el prefijo definido. |
