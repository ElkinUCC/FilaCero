# Catálogo de historias de usuario y matriz de trazabilidad — FilaCero

**Proyecto:** FilaCero | **Versión documental:** 1.0

## Formato
**Como** [actor], **quiero** [funcionalidad], **para** [beneficio].  
Una HU se considera aceptada cuando sus criterios se cumplen y existe evidencia verificable. La descripción no sustituye la prueba funcional.

## Catálogo resumido
| ID | Actor | Historia resumida | Sprint | Módulo |
|---|---|---|---:|---|
| HU-01 | Desarrollo | Base organizada y mantenible | 01 | Arquitectura |
| HU-02 | Desarrollo | Persistencia y migraciones | 01 | BD |
| HU-03 | Consumidor API | API versionada | 01 | API |
| HU-04 | Usuario | Registrarse | 02 | Usuarios |
| HU-05 | Usuario | Iniciar sesión con JWT | 02 | Autenticación |
| HU-06 | Administrador | Permisos según rol | 02 | Seguridad |
| HU-07 | Usuario | Contraseña protegida con hash | 02 | Seguridad |
| HU-08 | Cliente | Consultar sedes | 03 | Sedes |
| HU-09 | Cliente | Consultar trámites | 03 | Trámites |
| HU-10 | Cliente | Consultar disponibilidad | 03 | Franjas |
| HU-11 | Cliente | Reservar turno | 03 | Turnos |
| HU-12 | Cliente | Consultar/cancelar sus turnos | 03 | Turnos |
| HU-13 | Administrador | Administrar sedes | 04 | Sedes |
| HU-14 | Administrador | Administrar trámites | 04 | Trámites |
| HU-15 | Administrador | Configurar franjas | 04 | Franjas |
| HU-16 | Administrador | Proteger operaciones administrativas | 04 | Seguridad |
| HU-17 | Cliente | Reserva guiada | 05 | Frontend |
| HU-18 | Cliente | Verificar celular con OTP | 05 | Verificación |
| HU-19 | Cliente | Obtener código de turno | 05 | Turnos |
| HU-20 | Cliente | Consultar estado de turnos | 05 | Turnos |
| HU-21 | Cliente | Cancelar reserva permitida | 05 | Turnos |
| HU-22 | Agente | Consultar cola de su sede | 06 | Agentes |
| HU-23 | Agente | Llamar siguiente cliente | 06 | Despacho |
| HU-24 | Agente | Iniciar atención | 06 | Atención |
| HU-25 | Agente | Finalizar atención | 06 | Atención |
| HU-26 | Agente | Consultar turno actual | 06 | Agentes |
| HU-27 | Administrador | Listar agentes | 07 | Administración |
| HU-28 | Administrador | Asignar/desasignar sedes | 07 | Agentes |
| HU-29 | Administrador | Consultar métricas generales | 07 | Métricas |
| HU-30 | Administrador | Métricas por sede/trámite | 07 | Métricas |
| HU-31 | Administrador | Historial paginado | 07 | Historial |
| HU-32 | Agente | Consultar turno actual | 07 | Operación |
| HU-33 | Desarrollo | Instalación reproducible | 08 | Documentación |
| HU-34 | Desarrollo | Referencia API | 08 | Documentación |
| HU-35 | Equipo | Colección Postman | 08 | Pruebas API |
| HU-36 | Evaluador | Evidencias verificables | 08 | Calidad |
| HU-37 | Equipo | Decisiones arquitectónicas documentadas | 08 | ADR |
| HU-38 | Cliente | Reserva por pasos | 09 | UX cliente |
| HU-39 | Cliente | Ver horarios disponibles | 09 | Disponibilidad |
| HU-40 | Cliente | Consultar código y estado | 09 | Cliente |
| HU-41 | Agente | Operar cola desde consola web | 09 | Frontend agente |
| HU-42 | Administrador | Gestionar y consultar indicadores | 09 | Frontend admin |
| HU-43 | Todos | Mensajes claros de carga/éxito/error | 09 | UX |
| HU-44 | Desarrollo | Ejecutar pruebas automatizadas | 10 | Calidad |
| HU-45 | Administrador | Datos ficticios de demostración | 10 | Demo |
| HU-46 | Evaluador | Comprobar recorrido completo | 10 | Integración |
| HU-47 | Equipo | Justificar arquitectura | 10 | Arquitectura |
| HU-48 | Equipo | Instalar y ejecutar reproduciblemente | 10 | Operación |
| HU-49 | Evaluador | Matriz de trazabilidad | 10 | Calidad |

## Trazabilidad por módulo
| Módulo | HU | Evidencia sugerida |
|---|---|---|
| Arquitectura base | HU-01–03 | Estructura, configuración y arranque |
| Usuarios y seguridad | HU-04–07, HU-16 | Registro/login, JWT, pruebas 401/403 |
| Sedes y trámites | HU-08, HU-09, HU-13, HU-14 | API y panel administrativo |
| Franjas y turnos | HU-10–12, HU-15, HU-17–21, HU-39–40 | Reserva de extremo a extremo |
| Atención | HU-22–26, HU-32, HU-41 | Cola, llamado, inicio y fin |
| Administración | HU-27–31, HU-42 | Agentes, métricas e historial |
| Documentación/calidad | HU-33–37, HU-44, HU-47–49 | README, ADR, Postman y pruebas |
| Integración/demo | HU-38, HU-43, HU-45–46 | Demostración de los tres roles |

## Reglas de entrega
- No asignar una HU a una función inexistente.
- Adjuntar evidencia a cada HU crítica.
- Diferenciar implementada, validada y pendiente de evidencia.
- Las pruebas unitarias no sustituyen una demostración end-to-end.
- No incluir credenciales, tokens ni datos personales reales.
