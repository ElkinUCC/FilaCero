import { useState } from "react";
import * as adminApi from "../../api/admin.api";
import { listarSedes } from "../../api/catalogo.api";
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";
import { Confirmar, Modal } from "../ui/Modal";
import { useToast } from "../../hooks/useToast";
import usePolling from "../../hooks/usePolling";
import Encabezado from "../layout/Encabezado";
import PanelDetalle, { Datos } from "../ui/PanelDetalle";
import TablaSeccion, { EnlaceDetalle, Estado } from "./TablaSeccion";
import { fechaCorta, horaDe, PRESENCIAS } from "../../utils/formatters";

/** Lo que el asesor está haciendo AHORA (atendiendo, en pausa, almuerzo...). */
function actividadAgente(agente, sedes) {
  if (!agente.activo) return { texto: "Retirado", detalle: "Acceso retirado", tono: "cancelado" };
  if (!agente.punto_asignado_id) return { texto: "Sin sede", detalle: "Asigna una sede para atender", tono: "espera" };
  const sede = sedes.find((item) => item.id === agente.punto_asignado_id);
  if (sede && !sede.activo) return { texto: "Sede inactiva", detalle: "No puede recibir turnos", tono: "cancelado" };
  if (agente.estado_turno_actual === "EN_ATENCION") {
    return { texto: "Atendiendo", detalle: `Atiende el turno ${agente.turno_actual.slice(-6)}`, tono: "atencion" };
  }
  if (agente.estado_turno_actual === "LLAMADO") {
    return { texto: "Llamando", detalle: `Llamó el turno ${agente.turno_actual.slice(-6)}`, tono: "llamado" };
  }
  const p = PRESENCIAS[agente.presencia || "DISPONIBLE"] || PRESENCIAS.DISPONIBLE;
  const desde = agente.presencia_desde ? ` desde las ${horaDe(agente.presencia_desde)}` : "";
  const detalle = agente.presencia === "DISPONIBLE" || !agente.presencia
    ? `Libre para atender${desde}` : `${p.texto}${desde}`;
  return { texto: p.texto, detalle, tono: p.tono };
}

function hace(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "Ayer" : `Hace ${d} días`;
}

function ultimoAcceso(iso) {
  return iso ? `${fechaCorta(iso.slice(0, 10))} · ${horaDe(iso)}` : "Sin ingresos registrados";
}

