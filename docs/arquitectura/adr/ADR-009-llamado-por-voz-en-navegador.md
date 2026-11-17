# ADR-009 · Llamado por voz en el navegador del asesor

- **Estado**: Nuevo (entrega final) · **Atributos**: accesibilidad, costo, disponibilidad · **Riesgos**: R-08

## Contexto
El docente pidió que, al presionar "Llamar siguiente", se escuche enseguida una voz y que **cada 20 segundos**
se repita "por favor *turno/nombre*, acercarse a la taquilla/módulo X" mientras la persona no llegue.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| **Web Speech API (`speechSynthesis`) en la consola** | Cero servidores, cero costo, funciona sin internet en Chrome/Edge, inmediato | La calidad de la voz depende del sistema operativo |
| TTS en la nube (Google/Azure/Polly) | Voz natural uniforme | Costo por carácter, latencia de red, credenciales, falla sin internet |
| Audios pregrabados por número | Voz humana | No puede decir nombres; combinatoria inmanejable |
| Anunciar solo desde la TV de sala | Un parlante central | El docente lo pidió en la consola; duplicaría si ambos hablan |

## Decisión
Módulo `src/js/utils/voz.js` de la SPA (usado por la consola del asesor): al pasar el turno a `LLAMADO` anuncia "Turno 1 2 0 4 8 9. *Nombre completo*,
por favor acercarse al Módulo 2" (concordancia "al módulo"/"a la taquilla"), repite cada 20 s, se detiene al
iniciar la atención, devolver o marcar no asistió, y tiene tope de 9 repeticiones (3 min = tiempo máximo de
llegada). Botones **Repetir** y **Silenciar**; preferencia guardada por navegador. La TV de sala solo muestra
el llamado (nombre completo y módulo); la voz sale de la consola para no duplicar el audio.

## Consecuencias
- (+) Sin carga en el backend; el módulo (`usuarios.modulo`) es el único dato nuevo que la API aporta.
- (+) Probado en navegador automatizado: 1 anuncio inmediato, 1 repetición a los 20 s, 0 tras iniciar.
- (−) Navegadores sin voces en español usan la voz por defecto; algunos exigen un clic previo (el clic en "Llamar" lo cumple).
