import { useEffect, useState } from "react";
import { apiRequest } from "./api";

export default function ReservarTurno() {
  const [sedes, setSedes] = useState([]);
  const [tramites, setTramites] = useState([]);
  const [franjas, setFranjas] = useState([]);
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [sede, setSede] = useState("");
  const [tramite, setTramite] = useState("");
  const [fecha, setFecha] = useState("");
  const [franja, setFranja] = useState("");
  const [turnoCreado, setTurnoCreado] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const hoy = new Date();
  const fechaMinima = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");

  useEffect(() => {
    async function cargarCatalogos() {
      try {
        const [s, t] = await Promise.all([
          apiRequest("/sedes/"),
          apiRequest("/tramites/"),
        ]);

        setSedes((Array.isArray(s) ? s : s.puntos || s.sedes || [])
          .filter((item) => item.activo !== false));
        setTramites((Array.isArray(t) ? t : t.tramites || [])
          .filter((item) => item.activo !== false));
      } catch (e) {
        setError(`No se pudieron cargar los servicios: ${e.message}`);
      }
    }

    cargarCatalogos();
  }, []);

  async function consultarFranjas() {
    setError("");
    setMensaje("");
    setFranjas([]);
    setFranja("");
    setTurnoCreado(null);
    setCargando(true);

    try {
      const resultado = await apiRequest(
        `/franjas/disponibles?sede_id=${sede}&tramite_id=${tramite}&fecha=${fecha}`
      );

      const disponibles = resultado.franjas || [];
      setFranjas(disponibles);

      if (!disponibles.length) {
        setMensaje("No hay horarios disponibles para esa fecha. Prueba con otro día.");
      }
    } catch (e) {
      setError(`No se pudieron consultar los horarios: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }

  async function reservar(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    try {
      const resultado = await apiRequest("/turnos/publico", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          celular: celular.trim(),
          punto_id: Number(sede),
          tramite_id: Number(tramite),
          franja_id: Number(franja),
        }),
      });

      const turno = resultado.turno || resultado;
      setTurnoCreado(turno);
      setMensaje(resultado.mensaje || "Tu turno fue reservado correctamente.");
      setFranjas([]);
      setFranja("");
    } catch (e) {
      setError(`No se pudo reservar el turno: ${e.message}`);
    } finally {
      setCargando(false);
    }
  }

  function nuevaReserva() {
    setNombre("");
    setCelular("");
    setSede("");
    setTramite("");
    setFecha("");
    setFranja("");
    setFranjas([]);
    setTurnoCreado(null);
    setError("");
    setMensaje("");
  }

  return (
    <section className="data-panel">
      <h2>Reserva tu turno</h2>
      <p className="muted">
        Completa tus datos, elige el servicio y selecciona un horario disponible.
        No necesitas crear una cuenta.
      </p>

      {turnoCreado ? (
        <div className="current-turn">
          <p className="eyebrow">RESERVA CONFIRMADA</p>
          <h2>{turnoCreado.codigo}</h2>
          <p>{mensaje}</p>
          <p><strong>Fecha:</strong> {turnoCreado.fecha}</p>
          <p>
            <strong>Horario:</strong>{" "}
            {turnoCreado.hora_inicio} - {turnoCreado.hora_fin}
          </p>
          <p><strong>Estado:</strong> {turnoCreado.estado}</p>
          <p>Guarda tu código para identificar tu turno.</p>
          <button type="button" className="primary" onClick={nuevaReserva}>
            Hacer otra reserva
          </button>
        </div>
      ) : (
        <form className="booking-form" onSubmit={reservar}>
          <label htmlFor="nombre-cliente">Nombre completo</label>
          <input
            id="nombre-cliente"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Escribe tu nombre"
            maxLength={120}
            autoComplete="name"
            required
          />

          <label htmlFor="celular-cliente">Número de celular</label>
          <input
            id="celular-cliente"
            type="tel"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            placeholder="Ej. 3001234567"
            maxLength={20}
            autoComplete="tel"
            required
          />

          <label htmlFor="sede">Sede</label>
          <select
            id="sede"
            value={sede}
            onChange={(e) => {
              setSede(e.target.value);
              setFranjas([]);
              setFranja("");
            }}
            required
          >
            <option value="">Selecciona una sede</option>
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>

          <label htmlFor="tramite">Trámite o servicio</label>
          <select
            id="tramite"
            value={tramite}
            onChange={(e) => {
              setTramite(e.target.value);
              setFranjas([]);
              setFranja("");
            }}
            required
          >
            <option value="">Selecciona un servicio</option>
            {tramites.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>

          <label htmlFor="fecha-turno">Fecha del turno</label>
          <input
            id="fecha-turno"
            type="date"
            value={fecha}
            min={fechaMinima}
            onChange={(e) => {
              setFecha(e.target.value);
              setFranjas([]);
              setFranja("");
            }}
            required
          />

          <button
            type="button"
            className="primary"
            onClick={consultarFranjas}
            disabled={cargando || !sede || !tramite || !fecha}
          >
            {cargando ? "Consultando..." : "Consultar horarios"}
          </button>

          {franjas.length > 0 && (
            <>
              <label htmlFor="franja">Horario disponible</label>
              <select
                id="franja"
                value={franja}
                onChange={(e) => setFranja(e.target.value)}
                required
              >
                <option value="">Selecciona un horario</option>
                {franjas.map((f) => (
                  <option key={f.franja_id} value={f.franja_id}>
                    {f.hora_inicio} - {f.hora_fin}
                    {f.disponibles != null ? ` · ${f.disponibles} cupo(s)` : ""}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="primary"
                disabled={cargando || !franja || !nombre.trim() || !celular.trim()}
              >
                {cargando ? "Reservando..." : "Confirmar reserva"}
              </button>
            </>
          )}

          {mensaje && <p className="success">{mensaje}</p>}
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </section>
  );
}
