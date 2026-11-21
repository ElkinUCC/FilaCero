# ADR-018 · Estructura estándar por dominio y lógica de apoyo en `scripts/`

- **Estado**: Aceptado · **Atributos**: mantenibilidad, legibilidad, verificabilidad
- **Relacionados**: ADR-001 (monolito modular por capas), ADR-017 (capas estrictas, revisado por este)

## Contexto
En la revisión del proyecto el docente pidió que **todas** las carpetas de `app/dominios/` tengan la misma
estructura del monolito modular (como `tramites/`): `controladores`, `dtos`, `modelos`, `repositorios` y
`servicios`. Varios dominios tenían archivos adicionales: `turnos/{otp,prediccion,preparacion,sala}.py`,
`agentes/{despacho,consultas,tablero,admin_servicios}.py`, `asistente/{motor,contexto,llm}.py`,
`reclamos/asistente.py`, `usuarios/admin_*.py` y `franjas/{admin_*,disponibilidad}.py`.

## Decisión
1. Cada dominio tiene **exactamente** `__init__, controladores, dtos, modelos, repositorios, servicios`.
2. La lógica de apoyo que no es una capa se mueve a `backend/scripts/` como scripts importables:
   - `scripts/turnos/`: `otp.py`, `prediccion.py`, `preparacion.py`, `sala.py`
   - `scripts/agentes/`: `despacho.py`, `consultas.py`, `tablero.py`
   - `scripts/asistente/`: `motor.py`, `contexto.py`, `llm.py`, `minichat_reclamos.py`
3. Los `admin_servicios.py` / `admin_controladores.py` / `disponibilidad.py` se fusionan en el `servicios.py` /
   `controladores.py` de su dominio (cada blueprint conserva su URL).
4. `asistente` gana sus capas: el controlador llama a `servicios.py`, que orquesta los scripts; las consultas
   pasan a `repositorios.py`. `auditoria` gana `controladores.py` (bitácora). Los dominios sin tablas propias
   (`agentes`, `asistente`) declaran en `modelos.py` las entidades que leen.
5. `tests/test_arquitectura_capas.py` verifica que cada dominio tenga exactamente esa estructura y que ningún
   script declare rutas HTTP.

## Consecuencias
- (+) Todos los dominios se leen igual; el asistente IA (función opcional) queda claramente separado del núcleo.
- (+) Ninguna URL de la API cambió; las 200+ pruebas siguen pasando.
- (−) Algunos servicios importan scripts de forma diferida para evitar ciclos de arranque (`agentes.servicios`).
