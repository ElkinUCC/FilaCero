# FilaCero

**Proyecto final — Arquitectura de Software y Computacional**

Sistema de gestión inteligente de turnos y tiempos de atención presencial.

---

## 1. Descripción del proyecto

FilaCero es una plataforma orientada a mejorar la gestión de turnos en procesos de atención presencial. Su propósito es reducir los tiempos de espera, organizar la demanda de los servicios y facilitar la administración de las solicitudes de atención.

La plataforma busca permitir que los usuarios consulten trámites, seleccionen opciones de atención y soliciten turnos sin necesidad de permanecer físicamente en una fila durante todo el proceso.

El sistema contempla funcionalidades para clientes, agentes de atención y administradores, con una evolución progresiva hacia la medición de tiempos y el análisis de información operativa.

## 2. Objetivos

### Objetivo general

Diseñar y desarrollar una plataforma modular para gestionar turnos de atención presencial, aplicando principios de arquitectura de software, separación de responsabilidades, seguridad y persistencia de datos.

### Objetivos específicos

- Implementar una API REST utilizando Python y Flask.
- Organizar el backend mediante una arquitectura de monolito modular.
- Gestionar usuarios y autenticación mediante JSON Web Tokens (JWT).
- Modelar sedes, trámites, franjas horarias y turnos.
- Persistir la información utilizando MySQL y SQLAlchemy.
- Controlar los cambios en la estructura de la base de datos mediante migraciones.
- Incorporar pruebas automatizadas y validaciones de seguridad.
- Preparar la plataforma para futuras funcionalidades administrativas, operativas y analíticas.

## 3. Arquitectura del sistema

FilaCero utiliza una arquitectura de **monolito modular**.

El backend se ejecuta como una única aplicación, organizada internamente en dominios de negocio independientes. Esta decisión permite separar responsabilidades, facilitar el mantenimiento y reducir la complejidad inicial frente a una arquitectura distribuida de microservicios.

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
   +-----------------------+
   |                       |
   v                       v
Dominios de negocio    Seguridad
   |                       |
   +-----------+-----------+
               |
               v
        Servicios de negocio
               |
               v
          Repositorios
               |
               v
             MySQL
```

### Flujo de una solicitud

```text
Solicitud HTTP
      |
      v
Controlador
      |
      v
Validación de datos (DTO)
      |
      v
Servicio de negocio
      |
      v
Repositorio
      |
      v
Base de datos
      |
      v
Respuesta JSON
```

Cada componente tiene una responsabilidad definida para evitar concentrar toda la lógica en los controladores.

## 4. Tecnologías utilizadas

| Tecnología | Propósito |
|---|---|
| Python | Lenguaje de programación del backend |
| Flask | Framework para construir la API REST |
| Flask-SQLAlchemy | Integración del ORM con Flask |
| SQLAlchemy | Modelado y acceso a datos |
| MySQL | Sistema gestor de base de datos |
| PyMySQL | Conector entre Python y MySQL |
| Flask-Migrate | Administración de migraciones |
| Alembic | Control de versiones del esquema de datos |
| Flask-JWT-Extended | Autenticación mediante JWT |
| Werkzeug | Utilidades de seguridad, incluido el hash de contraseñas |
| Marshmallow | Validación y serialización de datos |
| Flask-CORS | Configuración de acceso entre orígenes |
| python-dotenv | Lectura de variables de entorno |
| pytest | Pruebas automatizadas |

## 5. Dominios del sistema

El backend se organiza por dominios de negocio.

| Dominio | Responsabilidad |
|---|---|
| Usuarios | Registro, autenticación y gestión de identidad |
| Sedes o puntos de atención | Representación de los lugares donde se presta el servicio |
| Trámites | Definición de los servicios disponibles |
| Franjas horarias | Organización de los horarios y la disponibilidad |
| Turnos | Registro y seguimiento de las solicitudes de atención |

La implementación de los dominios se realizará progresivamente durante los diferentes sprints.

## 6. Roles del sistema

FilaCero contempla tres perfiles principales:

- **CLIENTE:** consulta la oferta de servicios, solicita turnos y consulta su estado e historial.
- **AGENTE:** gestiona la cola de atención, llama turnos y registra los resultados de la atención.
- **ADMIN:** administra sedes, trámites, horarios, agentes y parámetros generales del sistema.

Las funcionalidades de cada rol se incorporarán progresivamente, aplicando autenticación y autorización según corresponda.

## 7. Estructura del proyecto

La estructura principal del backend es la siguiente:

```text
FilaCero/
├── README.md
└── backend/
    ├── app/
    │   ├── dominios/
    │   │   ├── usuarios/
    │   │   │   ├── controladores.py
    │   │   │   ├── servicios.py
    │   │   │   ├── repositorios.py
    │   │   │   ├── modelos.py
    │   │   │   ├── dtos.py
    │   │   │   └── __init__.py
    │   │   ├── sedes/
    │   │   ├── tramites/
    │   │   └── turnos/
    │   ├── __init__.py
    │   ├── config.py
    │   └── seguridad.py
    ├── migrations/
    │   └── versions/
    ├── tests/
    ├── venv/
    ├── .env
    ├── .env.example
    ├── .gitignore
    ├── requirements.txt
    └── run.py
