import { useMemo, useState } from "react";
import * as catalogoApi from "../../api/catalogo.api";
import Icon from "../ui/Icon";
import { Confirmar, Modal } from "../ui/Modal";
import PanelDetalle, { Datos } from "../ui/PanelDetalle";
import { useToast } from "../../hooks/useToast";
import usePolling from "../../hooks/usePolling";
import Encabezado from "../layout/Encabezado";
import { FLUJOS } from "../../utils/formatters";
import TablaSeccion, { EnlaceDetalle, Estado } from "./TablaSeccion";

const CONFIG = {
  sedes: {
    singular: "sede",
    nuevo: "Nueva sede",
    detalle: "Puntos de atención donde el ciudadano puede reservar.",
    vacio: { nombre: "", direccion: "" },
  },
  tramites: {
    singular: "trámite",
    nuevo: "Nuevo trámite",
    detalle: "Servicios que se pueden reservar. La atención se limita a 10 minutos.",
    vacio: {
      nombre: "",
      descripcion: "",
      tipo_flujo: "GENERAL",
      tiempo_estimado: 10,
    },
  },
};

function Formulario({ tipo, inicial, onCerrar, onGuardado }) {
  const c = CONFIG[tipo];
  const [form, setForm] = useState({
    ...c.vacio,
    ...inicial,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const editando = Boolean(inicial?.id);
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    const cuerpo = { nombre: form.nombre.trim() };
    if (tipo === "sedes") cuerpo.direccion = (form.direccion || "").trim();
    else {
      cuerpo.descripcion = (form.descripcion || "").trim();
      cuerpo.tipo_flujo = form.tipo_flujo || "GENERAL";
      cuerpo.tiempo_estimado = Number(form.tiempo_estimado);
    }
    if (cuerpo.nombre.length < 2) return setError("Escribe un nombre de al menos 2 caracteres.");
    if (tipo === "tramites" && !(cuerpo.tiempo_estimado >= 1 && cuerpo.tiempo_estimado <= 10)) {
      return setError("La duración estimada debe estar entre 1 y 10 minutos (regla de atención).");
    }
    setGuardando(true);
    setError("");
    try {
      const { registro } = editando
        ? await catalogoApi.actualizar(tipo, inicial.id, cuerpo)
        : await catalogoApi.crear(tipo, cuerpo);
      onGuardado(registro, editando);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={editando ? `Editar ${c.singular}` : c.nuevo}
      descripcion={c.detalle}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="btn btn--suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-catalogo" className="btn btn--primario" disabled={guardando}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : `Crear ${c.singular}`}
          </button>
        </>
      }
    >
      <form id="form-catalogo" className="formulario" onSubmit={guardar}>
        <label>
          <span className="etiqueta">Nombre</span>
          <span className="campo"><input required value={form.nombre} onChange={cambiar("nombre")} maxLength={100} placeholder={tipo === "sedes" ? "Ej. Sede Centro" : "Ej. Soporte técnico"} /></span>
        </label>
        {tipo === "sedes" ? (
          <label>
            <span className="etiqueta">Dirección</span>
            <span className="campo"><Icon name="pin" size={17} /><input value={form.direccion || ""} onChange={cambiar("direccion")} maxLength={200} placeholder="Calle, barrio, ciudad" /></span>
            <small className="formulario__ayuda">{(form.direccion || "").length}/200 · Se mostrará al elegir la sede.</small>
          </label>
        ) : (
          <>
            <label>
              <span className="etiqueta">Descripción</span>
              <span className="campo"><textarea value={form.descripcion || ""} onChange={cambiar("descripcion")} maxLength={1000} rows={3} placeholder="Qué incluye el servicio" /></span>
              <small className="formulario__ayuda">{(form.descripcion || "").length}/1000 · Describe brevemente qué debe esperar el ciudadano.</small>
            </label>
            <div>
              <span className="etiqueta">Tipo de atención</span>
              <div className="flujos">
                {Object.entries(FLUJOS).map(([clave, f]) => (
                  <button key={clave} type="button" className={`flujo ${form.tipo_flujo === clave ? "activo" : ""}`} onClick={() => setForm((x) => ({ ...x, tipo_flujo: clave }))}>
                    <strong>{f.texto}</strong>
                    <small>{f.detalle}</small>
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span className="etiqueta">Duración estimada (minutos)</span>
              <span className="campo"><Icon name="reloj" size={17} /><input type="number" min={1} max={10} value={form.tiempo_estimado} onChange={cambiar("tiempo_estimado")} /></span>
              <small className="formulario__ayuda">La operación reserva franjas de 30 minutos y limita cada atención a 10 minutos.</small>
            </label>
            <p className={`opcion-preparacion ${["ENTREGA", "GARANTIA"].includes(form.tipo_flujo) ? "" : "opcion-preparacion--no"}`} role="note">
              <Icon name={["ENTREGA", "GARANTIA"].includes(form.tipo_flujo) ? "paquete" : "alerta"} size={18} />
              <span>
                <strong>{["ENTREGA", "GARANTIA"].includes(form.tipo_flujo) ? "Se alista antes de que llegue el cliente" : "Sin preparación previa"}</strong>
                <small>
                  {form.tipo_flujo === "ENTREGA" ? "El asesor prueba y empaca el equipo; el cliente lo recibe presentando su cédula."
                    : form.tipo_flujo === "GARANTIA" ? "El asesor revisa la compra y la cobertura antes de la cita."
                      : "Solo la entrega de equipos y las garantías se preparan. Lo define el tipo de atención."}
                </small>
              </span>
            </p>
          </>
        )}
        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      </form>
    </Modal>
  );
}

export default function Catalogo({ tipo, titulo, soloLectura }) {
  const c = CONFIG[tipo];
  const esSede = tipo === "sedes";
  const avisar = useToast();
  const [buscar, setBuscar] = useState("");
  const [editar, setEditar] = useState(null); // {} = nuevo, objeto = editar
  const [eliminar, setEliminar] = useState(null);
  const [estadoEliminar, setEstadoEliminar] = useState({ ocupado: false, error: "" });
  const [cambiando, setCambiando] = useState(null);
  const [detalleId, setDetalleId] = useState(null);

  const { datos, error, actualizado, refrescar, setDatos } = usePolling(
    () => catalogoApi.listar(tipo, { todos: true }),
    30000,
    [tipo]
  );

  const filas = useMemo(() => {
    const f = buscar.trim().toLowerCase();
    return (datos || []).filter((x) => !f || `${x.nombre} ${x.direccion || ""} ${x.descripcion || ""}`.toLowerCase().includes(f));
  }, [datos, buscar]);

  const detalle = (datos || []).find((x) => x.id === detalleId) || null;

  async function alternar(registro, activo) {
    setCambiando(registro.id);
    setDatos((d) => d.map((x) => (x.id === registro.id ? { ...x, activo } : x)));
    try {
      await catalogoApi.actualizar(tipo, registro.id, { activo });
      avisar(`${registro.nombre} ${activo ? "activado" : "desactivado"}.`);
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setCambiando(null);
      refrescar();
    }
  }

  async function confirmarEliminar() {
    setEstadoEliminar({ ocupado: true, error: "" });
    try {
      await catalogoApi.eliminar(tipo, eliminar.id);
      avisar(`${eliminar.nombre} eliminado.`);
      if (detalleId === eliminar.id) setDetalleId(null);
      setEliminar(null);
      setEstadoEliminar({ ocupado: false, error: "" });
      refrescar();
    } catch (e) {
      setEstadoEliminar({ ocupado: false, error: e.message });
    }
  }

  const pedirEliminar = (r) => { setEliminar(r); setEstadoEliminar({ ocupado: false, error: "" }); };
  const activos = (datos || []).filter((x) => x.activo).length;

  const columnas = esSede
    ? ["Sede", "Dirección", "Asesores activos", "Cupos por franja", "Estado", ""]
    : ["Trámite", "Tipo de atención", "Duración", "Preparación previa", "Estado", ""];

  const filasTabla = filas.map((r) => {
    const estado = <Estado tono={r.activo ? "ok" : "cancelado"}>{r.activo ? "Activo" : "Inactivo"}</Estado>;
    const principal = <EnlaceDetalle texto={r.nombre} onClick={() => setDetalleId(r.id)} />;
    const acciones = (
      <>
        {esSede && (
          <a className="icono-btn" href={`/sala?sede=${r.id}`} target="_blank" rel="noopener noreferrer" title="Abrir pantalla de sala de espera" aria-label={`Abrir pantalla de sala de ${r.nombre} (nueva pestaña)`}>
            <Icon name="pantalla" size={17} />
          </a>
        )}
        {!soloLectura && (
          <button className="icono-btn" title="Editar" aria-label={`Editar ${r.nombre}`} onClick={() => setEditar(r)}>
            <Icon name="editar" size={17} />
          </button>
        )}
        {!soloLectura && !esSede && (
          <button className="icono-btn" title={r.activo ? "Desactivar" : "Activar"} aria-label={`${r.activo ? "Desactivar" : "Activar"} ${r.nombre}`} disabled={cambiando === r.id} onClick={() => alternar(r, !r.activo)}>
            <Icon name="encender" size={17} />
          </button>
        )}
        {!soloLectura && (
          <button className="icono-btn icono-btn--peligro" title="Eliminar" aria-label={`Eliminar ${r.nombre}`} onClick={() => pedirEliminar(r)}>
            <Icon name="eliminar" size={17} />
          </button>
        )}
      </>
    );
    const celdas = esSede
      ? [principal, r.direccion || <span key="k1" className="tenue">Sin dirección</span>, r.asesores_activos ?? "—", r.cupos_por_franja ?? "—", estado, acciones]
      : [
          principal,
          FLUJOS[r.tipo_flujo || "GENERAL"]?.texto,
          `${r.tiempo_estimado} min`,
          r.requiere_preparacion ? <Estado key="k1" tono="atencion">Se prepara</Estado> : <span key="k2" className="tenue">No aplica</span>,
          estado,
          acciones,
        ];
    return { id: r.id, inactivo: !r.activo, celdas };
  });

  return (
    <section className="adm__seccion">
      <Encabezado titulo={titulo} detalle={c.detalle} actualizado={actualizado} error={error}>
        {!soloLectura && (
          <button className="btn btn--primario" onClick={() => setEditar({})}>
            <Icon name="mas" size={17} /> {c.nuevo}
          </button>
        )}
      </Encabezado>

      <article className="panel panel--tabla">
        <div className="barra-tabla">
          <label className="campo campo--buscar">
            <Icon name="buscar" size={16} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder={`Buscar ${c.singular}`} aria-label="Buscar" />
          </label>
          <span className="tenue">{activos} activos de {(datos || []).length}</span>
        </div>
        <TablaSeccion
          etiqueta={titulo}
          columnas={columnas}
          alinear={esSede ? ["left", "left", "center", "center", "center", "right"] : ["left", "left", "center", "center", "center", "right"]}
          anchos={esSede ? [20, 36, 12, 12, 10, 10] : [28, 18, 12, 18, 12, 12]}
          filas={filasTabla}
          cargando={!datos}
          vacio={buscar ? "Ningún resultado con esa búsqueda." : `Aún no hay registros. Usa “${c.nuevo}” para crear el primero.`}
        />
      </article>

      {detalle && (
        <PanelDetalle
          titulo={detalle.nombre}
          subtitulo={esSede ? detalle.direccion || "Sin dirección registrada" : `${detalle.tiempo_estimado} min por atención`}
          insignia={<Estado tono={detalle.activo ? "ok" : "cancelado"}>{detalle.activo ? "Activo" : "Inactivo"}</Estado>}
          onCerrar={() => setDetalleId(null)}
          acciones={
            <>
              {esSede && (
                <a className="btn btn--borde" href={`/sala?sede=${detalle.id}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="pantalla" size={16} /> Pantalla de sala
                </a>
              )}
              {!soloLectura && <>
                <button className="btn btn--suave" onClick={() => setEditar(detalle)}><Icon name="editar" size={16} /> Editar</button>
                <button className="btn btn--suave" disabled={cambiando === detalle.id} onClick={() => alternar(detalle, !detalle.activo)}>
                  <Icon name="encender" size={16} /> {detalle.activo ? "Desactivar" : "Activar"}
                </button>
                <button className="btn btn--peligro" onClick={() => pedirEliminar(detalle)}><Icon name="eliminar" size={16} /> Eliminar</button>
              </>}
            </>
          }
        >
          {esSede ? (
            <Datos
              titulo="Operación"
              filas={[
                ["Asesores activos", detalle.asesores_activos],
                ["Cupos por franja de 30 min", detalle.cupos_por_franja],
                ["Estado", detalle.activo ? "Recibe reservas" : "No aparece al reservar"],
                ["Identificador", `#${detalle.id}`],
              ]}
            />
          ) : (
            <>
              <section className="detalle__bloque">
                <h3>Descripción</h3>
                <p className="detalle__texto">{detalle.descripcion || "Sin descripción."}</p>
              </section>
              <Datos
                titulo="Configuración"
                filas={[
                  ["Tipo de atención", FLUJOS[detalle.tipo_flujo || "GENERAL"]?.texto],
                  ["Cómo reserva el cliente", FLUJOS[detalle.tipo_flujo || "GENERAL"]?.detalle],
                  ["Duración estimada", `${detalle.tiempo_estimado} min`],
                  ["Preparación previa", detalle.requiere_preparacion ? "Sí, se alista antes de la llegada" : "No"],
                ]}
              />
            </>
          )}
        </PanelDetalle>
      )}

      {editar && (
        <Formulario
          tipo={tipo}
          inicial={editar}
          onCerrar={() => setEditar(null)}
          onGuardado={(registro, editando) => {
            setEditar(null);
            avisar(`${registro?.nombre || "Registro"} ${editando ? "actualizado" : "creado"}.`);
            refrescar();
          }}
        />
      )}

      {eliminar && (
        <Confirmar
          titulo={`Eliminar ${c.singular}`}
          mensaje={`¿Eliminar “${eliminar.nombre}”? Si ya tiene turnos registrados no se puede eliminar; en ese caso desactívalo para que no aparezca al reservar.`}
          textoConfirmar="Eliminar"
          ocupado={estadoEliminar.ocupado}
          error={estadoEliminar.error}
          extra={estadoEliminar.error && eliminar.activo ? (
            <button className="btn btn--borde" onClick={() => { alternar(eliminar, false); setEliminar(null); }}>Desactivar en su lugar</button>
          ) : null}
          onConfirmar={confirmarEliminar}
          onCerrar={() => setEliminar(null)}
        />
      )}
    </section>
  );
}
