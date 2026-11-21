# ADR-012 · Ejecución solo en localhost (un nodo)

- **Estado**: Revisado · **Atributos**: costo, riesgo de la demostración, simplicidad; sacrifica disponibilidad · **Riesgos**: R-02, R-03

## Contexto
La entrega se presenta en localhost. El curso pide comparar virtualización, contenedores y nube por el problema
que resuelven y las responsabilidades y costos que introducen. En versiones anteriores el repositorio guardaba
artefactos de contenedores y de publicación en la nube "por si acaso"; nunca formaron parte de la demostración y
agregaban configuración, código y pruebas que no se usaban.

## Alternativas
Comparación completa en [05 §6](../05-arquitectura-fisica.md#6-alternativas-de-ejecución-comparadas):
nodo local, contenedores (Docker Compose), PaaS en la nube y VM IaaS.

## Decisión
FilaCero se ejecuta **solo en localhost**: tres procesos en el equipo de demostración (MySQL 8, la API con
`python run.py` y un servidor estático para la SPA, que no se compila). El repositorio **no** incluye
contenedores, servidor web de producción, configuración de nube ni un modo "producción" en la API: se retiraron
`docker-compose.yml`, los `Dockerfile`, `nginx.conf`, `vercel.json`, `wsgi.py`, el modo OTP de demo pública, la
validación de arranque para producción, `ProxyFix` y TLS hacia la base de datos.

## Consecuencias
- (+) Sin dependencia de la red del aula ni arranques en frío; costo cero.
- (+) Medido: 20× de margen sobre la carga estimada ([05 §5](../05-arquitectura-fisica.md#5-evidencia-de-capacidad-medida)).
- (+) Menos superficie: no hay código ni configuración que no se ejecute en la demostración.
- (−) Punto único de falla; sin HTTPS; sin respaldos automáticos (aceptado: es una demostración local; R-02, R-03).
- (−) Publicarlo en internet exigiría volver a agregar servidor web, TLS, proveedor SMS y respaldos; la
  arquitectura lógica no cambiaría (escenario E-2 en [10](../10-evolucion.md)).
