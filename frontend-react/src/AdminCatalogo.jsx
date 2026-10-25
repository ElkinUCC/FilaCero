
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "./api";

const CONFIG = {
  Sedes: {
    ruta: "/sedes/",
    singular: "sede",
    campos: [
      {
        nombre: "nombre",
        etiqueta: "Nombre de la sede",
        tipo: "text",
        requerido: true,
        placeholder: "Ej. Sede Centro",
      },
      {
        nombre: "direccion",
        etiqueta: "Dirección",
        tipo: "text",
        placeholder: "Dirección de la sede",
      },
    ],
  },
  "Trámites": {
    ruta: "/tramites/",
    singular: "trámite",
    campos: [
      {
        nombre: "nombre",
        etiqueta: "Nombre del trámite",
        tipo: "text",
        requerido: true,
        placeholder: "Ej. Atención al ciudadano",
      },
      {
        nombre: "descripcion",
        etiqueta: "Descripción",
        tipo: "textarea",
        placeholder: "Describe brevemente el servicio",
      },
      {
        nombre: "tiempo_estimado",
        etiqueta: "Tiempo estimado (minutos)",
        tipo: "number",
        requerido: true,
      },
    ],
  },
};

const FORMULARIO_VACIO = {
  nombre: "",
  direccion: "",
  descripcion: "",
  tiempo_estimado: 15,
};

function obtenerLista(respuesta, seccion) {
  if (Array.isArray(respuesta)) return respuesta;

  if (seccion === "Sedes") {
    return respuesta?.puntos || respuesta?.sedes || [];
  }

  return respuesta?.tramites || [];
}

function mensajeError(error, alternativa) {
  return error instanceof Error && error.message
    ? error.message
    : alternativa;
}

