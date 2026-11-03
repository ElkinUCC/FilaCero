import { useState } from "react";
import * as adminApi from "../../api/admin.api";
import { listarSedes } from "../../api/catalogo.api";
import Dropdown from "../ui/Dropdown";
import Icon from "../ui/Icon";
import { Confirmar, Modal } from "../ui/Modal";
import { useToast } from "../../hooks/useToast";
import usePolling from "../../hooks/usePolling";
import Encabezado from "../layout/Encabezado";
import { fechaCorta, horaDe } from "../../utils/formatters";

function actividadAgente(agente, sedes) {
  if (!agente.activo) return { texto: "Deshabilitado", detalle: "Acceso retirado", tono: "cancelado" };
  if (!agente.punto_asignado_id) return { texto: "Sin sede", detalle: "Asigna una sede para atender", tono: "espera" };
  const sede = sedes.find((item) => item.id === agente.punto_asignado_id);
  if (sede && !sede.activo) return { texto: "Sede inactiva", detalle: "No puede recibir turnos", tono: "cancelado" };
  if (agente.estado_turno_actual === "EN_ATENCION") {
    return { texto: "Atendiendo", detalle: `Turno ${agente.turno_actual.slice(-6)}`, tono: "atencion" };
  }
  if (agente.estado_turno_actual === "LLAMADO") {
    return { texto: "Llamando", detalle: `Turno ${agente.turno_actual.slice(-6)}`, tono: "llamado" };
  }
  return { texto: "Disponible", detalle: "Sin turno en atención", tono: "ok" };
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
    const cuerpo = { nombre: form.nombre.trim(), punto_id: form.punto_id === "" ? null : Number(form.punto_id) };
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
  const actividad = editando ? actividadAgente(inicial, sedes) : null;

  return (
    <Modal
      titulo={editando ? "Editar asesor" : "Nuevo asesor"}
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
        {editando && (
          <section className="ficha-asesor" aria-label="Información actual del asesor">
            <div className="ficha-asesor__titulo">
              <strong>Ficha actual</strong>
              <span className={`estado estado--${actividad.tono}`}>{actividad.texto}</span>
            </div>
            <dl>
              <div><dt>Correo de acceso</dt><dd>{inicial.correo}</dd></div>
              <div><dt>Sede asignada</dt><dd>{inicial.sede || "Sin sede"}</dd></div>
              <div><dt>Actividad</dt><dd>{actividad.detalle}</dd></div>
              <div><dt>Último ingreso</dt><dd>{ultimoAcceso(inicial.ultimo_acceso)}</dd></div>
            </dl>
          </section>
        )}
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
        <Dropdown label="Sede" icon="edificio" value={form.punto_id} options={opciones} onChange={(v) => setForm((f) => ({ ...f, punto_id: v }))} />
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
  const [estadoRetiro, setEstadoRetiro] = useState({ ocupado: false, error: "" });
  const [mostrarRetirados, setMostrarRetirados] = useState(false);
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
    setEstadoRetiro({ ocupado: true, error: "" });
    try {
      await adminApi.actualizarAgente(retirar.id, { activo: false });
      avisar(`${retirar.nombre} retirado. Se conservaron sus turnos e historial.`);
      setRetirar(null);
      setEstadoRetiro({ ocupado: false, error: "" });
      refrescar();
    } catch (e) {
      setEstadoRetiro({ ocupado: false, error: e.message });
    }
  }

  const todosAgentes = datos?.agentes || [];
  const sedes = datos?.sedes || [];
  const agentes = todosAgentes.filter((a) => mostrarRetirados || a.activo);
  const retirados = todosAgentes.filter((a) => !a.activo).length;
  const porSede = todosAgentes.reduce((acc, a) => {
    if (a.activo && a.sede) acc[a.sede] = (acc[a.sede] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="adm__seccion">
      <Encabezado titulo={titulo} detalle="Personas que atienden en cada sede. El cupo de una sede crece con sus asesores activos." actualizado={actualizado} error={error}>
        {!soloLectura && <button className="btn btn--primario" onClick={() => setEditar({})}><Icon name="mas" size={17} /> Nuevo asesor</button>}
      </Encabezado>

      {Object.keys(porSede).length > 0 && (
        <div className="chips chips--resumen">
          {Object.entries(porSede).map(([sede, n]) => (
            <span key={sede} className="chip">{sede}: {n} asesor{n > 1 ? "es" : ""} · {n * 3} cupos/franja</span>
          ))}
        </div>
      )}

      <article className="panel panel--tabla">
        <div className="barra-tabla">
          <span className="tenue">{todosAgentes.length - retirados} activos · {retirados} retirados</span>
          <label className="filtro-retirados">
            <input
              type="checkbox"
              checked={mostrarRetirados}
              onChange={(e) => setMostrarRetirados(e.target.checked)}
            />
            Mostrar retirados
          </label>
        </div>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Asesor</th>
                <th scope="col">Sede</th>
                <th scope="col">Actividad actual</th>
                <th scope="col">Acceso</th>
                <th scope="col" className="acciones"><span className="sr">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {agentes.map((a) => {
                const actividad = actividadAgente(a, sedes);
                return (
                <tr key={a.id} className={a.activo ? "" : "inactivo"}>
                  <td>
                    <div className="persona">
                      <span className="adm__avatar adm__avatar--chico">{a.nombre[0]}</span>
                      <div><strong>{a.nombre}</strong><small>{a.correo}</small></div>
                    </div>
                  </td>
                  <td>{a.sede || <span className="estado estado--espera">Sin sede</span>}</td>
                  <td>
                    <span className={`estado estado--${actividad.tono}`}>{actividad.texto}</span>
                    <small className="bloque tenue">{actividad.detalle}</small>
                  </td>
                  <td>
                    <span className={`estado estado--${a.activo ? "ok" : "cancelado"}`}>
                      {a.activo ? "Activo" : "Retirado"}
                    </span>
                    {a.protegida && <small className="insignia-protegida">Protegida</small>}
                  </td>
                  <td className="acciones">
                    {!soloLectura && <>
                      {!a.protegida && (a.activo
                        ? <button
                            className="btn btn--suave btn--tabla-accion"
                            disabled={Boolean(a.turno_actual)}
                            title={a.turno_actual ? "No se puede retirar mientras tiene un turno en curso." : "Retira el acceso sin borrar el historial."}
                            onClick={() => { setRetirar(a); setEstadoRetiro({ ocupado: false, error: "" }); }}
                          >Retirar</button>
                        : <button
                            className="btn btn--suave btn--tabla-accion"
                            onClick={() => alternar(a, true)}
                          >Reactivar</button>)}
                      <button className="icono-btn" title="Editar" aria-label={`Editar ${a.nombre}`} onClick={() => setEditar(a)}><Icon name="editar" size={17} /></button>
                    </>}
                  </td>
                </tr>
                );
              })}
              {datos && !agentes.length && <tr><td colSpan={5} className="vacio">{retirados && !mostrarRetirados ? "No hay asesores activos. Activa “Mostrar retirados” para revisar o reactivar cuentas." : "Aún no hay asesores. Crea el primero con “Nuevo asesor”."}</td></tr>}
              {!datos && [1, 2, 3].map((i) => <tr key={i}><td colSpan={5}><div className="esqueleto" style={{ height: 16 }} /></td></tr>)}
            </tbody>
          </table>
        </div>
      </article>

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
          ocupado={estadoRetiro.ocupado}
          error={estadoRetiro.error}
          onConfirmar={confirmarRetiro}
          onCerrar={() => setRetirar(null)}
        />
      )}
    </section>
  );
}