function FormularioAsesor({ inicial, sedes, onCerrar, onGuardado }) {
  const editando = Boolean(inicial?.id);
  const [form, setForm] = useState({
    nombre: inicial?.nombre || "",
    correo: inicial?.correo || "",
    password: "",
    punto_id: inicial?.punto_asignado_id ?? "",
    modulo: inicial?.modulo || "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    if (form.nombre.trim().length < 3) return setError("Escribe el nombre completo.");
    if (!editando && !/^\S+@\S+\.\S+$/.test(form.correo.trim())) return setError("Escribe un correo válido.");
    if ((!editando || form.password) && !(form.password.length >= 8 && /\d/.test(form.password) && /[a-z]/i.test(form.password))) {
      return setError("La contraseña debe tener 8 caracteres o más, con letras y números.");
    }
    const cuerpo = {
      nombre: form.nombre.trim(),
      punto_id: form.punto_id === "" ? null : Number(form.punto_id),
      modulo: form.modulo.trim(),
    };
    if (!editando) cuerpo.correo = form.correo.trim();
    if (form.password) cuerpo.password = form.password;

    setGuardando(true);
    setError("");
    try {
      const r = editando ? await adminApi.actualizarAgente(inicial.id, cuerpo) : await adminApi.crearAgente(cuerpo);
      onGuardado(r.agente, editando);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  const opciones = [{ value: "", label: "Sin sede asignada" }, ...sedes.filter((s) => s.activo).map((s) => ({ value: s.id, label: s.nombre }))];

  return (
    <Modal
      titulo={editando ? "Editar asesor" : "Nuevo asesor"}
      ancho={560}
      descripcion={editando ? "Revisa la ficha y actualiza los datos asignados al asesor." : "Cada asesor suma 3 cupos por franja de 30 minutos en su sede."}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="btn btn--suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-asesor" className="btn btn--primario" disabled={guardando}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear asesor"}
          </button>
        </>
      }
    >
      <form id="form-asesor" className="formulario" onSubmit={guardar}>
        <label>
          <span className="etiqueta">Nombre completo</span>
          <span className="campo"><Icon name="usuario" size={17} /><input value={form.nombre} onChange={cambiar("nombre")} maxLength={100} required /></span>
        </label>
        {!editando && (
          <label>
            <span className="etiqueta">Correo de acceso</span>
            <span className="campo"><input type="email" value={form.correo} onChange={cambiar("correo")} maxLength={120} placeholder="nombre@filacero.co" required /></span>
          </label>
        )}
        <div className="formulario__fila">
          <Dropdown label="Sede" icon="edificio" value={form.punto_id} options={opciones} onChange={(v) => setForm((f) => ({ ...f, punto_id: v }))} />
          <label>
            <span className="etiqueta">Módulo o taquilla</span>
            <span className="campo">
              <Icon name="atender" size={17} />
              <input value={form.modulo} onChange={cambiar("modulo")} maxLength={40} list="sugerencias-modulo" placeholder="Ej. Módulo 2" />
            </span>
            <datalist id="sugerencias-modulo">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={`m${n}`} value={`Módulo ${n}`} />)}
              {[1, 2, 3].map((n) => <option key={`t${n}`} value={`Taquilla ${n}`} />)}
            </datalist>
          </label>
        </div>
        <small className="formulario__ayuda">El módulo se anuncia en la sala de espera y en el llamado por voz: “acérquese al Módulo 2”.</small>
        <label>
          <span className="etiqueta">{editando ? "Nueva contraseña (opcional)" : "Contraseña"}</span>
          <span className="campo"><Icon name="llave" size={17} /><input type="password" value={form.password} onChange={cambiar("password")} autoComplete="new-password" placeholder="Mínimo 8, con letras y números" /></span>
        </label>
        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      </form>
    </Modal>
  );
}