export default function AdminCatalogo({ seccion }) {
  const config = CONFIG[seccion];

  const [registros, setRegistros] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [editando, setEditando] = useState(null);

  const [cargandoLista, setCargandoLista] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const solicitudRef = useRef(0);

  const ocupado = guardando || eliminandoId !== null;

  const cargarRegistros = useCallback(async () => {
    if (!config) return;

    const solicitud = ++solicitudRef.current;

    setCargandoLista(true);
    setError("");

    try {
      const respuesta = await apiRequest(config.ruta);
      const lista = obtenerLista(respuesta, seccion);

      if (!Array.isArray(lista)) {
        throw new Error(
          "El servidor devolvió un formato inesperado para el catálogo."
        );
      }

      if (solicitud === solicitudRef.current) {
        setRegistros(lista);
      }
    } catch (e) {
      if (solicitud === solicitudRef.current) {
        setError(
          `No se pudo cargar el catálogo: ${mensajeError(
            e,
            "Error de comunicación con el servidor."
          )}`
        );
      }
    } finally {
      if (solicitud === solicitudRef.current) {
        setCargandoLista(false);
      }
    }
  }, [config, seccion]);

  useEffect(() => {
    cargarRegistros();

    return () => {
      solicitudRef.current += 1;
    };
  }, [cargarRegistros]);

  function cambiarCampo(nombre, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [nombre]: valor,
    }));
  }

  function limpiarFormulario() {
    setEditando(null);
    setFormulario(FORMULARIO_VACIO);
  }

  function editar(registro) {
    setEditando(registro.id);

    setFormulario({
      ...FORMULARIO_VACIO,
      ...registro,
      nombre: registro.nombre || "",
      direccion: registro.direccion || "",
      descripcion: registro.descripcion || "",
      tiempo_estimado: registro.tiempo_estimado ?? 15,
    });

    setError("");
    setMensaje("");
  }

  async function guardar(e) {
    e.preventDefault();

    if (!config || guardando || eliminandoId !== null) return;

    setError("");
    setMensaje("");

    const nombre = formulario.nombre.trim();

    if (!nombre) {
      setError("El nombre es obligatorio.");
      return;
    }

    const cuerpo = { nombre };

    if (seccion === "Sedes") {
      cuerpo.direccion = formulario.direccion.trim();
    } else {
      const tiempo = Number(formulario.tiempo_estimado);

      if (!Number.isFinite(tiempo) || tiempo < 1) {
        setError("El tiempo estimado debe ser de al menos un minuto.");
        return;
      }

      cuerpo.descripcion = formulario.descripcion.trim();
      cuerpo.tiempo_estimado = tiempo;
    }

    setGuardando(true);

    try {
      const ruta = editando !== null
        ? `${config.ruta}${editando}`
        : config.ruta;

      const respuesta = await apiRequest(ruta, {
        method: editando !== null ? "PUT" : "POST",
        body: JSON.stringify(cuerpo),
      });

      setMensaje(
        respuesta?.mensaje ||
          (editando !== null
            ? `${config.singular} actualizado correctamente.`
            : `${config.singular} creado correctamente.`)
      );

      limpiarFormulario();
      await cargarRegistros();
    } catch (e) {
      setError(
        `No se pudo guardar: ${mensajeError(
          e,
          "Error de comunicación con el servidor."
        )}`
      );
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(registro) {
    if (!config || ocupado || registro.id == null) return;

    const confirmado = window.confirm(
      `¿Deseas eliminar "${registro.nombre}"? Esta acción no se puede deshacer.`
    );

    if (!confirmado) return;

    setError("");
    setMensaje("");
    setEliminandoId(registro.id);

    try {
      const respuesta = await apiRequest(
        `${config.ruta}${registro.id}`,
        { method: "DELETE" }
      );

      setMensaje(
        respuesta?.mensaje || `${config.singular} eliminado correctamente.`
      );

      if (editando === registro.id) {
        limpiarFormulario();
      }

      await cargarRegistros();
    } catch (e) {
      setError(
        `No se pudo eliminar: ${mensajeError(
          e,
          "Error de comunicación con el servidor."
        )}`
      );
    } finally {
      setEliminandoId(null);
    }
  }

  if (!config) {
    return (
      <section className="data-panel">
        <p className="error">
          No existe configuración para el catálogo solicitado.
        </p>
      </section>
    );
  }

  return (
    <section className="data-panel">
      <header className="catalogo-header">
        <div>
          <p className="eyebrow">ADMINISTRACIÓN</p>
          <h2>Gestión de {seccion.toLowerCase()}</h2>
          <p className="muted">
            Crea, consulta y administra los registros del sistema.
          </p>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={cargarRegistros}
          disabled={cargandoLista || ocupado}
        >
          {cargandoLista ? "Actualizando..." : "↻ Actualizar lista"}
        </button>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="success" role="status">
          {mensaje}
        </div>
      )}

      <form className="booking-form" onSubmit={guardar}>
        <h3>
          {editando !== null
            ? `Editar ${config.singular}`
            : `Crear ${config.singular}`}
        </h3>

        {config.campos.map((campo) => (
          <div className="catalogo-campo" key={campo.nombre}>
            <label htmlFor={`campo-${seccion}-${campo.nombre}`}>
              {campo.etiqueta}
              {campo.requerido && (
                <span aria-hidden="true"> *</span>
              )}
            </label>

            {campo.tipo === "textarea" ? (
              <textarea
                id={`campo-${seccion}-${campo.nombre}`}
                value={formulario[campo.nombre]}
                onChange={(e) =>
                  cambiarCampo(campo.nombre, e.target.value)
                }
                placeholder={campo.placeholder || ""}
                required={campo.requerido}
                rows={3}
                maxLength={1000}
                disabled={ocupado}
              />
            ) : (
              <input
                id={`campo-${seccion}-${campo.nombre}`}
                type={campo.tipo}
                value={formulario[campo.nombre]}
                onChange={(e) =>
                  cambiarCampo(campo.nombre, e.target.value)
                }
                placeholder={campo.placeholder || ""}
                required={campo.requerido}
                min={campo.tipo === "number" ? 1 : undefined}
                max={campo.tipo === "number" ? 1440 : undefined}
                step={campo.tipo === "number" ? 1 : undefined}
                maxLength={campo.tipo === "text" ? 180 : undefined}
                disabled={ocupado}
              />
            )}
          </div>
        ))}

        <div className="catalogo-acciones">
          <button
            className="primary"
            type="submit"
            disabled={ocupado}
          >
            {guardando
              ? "Guardando..."
              : editando !== null
                ? "Guardar cambios"
                : `Crear ${config.singular}`}
          </button>

          {editando !== null && (
            <button
              className="secondary"
              type="button"
              onClick={limpiarFormulario}
              disabled={ocupado}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="catalogo-lista">
        <div className="catalogo-header">
          <div>
            <h3>Registros existentes</h3>
            <p className="muted">
              {registros.length} registro(s) encontrado(s)
            </p>
          </div>
        </div>

        {cargandoLista && registros.length === 0 && (
          <p className="muted" role="status">
            Cargando registros...
          </p>
        )}

        {!cargandoLista && registros.length === 0 && !error && (
          <div className="current-turn">
            <h3>Aún no hay registros</h3>
            <p className="muted">
              Puedes crear el primer {config.singular} usando el formulario.
            </p>
          </div>
        )}

        {registros.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  {seccion === "Sedes" ? (
                    <th>Dirección</th>
                  ) : (
                    <>
                      <th>Descripción</th>
                      <th>Tiempo</th>
                    </>
                  )}
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {registros.map((registro) => (
                  <tr key={registro.id}>
                    <td>
                      <strong>{registro.nombre}</strong>
                    </td>

                    {seccion === "Sedes" ? (
                      <td>
                        {registro.direccion || "Sin dirección registrada"}
                      </td>
                    ) : (
                      <>
                        <td>
                          {registro.descripcion || "Sin descripción"}
                        </td>
                        <td>
                          {registro.tiempo_estimado != null
                            ? `${registro.tiempo_estimado} min`
                            : "—"}
                        </td>
                      </>
                    )}

                    <td>
                      <div className="catalogo-acciones">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => editar(registro)}
                          disabled={ocupado}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => eliminar(registro)}
                          disabled={ocupado}
                        >
                          {eliminandoId === registro.id
                            ? "Eliminando..."
                            : "Eliminar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
