# Historias de usuario de FilaCero · Evidencia por sprint

Esta carpeta reúne las **10 historias de usuario** con las que se construyó FilaCero. Cada documento recoge la historia (*Como… quiero… para…*), sus criterios de aceptación en formato *Dado / Cuando / Entonces*, las tareas realizadas, las decisiones de arquitectura relacionadas, la **evidencia verificable** (pruebas automáticas, simulación, Postman y capturas) y cómo evolucionó la historia durante el semestre.

**Caso de negocio:** *TecniVisión*, centro de reparación de televisores con 5 sedes, 2 administradores y 8 asesores. Atiende todos los días de 8:00 a 18:00.
**Promesa del producto:** quien reserva una franja de 30 minutos es atendido dentro de esa franja.

## Mapa de historias

| HU | Rol | Historia (resumen) | Sprints | Prioridad | Estado |
|---|---|---|---|---|---|
| [HU-01](HU-01-consultar-oferta-de-atencion.md) | Ciudadano | Consultar sedes, servicios y horarios disponibles | 01 · 03 | Must | ✅ |
| [HU-02](HU-02-reservar-turno-sin-cuenta.md) | Ciudadano | Reservar un turno sin crear cuenta, verificando el celular | 05 | Must | ✅ |
| [HU-03](HU-03-consultar-y-cancelar-turno.md) | Ciudadano | Consultar el estado y cancelar el turno con código + celular | 05 | Must | ✅ |
| [HU-04](HU-04-atencion-garantizada-en-la-franja.md) | Ciudadano | Ser atendido dentro de la franja reservada (cupo por sede, cero sobrecupo) | 09 | Must | ✅ |
| [HU-05](HU-05-consola-de-atencion-del-asesor.md) | Asesor | Llamar, iniciar, finalizar y marcar ausencias desde una consola | 06 | Must | ✅ |
| [HU-06](HU-06-asistente-de-despacho.md) | Asesor | Recibir recomendaciones de a quién llamar, cuándo pausar y alertas de tiempo | 09 | Should | ✅ |
| [HU-07](HU-07-gestion-de-sedes-tramites-y-asesores.md) | Administrador | Gestionar sedes, trámites y asesores con edición en ventanas emergentes | 04 · 07 | Must | ✅ |
| [HU-08](HU-08-supervision-en-vivo-e-historial.md) | Admin / Supervisor | Supervisar la operación en vivo, sin recargar, y consultar el historial | 07 | Must | ✅ |
| [HU-09](HU-09-usuarios-permisos-y-seguridad.md) | Administrador | Gestionar cuentas, roles y permisos, con acceso seguro y bitácora | 02 · 10 · 12 | Must | ✅ |
| [HU-10](HU-10-accesibilidad-y-pantalla-de-sala.md) | Ciudadano / Sala | Usar FilaCero con baja visión o lector de pantalla y oír los llamados en la sala | 11 | Should | ✅ |

## Cronología de sprints

| Sprint | Enfoque | Historias |
|---|---|---|
| 01 | Base técnica: factory de Flask, configuración, MySQL, migraciones | HU-01 (cimientos) |
| 02 | Usuarios, contraseñas con hash, JWT y roles | HU-09 (primera versión) |
| 03 | Modelo de negocio: sedes, trámites, franjas y turnos | HU-01 |
| 04 | Administración del catálogo | HU-07 |
| 05 | Portal del ciudadano: reserva, consulta y cancelación | HU-02, HU-03 |
| 06 | Asesores y ciclo de atención | HU-05 |
| 07 | Supervisión: métricas, historial y panel en vivo | HU-07, HU-08 |
| 08 | Documentación y colección Postman | Transversal |
| 09 | Regla de puntualidad: cupo por sede y despacho EDF | HU-04, HU-06 |
| 10 | Usuarios y permisos, bloqueo de cuenta, revocación, bitácora | HU-09 |
| 11 | Accesibilidad WCAG 2.2 AA y pantalla de sala con voz | HU-10 |
| 12 | Arquitectura alineada con el proyecto de referencia (ADR-0009) | Transversal (HU-09) |

## Cómo verificar toda la evidencia

```powershell
cd backend
python -m pytest -v          # 87 pruebas (94 con test_mejoras_entrega.py)
python simulacion.py         # 50 verificaciones: ciudadano, asesor, admin, permisos, seguridad
python simulacion.py --cargar --desde 2026-10-25 --hasta 2026-10-30   # datos para la demo
```

Las capturas de cada historia están en [`img/`](img/). Se tomaron de la aplicación real en *localhost*, con los datos de la semana simulada.

## Definición de terminado (aplicada a todas las historias)

- [x] Criterios de aceptación cumplidos y demostrables en la interfaz.
- [x] Reglas de negocio en el backend, no solo en la pantalla.
- [x] Pruebas automáticas que cubren el camino feliz y los errores.
- [x] Respuestas con el contrato uniforme (`success` / `error`) y el código HTTP correcto.
- [x] Pantalla sin errores de accesibilidad (axe-core) y usable a 1366 px.
- [x] Documentación actualizada: README, ADR si hubo una decisión, Postman.
