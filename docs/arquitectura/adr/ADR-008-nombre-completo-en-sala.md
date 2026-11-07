# ADR-008 · Nombre completo en la pantalla de sala

- **Estado**: **Revisado en la entrega final** · **Atributos**: usabilidad vs. privacidad · **Riesgos**: R-04

## Contexto
La versión anterior mostraba "Nombre I." (nombre e inicial) para minimizar datos personales en un lugar público.
En la revisión, el docente pidió ver **el nombre completo** de la persona llamada, sin abreviar ni recortar:
con nombres repetidos ("Juan G.") la persona no sabe si la llaman a ella, y el anuncio por voz debe coincidir
con lo que se lee.

## Alternativas
| Alternativa | A favor | En contra |
|---|---|---|
| Solo código de turno | Máxima privacidad | Personas mayores o sin el código a mano no se reconocen |
| Nombre e inicial (anterior) | Privacidad razonable | Ambigüedad; no coincide con la voz |
| **Nombre completo, sin datos de contacto** | Identificación inequívoca; coincide con el llamado por voz | Expone el nombre en la sede |

## Decisión
Mostrar y anunciar el **nombre completo**, el código y el **módulo** ("Acérquese al Módulo 2"). Nunca se muestra
el celular ni otros datos. Queda **configurable**: `SALA_NOMBRE_COMPLETO=false` vuelve al formato abreviado.

## Consecuencias
- (+) Coherencia entre pantalla, voz y consola del asesor.
- (−) Mayor exposición de un dato personal en un espacio físico. Mitigación: aviso de tratamiento de datos al
  reservar (pendiente para producción, I-03), interruptor de configuración y prueba automática que garantiza que
  el celular jamás aparece en la sala.
- Revisión documentada: prueba `test_pantalla_de_sala_no_expone_datos_personales` actualizada y nueva prueba
  `test_pantalla_de_sala_puede_abreviar_nombres`.
