# Sprint 10 — Pruebas integrales, estabilización y entrega académica

**Proyecto:** FilaCero  
**Asignatura:** Arquitectura de Software y Computacional  
**Estado:** Suite automatizada aprobada en la ejecución compartida; evidencias de demostración y expediente final por consolidar.

## Objetivo
Preparar una versión demostrable y mantenible, verificando integración, reglas de negocio, seguridad, persistencia y documentación necesaria para la entrega académica.

## Historias de usuario
| ID | Actor | Historia | Criterios de aceptación |
|---|---|---|---|
| HU-44 | Desarrollo | Como equipo, queremos ejecutar pruebas automatizadas antes de entregar. | La suite termina sin fallos y se conserva el resultado. |
| HU-45 | Administrador | Como administrador, quiero datos ficticios de demostración. | Los datos representan sedes, agentes, trámites y turnos sin mezclarse con producción. |
| HU-46 | Evaluador | Como evaluador, quiero comprobar el recorrido completo. | Se demuestra consulta, reserva, atención y seguimiento. |
| HU-47 | Equipo | Como equipo, queremos documentar la arquitectura. | Se explican componentes, datos, seguridad y decisiones. |
| HU-48 | Equipo | Como equipo, queremos un procedimiento reproducible de instalación. | Se documentan entorno, dependencias, base de datos, migraciones y arranque. |
| HU-49 | Evaluador | Como evaluador, quiero una matriz de trazabilidad. | Requisitos, HU, módulos y evidencias están relacionados. |

## Arquitectura final
FilaCero conserva una arquitectura de monolito modular:
- **Frontend:** React.
- **Backend:** API REST con Flask.
- **Dominios:** usuarios, sedes, trámites, franjas, turnos y agentes.
- **Persistencia:** SQLAlchemy sobre MySQL.
- **Seguridad:** JWT, hash de contraseñas y autorización por roles.
- **Migraciones:** Flask-Migrate/Alembic.
- **Pruebas:** pytest.

La decisión de monolito modular reduce complejidad operativa para el alcance académico y separa responsabilidades por dominio sin el costo adicional de operar microservicios.

## Evidencia de pruebas automatizadas
En la ejecución local compartida desde Windows, con Python 3.14.3 y pytest 9.1.1, se ejecutó:

```powershell
python -m pytest
```

Resultado observado:

```text
collected 78 items
78 passed in 14.20s
```

La suite incluyó:
- `tests/test_despacho.py`
- `tests/test_franjas_turnos.py`
- `tests/test_mejoras_entrega.py`
- `tests/test_rutas_sprints.py`
- `tests/test_seguridad_y_publico.py`
- `tests/test_usuarios_permisos.py`

Este resultado corresponde a la salida compartida en la conversación. Se recomienda guardar el log original con fecha y commit para la entrega.

## Matriz de pruebas de aceptación
| Flujo | Verificación | Evidencia a conservar |
|---|---|---|
| Cliente | Consultar sede y trámite | Captura o respuesta API |
| Cliente | Consultar disponibilidad | Network y JSON |
| Cliente | Reservar y obtener código | Confirmación y registro |
| Cliente | Consultar/cancelar turno propio | Respuesta API y estado |
| Agente | Consultar cola y llamar siguiente | Captura de consola |
| Agente | Iniciar/finalizar atención | Estado y marcas de tiempo |
| Administrador | Gestionar sedes, trámites y franjas | Capturas de panel/API |
| Administrador | Gestionar agentes e indicadores | Métricas e historial |
| Seguridad | Acceso sin token o rol incorrecto | Respuestas 401/403 |
| Integridad | Capacidad y reservas concurrentes | Pruebas y persistencia |

## Seguridad y operación
- No incluir `.env` con secretos en el repositorio o ZIP.
- Configurar claves JWT seguras por variables de entorno.
- Restringir CORS a orígenes requeridos en despliegue.
- Mantener contraseñas como hashes.
- Aplicar mínimo privilegio por rol.
- No exponer tokens ni datos personales en capturas.
- Utilizar cuentas ficticias y credenciales de demostración controladas.

## Escenario de demostración
El escenario del proyecto contempla cuatro sedes: Centro, Laureles, El Poblado e Itagüí. La configuración inicial describía atención de lunes a viernes; posteriormente se solicitó habilitar todos los días. La configuración final debe coincidir con los días y franjas efectivamente existentes en la base de datos.

Los datos ficticios deben poder identificarse y reiniciarse sin afectar datos reales.

## Criterios de aceptación
- La suite automatizada termina sin fallos en la ejecución registrada.
- Se pueden demostrar los flujos de cliente, agente y administrador.
- La API mantiene autenticación y autorización por rol.
- Las migraciones están aplicadas sin cambios inesperados.
- La documentación coincide con rutas y contratos vigentes.
- Los diagramas explican arquitectura y modelo de datos.
- Las evidencias no contienen secretos.
- Los pendientes conocidos están identificados.

## Entregables de la asignatura
1. Código fuente frontend y backend.
2. Scripts y migraciones de base de datos.
3. README de instalación y ejecución.
4. Catálogo de historias de usuario.
5. Documentación de sprints 01 al 10.
6. Diagrama de arquitectura y componentes.
7. Diagrama entidad-relación.
8. Diagrama de casos de uso o actividades.
9. Plan y evidencias de pruebas.
10. Colección Postman sin credenciales reales.
11. Guion de demostración y conclusiones.

## Limitaciones y trabajo futuro
- Integración con proveedor SMS real si se conserva OTP de prueba.
- Prueba de concurrencia específicamente contra MySQL con solicitudes paralelas.
- Despliegue productivo con HTTPS, monitoreo, respaldos y gestión de secretos.
- Revisión final de accesibilidad y responsive.
- Aplicación y validación del rediseño compacto del flujo si aún no se ha incorporado.

## Resultado
El Sprint 10 consolida la preparación de entrega. La evidencia automatizada compartida registra 78 pruebas aprobadas. La aceptación final debe acompañarse de una demostración de extremo a extremo, documentos y capturas de los flujos principales.
