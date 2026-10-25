
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "./api";
import "./AdminDashboard.css";

const ESTADOS = [
  { key: "ESPERANDO", label: "En espera", color: "#e9a23b" },
  { key: "LLAMADO", label: "Llamados", color: "#4387e8" },
  { key: "EN_ATENCION", label: "En atención", color: "#0c9470" },
  { key: "ATENDIDO", label: "Atendidos", color: "#16845b" },
  { key: "CANCELADO", label: "Cancelados", color: "#df5b62" },
];

function numero(valor) {
  return Number(valor || 0).toLocaleString("es-CO");
}

function minutos(segundos) {
  if (segundos == null) return "—";
  const valor = Number(segundos);
  if (!Number.isFinite(valor)) return "—";
  if (valor < 60) return `${Math.round(valor)} s`;
  return `${Math.round(valor / 60)} min`;
}

export default function AdminDashboard() {
  const [metricas, setMetricas] = useState(null);
  const [sedes, setSedes] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState(null);
  const [error, setError] = useState("");

  const cargarDashboard = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    setError("");

    try {
      const [resumen, resultadoSedes, resultadoTramites] =
        await Promise.all([
          apiRequest("/admin/agentes/metricas"),
          apiRequest("/admin/agentes/metricas/sedes"),
          apiRequest("/admin/agentes/metricas/tramites"),
        ]);

      setMetricas(resumen);
      setSedes(Array.isArray(resultadoSedes?.sedes)
        ? resultadoSedes.sedes : []);
      setTramites(Array.isArray(resultadoTramites?.tramites)
        ? resultadoTramites.tramites : []);
      setActualizado(new Date());
    } catch (e) {
      setError(e.message || "No fue posible cargar las métricas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard();

    const intervalo = window.setInterval(() => {
      cargarDashboard(true);
    }, 30000);

    return () => window.clearInterval(intervalo);
  }, [cargarDashboard]);

  const estados = metricas?.por_estado || {};
  const total = Number(metricas?.total_turnos || 0);
  const maxEstado = Math.max(
    1,
    ...ESTADOS.map((estado) => Number(estados[estado.key] || 0))
  );
  const maxSede = Math.max(
    1,
    ...sedes.map((sede) => Number(sede.total_turnos || 0))
  );
  const maxTramite = Math.max(
    1,
    ...tramites.map((tramite) =>
      Number(tramite.total_turnos ?? tramite.total ?? 0)
    )
  );

  return (
    <section className="admin-dashboard">
      <div className="admin-dash-heading">
        <div>
          <span className="admin-dash-kicker">CENTRO DE OPERACIONES</span>
          <h2>Resumen general</h2>
          <p>Supervisa la actividad y el rendimiento de FilaCero.</p>
        </div>

        <button
          className="admin-dash-refresh"
          onClick={() => cargarDashboard()}
          disabled={cargando}
        >
          <span aria-hidden="true">↻</span>
          {cargando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="admin-dash-error" role="alert">
          <strong>No se pudieron actualizar los datos.</strong>
          <span>{error}</span>
          <button onClick={() => cargarDashboard()}>
            Reintentar
          </button>
        </div>
      )}

      <div className="admin-dash-status">
        <span className="admin-dash-live-dot" />
        <span>Panel conectado a la API</span>
        <span className="admin-dash-status-separator">·</span>
        <span>
          {actualizado
            ? `Actualizado a las ${actualizado.toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`
            : "Esperando primera respuesta"}
        </span>
      </div>

      {cargando && !metricas ? (
        <div className="admin-dash-loading">
          <span className="admin-dash-spinner" />
          <strong>Cargando indicadores</strong>
          <p>Consultando las métricas del sistema.</p>
        </div>
      ) : (
        <>
          <div className="admin-dash-kpis">
            <article className="admin-dash-kpi admin-dash-kpi-main">
              <div className="admin-dash-kpi-top">
                <span>Total de turnos</span>
                <span className="admin-dash-icon">▦</span>
              </div>
              <strong>{numero(total)}</strong>
              <small>Registros incluidos en la consulta</small>
              <div className="admin-dash-kpi-line" />
            </article>

            <article className="admin-dash-kpi">
              <div className="admin-dash-kpi-top">
                <span>En espera</span>
                <span className="admin-dash-icon amber">◷</span>
              </div>
              <strong>{numero(metricas?.en_espera)}</strong>
              <small>Personas pendientes de llamado</small>
            </article>

            <article className="admin-dash-kpi">
              <div className="admin-dash-kpi-top">
                <span>En proceso</span>
                <span className="admin-dash-icon blue">↗</span>
              </div>
              <strong>{numero(metricas?.en_proceso)}</strong>
              <small>Turnos llamados o en atención</small>
            </article>

            <article className="admin-dash-kpi">
              <div className="admin-dash-kpi-top">
                <span>Atendidos</span>
                <span className="admin-dash-icon green">✓</span>
              </div>
              <strong>{numero(metricas?.atendidos)}</strong>
              <small>
                {total
                  ? `${Math.round(
                      (Number(metricas?.atendidos || 0) / total) * 100
                    )}% del total`
                  : "Sin turnos registrados"}
              </small>
            </article>

            <article className="admin-dash-kpi">
              <div className="admin-dash-kpi-top">
                <span>Cancelados</span>
                <span className="admin-dash-icon red">×</span>
              </div>
              <strong>{numero(metricas?.cancelados)}</strong>
              <small>Turnos cancelados</small>
            </article>
          </div>

          <div className="admin-dash-charts">
            <article className="admin-dash-panel">
              <div className="admin-dash-panel-heading">
                <div>
                  <h3>Estado de los turnos</h3>
                  <p>Distribución actual de los registros</p>
                </div>
                <span className="admin-dash-panel-tag">ESTADOS</span>
              </div>

              <div className="admin-dash-bars">
                {ESTADOS.map((estado) => {
                  const valor = Number(estados[estado.key] || 0);
                  const ancho = total ? (valor / maxEstado) * 100 : 0;

                  return (
                    <div className="admin-dash-bar-row" key={estado.key}>
                      <div className="admin-dash-bar-label">
                        <span>
                          <i style={{ background: estado.color }} />
                          {estado.label}
                        </span>
                        <strong>{numero(valor)}</strong>
                      </div>
                      <div className="admin-dash-bar-track">
                        <div
                          className="admin-dash-bar-fill"
                          style={{
                            width: `${ancho}%`,
                            background: estado.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="admin-dash-panel-foot">
                <span>Total analizado</span>
                <strong>{numero(total)} turnos</strong>
              </div>
            </article>

            <article className="admin-dash-panel">
              <div className="admin-dash-panel-heading">
                <div>
                  <h3>Actividad por sede</h3>
                  <p>Turnos agrupados por punto de atención</p>
                </div>
                <span className="admin-dash-panel-tag">SEDES</span>
              </div>

              {sedes.length ? (
                <div className="admin-dash-bars">
                  {sedes.map((sede) => {
                    const valor = Number(sede.total_turnos || 0);
                    return (
                      <div
                        className="admin-dash-bar-row"
                        key={sede.punto_id}
                      >
                        <div className="admin-dash-bar-label">
                          <span>Sede #{sede.punto_id}</span>
                          <strong>{numero(valor)}</strong>
                        </div>
                        <div className="admin-dash-bar-track">
                          <div
                            className="admin-dash-bar-fill"
                            style={{
                              width: `${(valor / maxSede) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-dash-empty">
                  <span>▤</span>
                  <strong>Sin actividad por sede</strong>
                  <p>Cuando existan turnos, aparecerán aquí.</p>
                </div>
              )}

              <div className="admin-dash-panel-foot">
                <span>Sedes con actividad</span>
                <strong>{sedes.length}</strong>
              </div>
            </article>
          </div>

          <div className="admin-dash-bottom">
            <article className="admin-dash-panel">
              <div className="admin-dash-panel-heading">
                <div>
                  <h3>Trámites más solicitados</h3>
                  <p>Distribución según los registros disponibles</p>
                </div>
                <span className="admin-dash-panel-tag">TRÁMITES</span>
              </div>

              {tramites.length ? (
                <div className="admin-dash-bars">
                  {tramites.map((tramite, indice) => {
                    const valor = Number(
                      tramite.total_turnos ?? tramite.total ?? 0
                    );
                    return (
                      <div
                        className="admin-dash-bar-row"
                        key={tramite.tramite_id ?? tramite.id ?? indice}
                      >
                        <div className="admin-dash-bar-label">
                          <span>
                            {tramite.nombre ||
                              tramite.tramite ||
                              `Trámite #${tramite.tramite_id ?? tramite.id ?? indice + 1}`}
                          </span>
                          <strong>{numero(valor)}</strong>
                        </div>
                        <div className="admin-dash-bar-track">
                          <div
                            className="admin-dash-bar-fill"
                            style={{
                              width: `${(valor / maxTramite) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-dash-empty">
                  <span>▤</span>
                  <strong>Sin datos de trámites</strong>
                  <p>Comprueba la respuesta de la ruta de métricas por trámite.</p>
                </div>
              )}
            </article>

            <article className="admin-dash-panel admin-dash-average">
              <span className="admin-dash-average-icon">◷</span>
              <span className="admin-dash-kicker">EFICIENCIA OPERATIVA</span>
              <h3>Tiempo promedio de atención</h3>
              <strong>{minutos(metricas?.promedio_atencion_segundos)}</strong>
              <p>
                Calculado con los turnos atendidos que tienen hora de inicio y
                finalización válidas.
              </p>
              <div className="admin-dash-average-note">
                <span>Cancelados</span>
                <strong>{numero(metricas?.cancelados)}</strong>
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
