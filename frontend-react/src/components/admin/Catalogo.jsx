import { useMemo, useState } from "react";
import * as catalogoApi from "../../api/catalogo.api";
import Icon from "../ui/Icon";
import { Confirmar, Modal } from "../ui/Modal";
import Switch from "../ui/Switch";
import { useToast } from "../../hooks/useToast";
import usePolling from "../../hooks/usePolling";
import Encabezado from "../layout/Encabezado";

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
    vacio: { nombre: "", descripcion: "", tiempo_estimado: 10 },
  },
};

function Formulario({ tipo, inicial, onCerrar, onGuardado }) {
  const c = CONFIG[tipo];
  const [form, setForm] = useState({ ...c.vacio, ...inicial });
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
      descripcion={editando ? inicial.nombre : undefined}
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
          <span className="campo"><input value={form.nombre} onChange={cambiar("nombre")} maxLength={100} placeholder={tipo === "sedes" ? "Ej. Sede Centro" : "Ej. Soporte técnico"} /></span>
        </label>
        {tipo === "sedes" ? (
          <label>
            <span className="etiqueta">Dirección</span>
            <span className="campo"><Icon name="pin" size={17} /><input value={form.direccion || ""} onChange={cambiar("direccion")} maxLength={200} placeholder="Calle, barrio, ciudad" /></span>
          </label>
        ) : (
          <>
            <label>
              <span className="etiqueta">Descripción</span>
              <span className="campo"><textarea value={form.descripcion || ""} onChange={cambiar("descripcion")} maxLength={1000} rows={3} placeholder="Qué incluye el servicio" /></span>
            </label>
            <label>
              <span className="etiqueta">Duración estimada (minutos)</span>
              <span className="campo"><Icon name="reloj" size={17} /><input type="number" min={1} max={10} value={form.tiempo_estimado} onChange={cambiar("tiempo_estimado")} /></span>
            </label>
          </>
        )}
        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      </form>
    </Modal>
  );
}

export default function Catalogo({ tipo, titulo, soloLectura }) {
  const c = CONFIG[tipo];
  const avisar = useToast();
  const [buscar, setBuscar] = useState("");
  const [editar, setEditar] = useState(null); // {} = nuevo, objeto = editar
  const [eliminar, setEliminar] = useState(null);
  const [estadoEliminar, setEstadoEliminar] = useState({ ocupado: false, error: "" });
  const [cambiando, setCambiando] = useState(null);

  const { datos, error, actualizado, refrescar, setDatos } = usePolling(
    () => catalogoApi.listar(tipo, { todos: true }),
    30000,
    [tipo]
  );

  const filas = useMemo(() => {
    const f = buscar.trim().toLowerCase();
    return (datos || []).filter((x) => !f || `${x.nombre} ${x.direccion || ""} ${x.descripcion || ""}`.toLowerCase().includes(f));
  }, [datos, buscar]);

  async function alternar(registro, activo) {
    setCambiando(registro.id);
    setDatos((d) => d.map((x) => (x.id === registro.id ? { ...x, activo } : x)));
    try {
      await catalogoApi.actualizar(tipo, registro.id, { activo });
      avisar(`${registro.nombre} ${activo ? "activada" : "desactivada"}${tipo === "tramites" ? "" : ""}.`);
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
      setEliminar(null);
      setEstadoEliminar({ ocupado: false, error: "" });
      refrescar();
    } catch (e) {
      setEstadoEliminar({ ocupado: false, error: e.message });
    }
  }

  const activos = (datos || []).filter((x) => x.activo).length;

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
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                {tipo === "sedes" ? <th scope="col">Dirección</th> : <><th scope="col">Descripción</th><th scope="col" className="num">Duración</th></>}
                <th scope="col">Activo</th>
                <th scope="col" className="acciones"><span className="sr">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.id} className={r.activo ? "" : "inactivo"}>
                  <td><strong>{r.nombre}</strong></td>
                  {tipo === "sedes" ? (
                    <td className="tenue">{r.direccion || "Sin dirección"}</td>
                  ) : (
                    <>
                      <td className="tenue recorte">{r.descripcion || "Sin descripción"}</td>
                      <td className="num">{r.tiempo_estimado} min</td>
                    </>
                  )}
                  <td>
                    {soloLectura
                      ? <span className={`estado estado--${r.activo ? "ok" : "cancelado"}`}>{r.activo ? "Activo" : "Inactivo"}</span>
                      : <Switch activo={r.activo} disabled={cambiando === r.id} onChange={(v) => alternar(r, v)} etiqueta={r.activo ? "Desactivar" : "Activar"} />}
                  </td>
                  <td className="acciones">
                    {tipo === "sedes" && (
                      <a className="icono-btn" href={`/sala?sede=${r.id}`} target="_blank" rel="noopener noreferrer" title="Abrir pantalla de sala de espera" aria-label={`Abrir pantalla de sala de ${r.nombre} (nueva pestaña)`}>
                        <Icon name="pantalla" size={17} />
                      </a>
                    )}
                    {!soloLectura && <>
                    <button className="icono-btn" title="Editar" aria-label={`Editar ${r.nombre}`} onClick={() => setEditar(r)}>
                      <Icon name="editar" size={17} />
                    </button>
                    <button className="icono-btn icono-btn--peligro" title="Eliminar" aria-label={`Eliminar ${r.nombre}`} onClick={() => { setEliminar(r); setEstadoEliminar({ ocupado: false, error: "" }); }}>
                      <Icon name="eliminar" size={17} />
                    </button>
                  </>}</td>
                </tr>
              ))}
              {datos && !filas.length && (
                <tr><td colSpan={5} className="vacio">
                  {buscar ? "Ningún resultado con esa búsqueda." : `Aún no hay registros. Usa “${c.nuevo}” para crear el primero.`}
                </td></tr>
              )}
              {!datos && [1, 2, 3].map((i) => <tr key={i}><td colSpan={5}><div className="esqueleto" style={{ height: 16 }} /></td></tr>)}
            </tbody>
          </table>
        </div>
      </article>

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
