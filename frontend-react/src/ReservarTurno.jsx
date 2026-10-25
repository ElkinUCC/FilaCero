import { useEffect, useState } from "react";
import { apiRequest } from "./api";

function obtenerFechaMinima() {
  const hoy = new Date();

  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");
}

function obtenerLista(respuesta, claves) {
  if (Array.isArray(respuesta)) return respuesta;

  for (const clave of claves) {
    if (Array.isArray(respuesta?.[clave])) {
      return respuesta[clave];
    }
  }

  return [];
}

function Paso({ numero, titulo, activo, completado }) {
  return (
    <div
      className={[
        "reserva-paso",
        activo ? "reserva-paso--activo" : "",
        completado ? "reserva-paso--completado" : "",
      ].filter(Boolean).join(" ")}
    >
      <span className="reserva-paso__numero">
        {completado ? "✓" : numero}
      </span>
      <span className="reserva-paso__titulo">{titulo}</span>
    </div>
  );
}

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

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [consultando, setConsultando] = useState(false);
  const [reservando, setReservando] = useState(false);

  const [paso, setPaso] = useState(1);
  const [fechaMinima] = useState(obtenerFechaMinima);

  const ocupado = consultando || reservando;

  useEffect(() => {
    let vigente = true;

    async function cargarCatalogos() {
      setCargandoCatalogos(true);
      setError("");

      try {
        const [respuestaSedes, respuestaTramites] = await Promise.all([
          apiRequest("/sedes/"),
          apiRequest("/tramites/"),
        ]);

        if (!vigente) return;

        setSedes(
          obtenerLista(respuestaSedes, ["puntos", "sedes"])
            .filter((item) => item.activo !== false)
        );

        setTramites(
          obtenerLista(respuestaTramites, ["tramites"])
            .filter((item) => item.activo !== false)
        );
      } catch (e) {
        if (vigente) {
          setError(
            `No se pudieron cargar los servicios: ${e.message}`
          );
        }
      } finally {
        if (vigente) setCargandoCatalogos(false);
      }
    }

    cargarCatalogos();

    return () => {
      vigente = false;
    };
  }, []);

  function limpiarDisponibilidad() {
    setFranjas([]);
    setFranja("");
    setTurnoCreado(null);
    setMensaje("");
  }

  function cambiarSede(valor) {
    setSede(valor);
    limpiarDisponibilidad();
    setPaso(1);
    setError("");
  }

  function cambiarTramite(valor) {
    setTramite(valor);
    limpiarDisponibilidad();
    setPaso(2);
    setError("");
  }

  function cambiarFecha(valor) {
    setFecha(valor);
    limpiarDisponibilidad();
    setPaso(3);
    setError("");
  }

  async function consultarFranjas() {
    if (!sede || !tramite || !fecha) {
      setError("Selecciona una sede, un trámite y una fecha.");
      return;
    }

    setError("");
    setMensaje("");
    setFranjas([]);
    setFranja("");
    setConsultando(true);

    try {
      const parametros = new URLSearchParams({
        sede_id: sede,
        tramite_id: tramite,
        fecha,
      });

      const resultado = await apiRequest(
        `/franjas/disponibles?${parametros.toString()}`
      );

      const disponibles = obtenerLista(resultado, ["franjas"]);

      setFranjas(disponibles);
      setPaso(3);

      if (disponibles.length === 0) {
        setMensaje(
          "No hay horarios disponibles para esa fecha. Prueba otro día."
        );
      }
    } catch (e) {
      setError(`No se pudieron consultar los horarios: ${e.message}`);
    } finally {
      setConsultando(false);
    }
  }

  async function reservar(e) {
    e.preventDefault();

    if (!nombre.trim() || !celular.trim()) {
      setError("Completa tu nombre y número de celular.");
      return;
    }

    if (!sede || !tramite || !fecha || !franja) {
      setError("Completa todos los pasos antes de confirmar.");
      return;
    }

    setError("");
    setMensaje("");
    setReservando(true);

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
      setMensaje(
        resultado.mensaje || "Tu turno fue reservado correctamente."
      );
      setPaso(4);
      setFranjas([]);
      setFranja("");
    } catch (e) {
      setError(`No se pudo reservar el turno: ${e.message}`);
    } finally {
      setReservando(false);
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
    setPaso(1);
  }

  const sedeSeleccionada = sedes.find(
    (item) => String(item.id) === String(sede)
  );

  const tramiteSeleccionado = tramites.find(
    (item) => String(item.id) === String(tramite)
  );

  const franjaSeleccionada = franjas.find(
    (item) => String(item.franja_id) === String(franja)
  );

  return (
    <section className="data-panel reserva-panel">
      <header className="reserva-header">
        <div>
          <p className="eyebrow">RESERVA EN LÍNEA</p>
          <h2>Reserva tu turno</h2>
          <p className="muted">
            Elige dónde quieres ser atendido y encuentra el horario
            que mejor se adapte a ti.
          </p>
        </div>

        <div className="reserva-header__icon" aria-hidden="true">
          ✓
        </div>
      </header>

      <div className="reserva-progreso" aria-label={`Paso ${paso} de 4`}>
        <Paso
          numero="1"
          titulo="Sede"
          activo={paso === 1}
          completado={Boolean(sede)}
        />
        <div className="reserva-progreso__linea" />
        <Paso
          numero="2"
          titulo="Trámite"
          activo={paso === 2}
          completado={Boolean(tramite)}
        />
        <div className="reserva-progreso__linea" />
        <Paso
          numero="3"
          titulo="Horario"
          activo={paso === 3}
          completado={Boolean(franjaSeleccionada)}
        />
        <div className="reserva-progreso__linea" />
        <Paso
          numero="4"
          titulo="Confirmar"
          activo={paso === 4}
          completado={Boolean(turnoCreado)}
        />
      </div>

      {error && (
        <div className="error reserva-mensaje" role="alert">
          {error}
        </div>
      )}

      {mensaje && !turnoCreado && (
        <div className="success reserva-mensaje" role="status">
          {mensaje}
        </div>
      )}

      {cargandoCatalogos ? (
        <div className="reserva-vacio" role="status">
          <span className="reserva-spinner" />
          <p>Cargando sedes y servicios disponibles...</p>
        </div>
      ) : turnoCreado ? (
        <div className="reserva-confirmacion">
          <div className="reserva-confirmacion__icono">✓</div>
          <p className="eyebrow">RESERVA CONFIRMADA</p>
          <h2>¡Tu turno está listo!</h2>
          <p className="muted">{mensaje}</p>

          <div className="reserva-codigo">
            <span>Tu código de turno</span>
            <strong>{turnoCreado.codigo || "Confirmado"}</strong>
            <small>Guarda este código para identificar tu turno.</small>
          </div>

          <div className="reserva-resumen">
            <div>
              <span>Sede</span>
              <strong>
                {sedeSeleccionada?.nombre || "Sede seleccionada"}
              </strong>
            </div>

            <div>
              <span>Trámite</span>
              <strong>
                {tramiteSeleccionado?.nombre || "Trámite seleccionado"}
              </strong>
            </div>

            <div>
              <span>Fecha</span>
              <strong>{turnoCreado.fecha || fecha}</strong>
            </div>

            <div>
              <span>Horario</span>
              <strong>
                {turnoCreado.hora_inicio || franjaSeleccionada?.hora_inicio || "—"}
                {" - "}
                {turnoCreado.hora_fin || franjaSeleccionada?.hora_fin || "—"}
              </strong>
            </div>

            <div>
              <span>Estado</span>
              <strong>{turnoCreado.estado || "Reservado"}</strong>
            </div>
          </div>

          <button
            type="button"
            className="primary reserva-boton-completo"
            onClick={nuevaReserva}
          >
            Hacer otra reserva
          </button>
        </div>
      ) : (
        <form className="booking-form reserva-form" onSubmit={reservar}>
          <section className="reserva-seccion">
            <div className="reserva-seccion__titulo">
              <span>1</span>
              <div>
                <h3>Selecciona la sede</h3>
                <p className="muted">
                  ¿Dónde quieres realizar tu trámite?
                </p>
              </div>
            </div>

            {sedes.length === 0 ? (
              <p className="muted">
                No hay sedes disponibles en este momento.
              </p>
            ) : (
              <div className="reserva-opciones">
                {sedes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`reserva-opcion ${
                      String(sede) === String(item.id)
                        ? "reserva-opcion--seleccionada"
                        : ""
                    }`}
                    aria-pressed={String(sede) === String(item.id)}
                    onClick={() => cambiarSede(String(item.id))}
                  >
                    <span className="reserva-opcion__radio" />
                    <span className="reserva-opcion__contenido">
                      <strong>{item.nombre}</strong>
                      <small>
                        {item.direccion || "Dirección no disponible"}
                      </small>
                    </span>
                    <span className="reserva-opcion__flecha">›</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="reserva-seccion">
            <div className="reserva-seccion__titulo">
              <span>2</span>
              <div>
                <h3>Selecciona el trámite</h3>
                <p className="muted">
                  Elige el servicio que necesitas.
                </p>
              </div>
            </div>

            <label htmlFor="tramite">Trámite o servicio</label>
            <select
              id="tramite"
              value={tramite}
              onChange={(e) => cambiarTramite(e.target.value)}
              required
            >
              <option value="">Selecciona un servicio</option>
              {tramites.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                  {item.tiempo_estimado
                    ? ` · ${item.tiempo_estimado} min`
                    : ""}
                </option>
              ))}
            </select>

            {tramites.length === 0 && (
              <p className="muted">
                No hay trámites disponibles en este momento.
              </p>
            )}
          </section>

          <section className="reserva-seccion">
            <div className="reserva-seccion__titulo">
              <span>3</span>
              <div>
                <h3>Fecha y horario</h3>
                <p className="muted">
                  Consulta los cupos antes de confirmar.
                </p>
              </div>
            </div>

            <label htmlFor="fecha-turno">Fecha del turno</label>
            <input
              id="fecha-turno"
              type="date"
              value={fecha}
              min={fechaMinima}
              onChange={(e) => cambiarFecha(e.target.value)}
              required
            />

            <button
              type="button"
              className="secondary reserva-boton-completo"
              onClick={consultarFranjas}
              disabled={ocupado || !sede || !tramite || !fecha}
            >
              {consultando
                ? "Consultando horarios..."
                : "Consultar horarios disponibles"}
            </button>

            {franjas.length > 0 && (
              <>
                <label htmlFor="franja">Horarios disponibles</label>

                <div className="reserva-horarios">
                  {franjas.map((item) => (
                    <button
                      key={item.franja_id}
                      type="button"
                      className={`reserva-horario ${
                        String(franja) === String(item.franja_id)
                          ? "reserva-horario--seleccionado"
                          : ""
                      }`}
                      aria-pressed={
                        String(franja) === String(item.franja_id)
                      }
                      onClick={() => {
                        setFranja(String(item.franja_id));
                        setPaso(4);
                        setError("");
                      }}
                    >
                      <strong>
                        {item.hora_inicio} – {item.hora_fin}
                      </strong>
                      {item.disponibles != null && (
                        <small>
                          {item.disponibles} cupo(s)
                        </small>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {franjaSeleccionada && (
            <section className="reserva-seccion">
              <div className="reserva-seccion__titulo">
                <span>4</span>
                <div>
                  <h3>Confirma tus datos</h3>
                  <p className="muted">
                    Ya casi terminamos.
                  </p>
                </div>
              </div>

              <div className="reserva-resumen">
                <div>
                  <span>Sede</span>
                  <strong>{sedeSeleccionada?.nombre}</strong>
                </div>
                <div>
                  <span>Trámite</span>
                  <strong>{tramiteSeleccionado?.nombre}</strong>
                </div>
                <div>
                  <span>Fecha</span>
                  <strong>{fecha}</strong>
                </div>
                <div>
                  <span>Horario</span>
                  <strong>
                    {franjaSeleccionada.hora_inicio} –{" "}
                    {franjaSeleccionada.hora_fin}
                  </strong>
                </div>
              </div>

              <label htmlFor="nombre-cliente">Nombre completo</label>
              <input
                id="nombre-cliente"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Escribe tu nombre completo"
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

              <button
                type="submit"
                className="primary reserva-boton-completo"
                disabled={ocupado || !nombre.trim() || !celular.trim()}
              >
                {reservando ? "Confirmando reserva..." : "Confirmar mi turno →"}
              </button>
            </section>
          )}
        </form>
      )}
    </section>
  );
}
