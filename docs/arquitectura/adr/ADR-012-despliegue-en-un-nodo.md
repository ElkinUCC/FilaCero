# ADR-012 · Despliegue en un nodo local

- **Estado**: Aceptado · **Atributos**: costo, riesgo de la demostración; sacrifica disponibilidad · **Riesgos**: R-02

## Contexto
La entrega se presenta en localhost. El curso pide comparar virtualización, contenedores y nube por el problema
que resuelven y las responsabilidades y costos que introducen.

## Alternativas
Comparación completa en [05 §6](../05-arquitectura-fisica.md#6-alternativas-de-ejecución-comparadas):
nodo local, Docker Compose, PaaS en la nube, VM IaaS.

## Decisión
Tres procesos (MySQL, API, Vite) en el equipo de demostración. Se conservan `Dockerfile`, `nginx.conf` y
`vercel.json` de trabajos previos como ruta de evolución, sin ser parte de la demostración.

## Consecuencias
- (+) Sin dependencia de la red del aula ni arranques en frío; costo cero.
- (+) Medido: 20× de margen sobre la carga estimada.
- (−) Punto único de falla; sin HTTPS; sin respaldos automáticos (aceptado para la demo, resuelto en el despliegue objetivo de [06 §2](../06-despliegue.md#2-despliegue-objetivo-producción-evolución)).