export default function Agentes({ titulo, soloLectura }) {
  const avisar = useToast();
  const [editar, setEditar] = useState(null);
  const [retirar, setRetirar] = useState(null);
  const [eliminar, setEliminar] = useState(null);
  const [estadoAccion, setEstadoAccion] = useState({ ocupado: false, error: "" });
  const [mostrarRetirados, setMostrarRetirados] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [detalleId, setDetalleId] = useState(null);
  const { datos, error, actualizado, refrescar, setDatos } = usePolling(async () => {
    const [a, sedes] = await Promise.all([adminApi.listarAgentes(), listarSedes({ todos: true })]);
    return { agentes: a.agentes, sedes };
  }, 10000);

  async function alternar(agente, activo) {
    setDatos((d) => ({ ...d, agentes: d.agentes.map((x) => (x.id === agente.id ? { ...x, activo } : x)) }));
    try {
      await adminApi.actualizarAgente(agente.id, { activo });
      avisar(`${agente.nombre} ${activo ? "puede ingresar" : "ya no puede ingresar"}.`);
    } catch (e) {
      avisar(e.message, "error");
    }
    refrescar();
  }

  async function confirmarRetiro() {
    setEstadoAccion({ ocupado: true, error: "" });
    try {
      await adminApi.actualizarAgente(retirar.id, { activo: false });
      avisar(`${retirar.nombre} retirado. Se conservaron sus turnos e historial.`);
      setRetirar(null);
      setEstadoAccion({ ocupado: false, error: "" });
      refrescar();
    } catch (e) {
      setEstadoAccion({ ocupado: false, error: e.message });
    }
  }

  async function confirmarEliminar() {
    setEstadoAccion({ ocupado: true, error: "" });
    try {
      const r = await adminApi.eliminarAgente(eliminar.id);
      avisar(r?.mensaje || `${eliminar.nombre} eliminado.`);
      if (detalleId === eliminar.id) setDetalleId(null);
      setEliminar(null);
      setEstadoAccion({ ocupado: false, error: "" });
      refrescar();
    } catch (e) {
      setEstadoAccion({ ocupado: false, error: e.message });
    }
  }

  const todosAgentes = datos?.agentes || [];
  const sedes = datos?.sedes || [];
  const retirados = todosAgentes.filter((a) => !a.activo).length;
  const filtro = buscar.trim().toLowerCase();
  const agentes = todosAgentes.filter((a) =>
    (mostrarRetirados || a.activo)
    && (!filtro || `${a.nombre} ${a.correo} ${a.sede || ""} ${a.modulo || ""}`.toLowerCase().includes(filtro)));
  const detalle = todosAgentes.find((a) => a.id === detalleId) || null;

  const pedirRetiro = (a) => { setRetirar(a); setEstadoAccion({ ocupado: false, error: "" }); };
  const pedirEliminar = (a) => { setEliminar(a); setEstadoAccion({ ocupado: false, error: "" }); };

  function botonAcceso(a, conTexto = false) {
    if (soloLectura || a.protegida) return null;
    const enCurso = Boolean(a.turno_actual);
    const texto = a.activo ? "Retirar" : "Reactivar";
    const ayuda = a.activo
      ? (enCurso ? "No se puede retirar mientras tiene un turno en curso." : "Retira el acceso sin borrar el historial.")
      : "Devuelve el acceso al asesor.";
    return (
      <button
        className={conTexto ? "btn btn--suave" : "icono-btn"}
        title={ayuda}
        aria-label={`${texto} a ${a.nombre}`}
        disabled={a.activo && enCurso}
        onClick={() => (a.activo ? pedirRetiro(a) : alternar(a, true))}
      >
        <Icon name="encender" size={conTexto ? 16 : 17} />{conTexto && ` ${texto}`}
      </button>
    );
  }

  const filas = agentes.map((a) => {
    const actividad = actividadAgente(a, sedes);
    return {
      id: a.id,
      inactivo: !a.activo,
      celdas: [
        <EnlaceDetalle key="n" texto={a.nombre} avatar={a.nombre[0]} onClick={() => setDetalleId(a.id)} />,
        a.sede || <span key="k1" className="tenue">Sin sede</span>,
        a.modulo || <span key="k1" className="tenue">Sin módulo</span>,
        a.ultimo_acceso ? hace(a.ultimo_acceso) : <span key="k1" className="tenue">Nunca</span>,
        <Estado key="e" tono={actividad.tono}>{actividad.texto}</Estado>,
        !soloLectura && (
          <>
            <button className="icono-btn" title="Editar" aria-label={`Editar ${a.nombre}`} onClick={() => setEditar(a)}><Icon name="editar" size={17} /></button>
            {botonAcceso(a)}
            {!a.protegida && (
              <button className="icono-btn icono-btn--peligro" title={a.turno_actual ? "Tiene un turno en curso" : "Eliminar asesor"} aria-label={`Eliminar a ${a.nombre}`} disabled={Boolean(a.turno_actual)} onClick={() => pedirEliminar(a)}>
                <Icon name="eliminar" size={17} />
              </button>
            )}
          </>
        ),
      ],
    };
  });

  const actividadDetalle = detalle ? actividadAgente(detalle, sedes) : null;

  return (
    <section className="adm__seccion">
      <Encabezado titulo={titulo} detalle="Personas que atienden en cada sede. Haz clic en un asesor para ver su ficha completa." actualizado={actualizado} error={error}>
        {!soloLectura && <button className="btn btn--primario" onClick={() => setEditar({})}><Icon name="mas" size={17} /> Nuevo asesor</button>}
      </Encabezado>

      <article className="panel panel--tabla">
        <div className="barra-tabla">
          <label className="campo campo--buscar">
            <Icon name="buscar" size={16} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre, sede o módulo" aria-label="Buscar asesor" />
          </label>
          <div className="barra-tabla__der">
            <span className="tenue">{todosAgentes.length - retirados} activos · {retirados} retirados</span>
            <label className="filtro-retirados">
              <input type="checkbox" checked={mostrarRetirados} onChange={(e) => setMostrarRetirados(e.target.checked)} />
              Mostrar retirados
            </label>
          </div>
        </div>
        <TablaSeccion
          etiqueta={titulo}
          columnas={["Asesor", "Sede", "Módulo", "Último ingreso", "Estado", ""]}
          alinear={["left", "left", "center", "center", "center", "right"]}
          anchos={[24, 16, 12, 14, 19, 15]}
          filas={filas}
          cargando={!datos}
          vacio={buscar ? "Ningún asesor con esa búsqueda." : retirados && !mostrarRetirados ? "No hay asesores activos. Activa “Mostrar retirados” para revisar o reactivar cuentas." : "Aún no hay asesores. Crea el primero con “Nuevo asesor”."}
        />
      </article>

      {detalle && (
        <PanelDetalle
          titulo={detalle.nombre}
          subtitulo={detalle.correo}
          insignia={<>
            <Estado tono={actividadDetalle.tono}>{actividadDetalle.texto}</Estado>
            {detalle.protegida && <span className="insignia-protegida"><Icon name="escudo" size={12} /> Protegida</span>}
          </>}
          onCerrar={() => setDetalleId(null)}
          acciones={!soloLectura && <>
            <button className="btn btn--suave" onClick={() => setEditar(detalle)}><Icon name="editar" size={16} /> Editar</button>
            {botonAcceso(detalle, true)}
            {!detalle.protegida && (
              <button className="btn btn--peligro" disabled={Boolean(detalle.turno_actual)} onClick={() => pedirEliminar(detalle)}>
                <Icon name="eliminar" size={16} /> Eliminar
              </button>
            )}
          </>}
        >
          <Datos
            titulo="Puesto de atención"
            filas={[
              ["Sede", detalle.sede || "Sin sede asignada"],
              ["Módulo o taquilla", detalle.modulo || "Sin módulo"],
              ["Ahora", actividadDetalle.detalle],
              ["Turno en curso", detalle.turno_actual ? detalle.turno_actual.slice(-6) : "Ninguno"],
            ]}
          />
          <Datos
            titulo="Cuenta"
            filas={[
              ["Correo de acceso", detalle.correo],
              ["Acceso", detalle.activo ? "Activo" : "Retirado"],
              ["Último ingreso", ultimoAcceso(detalle.ultimo_acceso)],
              ["Creado", detalle.fecha_creacion ? fechaCorta(detalle.fecha_creacion.slice(0, 10)) : null],
            ]}
          />
        </PanelDetalle>
      )}

      {editar && (
        <FormularioAsesor
          inicial={editar}
          sedes={sedes}
          onCerrar={() => setEditar(null)}
          onGuardado={(agente, editando) => {
            setEditar(null);
            avisar(`${agente?.nombre || "Asesor"} ${editando ? "actualizado" : "creado"}.`);
            refrescar();
          }}
        />
      )}

      {retirar && (
        <Confirmar
          titulo="Retirar asesor"
          mensaje={`¿Retirar a ${retirar.nombre}? Se desactivará su acceso y dejará de contar para la capacidad de la sede. Sus turnos e historial se conservarán; puedes reactivarlo después.`}
          textoConfirmar="Retirar asesor"
          ocupado={estadoAccion.ocupado}
          error={estadoAccion.error}
          onConfirmar={confirmarRetiro}
          onCerrar={() => setRetirar(null)}
        />
      )}

      {eliminar && (
        <Confirmar
          titulo="Eliminar asesor"
          mensaje={`¿Eliminar definitivamente a ${eliminar.nombre}? Desaparecerá de la lista, no podrá volver a ingresar y su correo quedará libre. Las atenciones que realizó se conservan en el historial y en los indicadores. Esta acción no se puede deshacer; si solo quieres pausar su acceso, usa “Retirar”.`}
          textoConfirmar="Eliminar asesor"
          ocupado={estadoAccion.ocupado}
          error={estadoAccion.error}
          onConfirmar={confirmarEliminar}
          onCerrar={() => setEliminar(null)}
        />
      )}
    </section>
  );
}
