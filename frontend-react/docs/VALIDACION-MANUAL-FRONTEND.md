# Validación manual del frontend

Con el backend en `:5000` (datos de `simulacion.py --cargar`) y `npm run dev` en `:5173`.

## 1. Portal del ciudadano (`/`)

| # | Acción | Esperado | ✓ |
|---|---|---|---|
| 1.1 | Abrir `/` | Una sola pantalla sin scroll en el portátil; horario "Todos los días, 08:00 a 18:00" | |
| 1.2 | Elegir sede y servicio | Se cargan las horas sin botón; cada una muestra sus cupos | |
| 1.3 | Escribir el celular → Verificar | Aparece el código de prueba; al escribirlo queda "Verificado" | |
| 1.4 | Confirmar turno | Código grande `XXXXXX`; la ficha de la izquierda se completa | |
| 1.5 | Ver estado → Escuchar | Personas antes, espera estimada; lectura en voz alta | |
| 1.6 | Cancelar turno | Estado "Cancelado" | |

## 2. Rutas y guardas

| # | Acción | Esperado | ✓ |
|---|---|---|---|
| 2.1 | Sin sesión, abrir `/admin/usuarios` | Vuelve a `/?ingresar=1` con el acceso del personal abierto | |
| 2.2 | Abrir `/no-existe` | Página 404 con "Ir a reservar un turno" | |
| 2.3 | Entrar como administrador | Llega a `/admin`; la URL cambia con cada sección | |
| 2.4 | Botón *atrás* del navegador | Vuelve a la sección anterior | |
| 2.5 | Abrir `/admin/xyz` | 404 dentro del panel | |
| 2.6 | Entrar como asesor y abrir `/admin` | 403 "No tienes permiso…"; **la sesión sigue**; "Ir a mi inicio" → `/agente` | |
| 2.7 | Supervisor abre `/admin/usuarios` | 403 dentro del panel; el menú no muestra "Seguridad" | |
| 2.8 | Cuenta con clave temporal | Solo puede ver `/cambiar-clave` hasta cambiarla | |
| 2.9 | Cerrar sesión en otra pestaña | La siguiente consulta devuelve al portal (401) | |

## 3. Panel (`/admin`)

| # | Acción | Esperado | ✓ |
|---|---|---|---|
| 3.1 | Resumen | "En vivo · hora" sin botón de actualizar; sedes ahora y reservas recientes | |
| 3.2 | Sedes → Nueva sede "Sede Centro" | Mensaje "Ya existe una sede con ese nombre." (409) dentro del modal | |
| 3.3 | Editar con el ícono de lápiz | Modal; al guardar, aviso verde | |
| 3.4 | Usuarios → restablecer clave | La clave temporal se muestra una vez, con botón de copiar | |
| 3.5 | Actividad | Aparecen los eventos que acabas de hacer | |

## 4. Consola del asesor (`/agente`)

| # | Acción | Esperado | ✓ |
|---|---|---|---|
| 4.1 | Abrir | Reloj, franja actual, cupo y recomendación del asistente | |
| 4.2 | Llamar siguiente → Iniciar → Finalizar | Avisos "Turno llamado." y luego "Puesto libre" | |
| 4.3 | Reservar desde el portal en otra pestaña | Aviso de turno nuevo en la consola | |

## 5. Sala (`/sala?sede=1`)

| # | Acción | Esperado | ✓ |
|---|---|---|---|
| 5.1 | Llamar un turno desde la consola | La sala muestra el código y, con voz activa, lo anuncia | |
| 5.2 | Revisar los datos | Sin nombres completos ni celulares | |

## 6. Accesibilidad

| # | Acción | Esperado | ✓ |
|---|---|---|---|
| 6.1 | Tab al cargar | El primer foco es "Saltar al contenido" | |
| 6.2 | Accesibilidad → Texto grande / Alto contraste | Cambia toda la interfaz y se recuerda | |
| 6.3 | Desplegables con teclado | Flechas, Enter y Escape funcionan | |
| 6.4 | axe DevTools | 0 violaciones | |