```

> Nota: la estructura anterior es ilustrativa. Los dominios existentes se encuentran bajo `app/dominios/`, y la estructura de carpetas puede evolucionar durante el desarrollo.

### Responsabilidades de los componentes

- `controladores.py`: recibe solicitudes HTTP y construye las respuestas de la API.
- `dtos.py`: valida y estructura los datos de entrada y salida.
- `servicios.py`: implementa las reglas de negocio.
- `repositorios.py`: concentra las operaciones de acceso a datos.
- `modelos.py`: define las entidades y su correspondencia con las tablas.
- `config.py`: centraliza la configuración de la aplicación.
- `seguridad.py`: reúne los componentes de seguridad.
- `migrations/`: conserva el historial de cambios del esquema de la base de datos.
- `run.py`: permite iniciar el backend.

## 8. Configuración del entorno de desarrollo

### Requisitos

- Python instalado.
- MySQL Server instalado.
- Git.
- PowerShell en Windows.

### Clonar o abrir el proyecto

Desde una terminal, ingresar a la carpeta del proyecto:

```powershell
cd FilaCero/backend
```

### Crear el entorno virtual

Si todavía no existe:

```powershell
python -m venv venv
```

### Activar el entorno virtual en PowerShell

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

La terminal debe mostrar `(venv)`.

### Instalar las dependencias

```powershell
python -m pip install -r requirements.txt
```

## 9. Configuración de la base de datos

FilaCero utiliza MySQL como sistema de persistencia.

Configuración prevista para el entorno local:

| Parámetro | Valor |
|---|---|
| Host | `localhost` |
| Puerto | `3307` |
| Base de datos | `filacero_db` |
| Usuario | `filacero_user` |

Los valores deben coincidir con la configuración real de MySQL y las variables definidas en el archivo `.env`.

### Variables de entorno

El proyecto contempla variables como:

```dotenv
SECRET_KEY=
JWT_SECRET_KEY=
JWT_EXP_MINUTES=

