
import { useEffect, useState } from "react";
import { apiRequest } from "./api";

const CONFIG = {
  Sedes: {
    ruta: "/sedes/",
    singular: "sede",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true },
      { nombre: "direccion", etiqueta: "Dirección", tipo: "text" },
    ],
  },
  "Trámites": {
    ruta: "/tramites/",
    singular: "trámite",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", tipo: "text", requerido: true },
      { nombre: "descripcion", etiqueta: "Descripción", tipo: "textarea" },
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

export default function AdminCatalogo({ seccion }) {
  const config = CONFIG[seccion];
  const [registros, setRegistros] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [editando, setEditando] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargarRegistros() {
    setCargando(true);
    setError("");

    try {
      const respuesta = await apiRequest(config.ruta);
      const lista =
        seccion === "Sedes"
          ? respuesta.puntos
          : respuesta.tramites;

      setRegistros(Array.isArray(lista) ? lista : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    setRegistros([]);
    setFormulario(FORMULARIO_VACIO);
    setEditando(null);
    setMensaje("");
    setError("");
    cargarRegistros();
  }, [seccion]);

  function cambiarCampo(nombre, valor) {
    setFormulario((anterior) => ({
      ...anterior,
      [nombre]: valor,
    }));
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

  function limpiarFormulario() {
    setEditando(null);
    setFormulario(FORMULARIO_VACIO);
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    const cuerpo = {
      nombre: formulario.nombre.trim(),
    };

    if (seccion === "Sedes") {
      cuerpo.direccion = formulario.direccion.trim();
    } else {
      cuerpo.descripcion = formulario.descripcion.trim();
      cuerpo.tiempo_estimado = Number(formulario.tiempo_estimado);
    }

    try {
      const ruta = editando
        ? `${config.ruta}${editando}`
        : config.ruta;

      await apiRequest(ruta, {
        method: editando ? "PUT" : "POST",
        body: JSON.stringify(cuerpo),
      });

      setMensaje(
        editando
          ? `${config.singular} actualizada correctamente.`
          : `${config.singular} creada correctamente.`
      );

      limpiarFormulario();
      await cargarRegistros();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function eliminar(registro) {
    const confirmado = window.confirm(
      `¿Deseas eliminar "${registro.nombre}"?`
    );

    if (!confirmado) return;

    setError("");
    setMensaje("");
    setCargando(true);

    try {
      const ruta = `${config.ruta}${registro.id}`;

      const respuesta = await apiRequest(ruta, {
        method: "DELETE",
      });

      setMensaje(respuesta.mensaje || "Registro eliminado.");

      if (editando === registro.id) limpiarFormulario();

      await cargarRegistros();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  if (!config) return null;

  return (
    <section className="data-panel">
      <div className="catalogo-header">
        <div>
          <h2>Gestión de {seccion.toLowerCase()}</h2>
          <p className="muted">
            Crea, consulta y administra los registros del sistema.
          </p>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={cargarRegistros}
          disabled={cargando}
        >
          Actualizar lista
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {mensaje && <p className="success">{mensaje}</p>}

      <form className="booking-form" onSubmit={guardar}>
        <h3>{editando ? "Editar registro" : `Crear ${config.singular}`}</h3>

        {config.campos.map((campo) => (
          <div className="catalogo-campo" key={campo.nombre}>
            <label htmlFor={`campo-${campo.nombre}`}>
              {campo.etiqueta}
            </label>

            {campo.tipo === "textarea" ? (
              <textarea
                id={`campo-${campo.nombre}`}
                value={formulario[campo.nombre]}
                onChange={(e) =>
                  cambiarCampo(campo.nombre, e.target.value)
                }
                required={campo.requerido}
                rows={3}
              />
            ) : (
              <input
                id={`campo-${campo.nombre}`}
                type={campo.tipo}
                value={formulario[campo.nombre]}
                onChange={(e) =>
                  cambiarCampo(campo.nombre, e.target.value)
                }
                required={campo.requerido}
                min={campo.tipo === "number" ? 1 : undefined}
              />
            )}
          </div>
        ))}

        <div className="catalogo-acciones">
          <button
            className="primary"
            type="submit"
            disabled={cargando}
          >
            {cargando
              ? "Guardando..."
              : editando
                ? "Guardar cambios"
                : `Crear ${config.singular}`}
          </button>

          {editando !== null && (
            <button
              className="secondary"
              type="button"
              onClick={limpiarFormulario}
              disabled={cargando}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="catalogo-lista">
        <h3>Registros existentes ({registros.length})</h3>

        {cargando && registros.length === 0 && (
          <p className="muted">Cargando registros...</p>
        )}

        {!cargando && registros.length === 0 && !error && (
          <p className="muted">Todavía no hay registros disponibles.</p>
        )}

        {registros.map((registro) => (
          <article className="catalogo-registro" key={registro.id}>
            <div className="catalogo-detalle">
              <strong>{registro.nombre}</strong>

              {seccion === "Sedes" ? (
                <p className="muted">
                  {registro.direccion || "Sin dirección registrada"}
                </p>
              ) : (
                <>
                  <p className="muted">
                    {registro.descripcion || "Sin descripción"}
                  </p>
                  <small>
                    Tiempo estimado: {registro.tiempo_estimado} min
                  </small>
                </>
              )}

              <small>ID: {registro.id}</small>
            </div>

            <div className="catalogo-acciones">
              <button
                type="button"
                className="secondary"
                onClick={() => editar(registro)}
                disabled={cargando}
              >
                Editar
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={() => eliminar(registro)}
                disabled={cargando}
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
