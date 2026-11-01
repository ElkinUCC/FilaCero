# ADR-0005 · Actualización en "tiempo real" por consulta periódica

- **Estado:** Aceptada
- **RAR / atributos:** RAR-04 · usabilidad, simplicidad operativa

## Contexto
La consola del asesor, el panel y la pantalla de sala deben reflejar cambios en pocos segundos. Se eliminaron los botones de "Actualizar".

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Consulta periódica** (elegida): consola 5 s, sala 4 s, panel 15 s, consulta ciudadana 20 s | Sin estado de conexión; funciona detrás de cualquier proxy; fácil de probar | Tráfico aunque no haya cambios; latencia hasta el siguiente ciclo |
| WebSockets | Instantáneo | Conexiones persistentes, otro servidor (no WSGI), más puntos de fallo |
| Server-Sent Events | Más simple que WebSockets | También requiere servidor asíncrono y manejo de reconexión |

## Decisión
Hook `usePolling` en el frontend: consulta periódica, pausa cuando la pestaña no está visible y refresca al volver.

## Consecuencias
- ➕ Carga esperada ≈ 5 pet./s, muy por debajo de lo medido (≈ 139 pet./s).
- ➖ Un aviso puede tardar hasta 5 s en aparecer en la consola.
- **Revisar si:** el número de pantallas crece a cientos o se exige latencia < 1 s.