DB_HOST=localhost
DB_PORT=3307
DB_NAME=filacero_db
DB_USER=filacero_user
DB_PASSWORD=
DB_CHARSET=utf8mb4
```

Los valores sensibles deben configurarse localmente. No se deben publicar contraseñas ni claves secretas en el repositorio.

El archivo `.env.example` debe contener únicamente valores ilustrativos, sin credenciales reales.

## 10. Ejecución del backend

Con el entorno virtual activo y las dependencias instaladas, ingresar a `backend` y ejecutar:

```powershell
python run.py
```

La aplicación está configurada para utilizar inicialmente el puerto `5000`.

Dirección local:

http://localhost:5000

## 11. Endpoints disponibles actualmente

### Estado básico de la API

| Método | Endpoint | Propósito |
|---|---|---|
| GET | `/` | Información básica del proyecto |
| GET | `/health` | Comprobación del estado de la API |

### Usuarios

| Método | Endpoint | Propósito |
|---|---|---|
| POST | `/api/v1/usuarios/registro` | Registro de usuarios |
| POST | `/api/v1/usuarios/login` | Autenticación e inicio de sesión |

### Ejemplo de registro

```json
{
  "nombre": "Usuario de prueba",
  "correo": "usuario@ejemplo.com",
  "password": "contraseña-de-prueba"
}
```

### Ejemplo de inicio de sesión

```json
{
  "correo": "usuario@ejemplo.com",
  "password": "contraseña-de-prueba"
}
```

El inicio de sesión está diseñado para devolver un token de acceso JWT cuando las credenciales son válidas.

Los ejemplos son ilustrativos; las respuestas definitivas dependen de la implementación de los controladores.

## 12. Seguridad

Las decisiones de seguridad del proyecto incluyen:

- Almacenamiento de contraseñas mediante hashes, no en texto plano.
- Validación de las credenciales durante el inicio de sesión.
- Uso de JWT para identificar usuarios autenticados.
- Definición de roles para el control de acceso.
- Gestión de secretos mediante variables de entorno.
- Exclusión de archivos sensibles y generados del control de versiones.

La autorización por roles y la protección de los diferentes dominios deberán verificarse a medida que se implementen nuevas funcionalidades.

## 13. Migraciones de base de datos

El proyecto utiliza Flask-Migrate y Alembic para administrar los cambios en el esquema de datos.

Consultar el estado actual:

```powershell
python -m flask --app "app:create_app()" db current
```

Consultar el historial:

```powershell
python -m flask --app "app:create_app()" db history
```

Generar una migración después de modificar los modelos:

```powershell
python -m flask --app "app:create_app()" db migrate -m "Descripcion del cambio"
```

Aplicar las migraciones revisadas:

```powershell
python -m flask --app "app:create_app()" db upgrade
```

Las migraciones generadas deben revisarse antes de aplicarse. No se deben borrar ni recrear tablas existentes sin evaluar las consecuencias sobre los datos.

## 14. Pruebas y validación

El proyecto utiliza pytest para las pruebas automatizadas.

Ejecutar las pruebas:

```powershell
python -m pytest -v
```

La validación debe cubrir progresivamente:

- Disponibilidad de la API.
- Registro e inicio de sesión.
- Validación de datos.
- Persistencia en MySQL.
- Relaciones entre entidades.
- Solicitud y seguimiento de turnos.
- Reglas de disponibilidad.
- Seguridad y permisos por rol.

Las pruebas automatizadas deben incorporarse a medida que se implementen los módulos.

## 15. Plan de desarrollo por sprints

| Sprint | Objetivo | Estado |
|---|---|---|
| 01 | Base del proyecto y arquitectura | Completado según la documentación |
| 02 | Usuarios y seguridad | Completado según la documentación |
| 03 | Modelo de negocio: sedes, trámites, franjas y turnos | En desarrollo |
| 04 | Funcionalidades administrativas | Planificado |
| 05 | Funcionalidades del cliente | Planificado |
| 06 | Operación de los agentes | Planificado |
| 07 | Tiempos e inteligencia operativa | Planificado |
| 08 | Métricas y reportes | Planificado |
| 09 | Calidad y seguridad | Planificado |
| 10 | Integración y entrega | Planificado |

Los estados de los sprints posteriores se actualizarán conforme se implementen y validen sus funcionalidades.

## 16. Estado actual del proyecto

Al momento de esta documentación:

- La aplicación Flask puede iniciarse mediante su fábrica de aplicación.
- Los endpoints `/` y `/health` responden correctamente.
- Los endpoints de registro e inicio de sesión están registrados.
- La configuración de SQLAlchemy y Flask-Migrate permite consultar MySQL.
- La revisión de Alembic correspondiente a usuarios está identificada como la revisión actual.
- La base de datos inspeccionada contiene las tablas `usuarios` y `alembic_version`.
- Los archivos de modelos para puntos de atención, trámites y turnos están presentes.
- La integración completa de los dominios de negocio y las pruebas automatizadas está pendiente de validación y desarrollo.

## 17. Próximos pasos

El siguiente objetivo es completar el Sprint 03 mediante:

1. Validación de los modelos existentes.
2. Definición del dominio de franjas horarias.
3. Revisión de las relaciones y restricciones entre entidades.
4. Registro de los modelos y controladores en la aplicación.
5. Generación y revisión de migraciones.
6. Implementación y prueba de los endpoints de negocio.
7. Validación del flujo de solicitud de turnos.
8. Actualización de la documentación y las evidencias del sprint.

## 18. Autoría académica

**Proyecto:** FilaCero  
**Tipo:** Proyecto final académico  
**Área:** Arquitectura de Software y Computacional

Este documento se actualizará a medida que evolucione la arquitectura y se completen los diferentes sprints.
