import { useMemo, useState } from "react";
import * as adminApi from "../../api/admin.api";
import { listarSedes } from "../../api/catalogo.api";
import Dropdown from "../ui/Dropdown";
import { teclasPestanas } from "../../hooks/useAccesibilidad";
import Icon from "../ui/Icon";
import { Confirmar, Modal } from "../ui/Modal";
import PanelDetalle, { Datos } from "../ui/PanelDetalle";
import { useToast } from "../../hooks/useToast";
import usePolling from "../../hooks/usePolling";
import Encabezado from "../layout/Encabezado";
import { fechaHora } from "../../utils/formatters";
import TablaSeccion, { EnlaceDetalle, Estado } from "./TablaSeccion";

const ROLES = {
  ADMIN: {
    nombre: "Administrador",
    tono: "admin",
    permisos: ["Todo el panel", "Crear y editar sedes, trámites y usuarios", "Ver la actividad del sistema"],
  },
  SUPERVISOR: {
    nombre: "Supervisor",
    tono: "super",
    permisos: ["Ver resumen, historial, sedes y asesores", "No puede modificar nada"],
  },
  AGENTE: {
    nombre: "Asesor",
    tono: "asesor",
    permisos: ["Consola de atención de su sede", "Llamar, atender y cerrar turnos"],
  },
};

function hace(iso) {
  if (!iso) return "Nunca";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "Ayer" : `Hace ${d} días`;
}

function ClaveTemporal({ titulo, usuario, clave, onCerrar }) {
  const avisar = useToast();
  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave);
      avisar("Contraseña copiada.");
    } catch {
      avisar("Selecciónala y cópiala manualmente.", "error");
    }
  }
  return (
    <Modal titulo={titulo} descripcion={`${usuario.nombre} · ${usuario.correo}`} onCerrar={onCerrar} ancho={440}
      pie={<button className="btn btn--primario" onClick={onCerrar}>Listo, ya la compartí</button>}>
      <p className="modal__texto">Entrégale esta contraseña temporal. Al ingresar, el sistema le pedirá crear una propia.</p>
      <div className="clave-temporal">
        <span>{clave}</span>
        <button className="icono-btn" onClick={copiar} title="Copiar" aria-label="Copiar contraseña"><Icon name="copiar" size={17} /></button>
      </div>
      <p className="nota-segura"><Icon name="alerta" size={16} /> Por seguridad no se volverá a mostrar. Si se pierde, restablécela de nuevo.</p>
    </Modal>
  );
}

function SelectorRol({ valor, onChange, bloqueado }) {
  return (
    <div className="roles" role="radiogroup" aria-label="Rol">
      {Object.entries(ROLES).map(([clave, r]) => (
        <button
          key={clave}
          type="button"
          role="radio"
          aria-checked={valor === clave}
          disabled={bloqueado && valor !== clave}
          className={`rol-op rol-op--${r.tono} ${valor === clave ? "activo" : ""}`}
          onClick={() => onChange(clave)}
        >
          <strong>{r.nombre}</strong>
          <ul>{r.permisos.map((p) => <li key={p}>{p}</li>)}</ul>
        </button>
      ))}
    </div>
  );
}

function FormularioUsuario({ inicial, sedes, yo, onCerrar, onGuardado }) {
  const editando = Boolean(inicial?.id);
  const esYo = inicial?.id === yo;
  const [form, setForm] = useState({
    nombre: inicial?.nombre || "",
    correo: inicial?.correo || "",
    rol: inicial?.rol || "AGENTE",
    punto_id: inicial?.punto_asignado_id ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    if (form.nombre.trim().length < 3) return setError("Escribe el nombre completo.");
    if (!/^\S+@\S+\.\S+$/.test(form.correo.trim())) return setError("Escribe un correo válido.");
    const cuerpo = { nombre: form.nombre.trim(), correo: form.correo.trim() };
    if (!esYo) cuerpo.rol = form.rol;
    if (form.rol === "AGENTE") cuerpo.punto_id = form.punto_id === "" ? null : Number(form.punto_id);
    setGuardando(true);
    setError("");
    try {
      const r = editando ? await adminApi.actualizarUsuario(inicial.id, cuerpo) : await adminApi.crearUsuario(cuerpo);
      onGuardado(r, editando);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={editando ? "Editar usuario" : "Nuevo usuario"}
      descripcion={editando ? "Los cambios de rol aplican de inmediato, incluso con la sesión abierta." : "Se generará una contraseña temporal que deberá cambiar al ingresar."}
      onCerrar={onCerrar}
      ancho={620}
      pie={
        <>
          <button type="button" className="btn btn--suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-usuario" className="btn btn--primario" disabled={guardando}>
            {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear usuario"}
          </button>
        </>
      }
    >
      <form id="form-usuario" className="formulario" onSubmit={guardar}>
        <div className="formulario__fila">
          <label>
            <span className="etiqueta">Nombre completo</span>
            <span className="campo"><Icon name="usuario" size={17} /><input value={form.nombre} onChange={cambiar("nombre")} maxLength={100} /></span>
          </label>
          <label>
            <span className="etiqueta">Correo de acceso</span>
            <span className="campo"><input type="email" value={form.correo} onChange={cambiar("correo")} maxLength={120} placeholder="nombre@filacero.co" /></span>
          </label>
        </div>
        <div>
          <span className="etiqueta">Rol y permisos {esYo && <small className="tenue">(no puedes cambiar tu propio rol)</small>}</span>
          <SelectorRol valor={form.rol} bloqueado={esYo} onChange={(rol) => setForm((f) => ({ ...f, rol }))} />
        </div>
        {form.rol === "AGENTE" && (
          <Dropdown label="Sede donde atiende" icon="edificio" value={form.punto_id}
            options={[{ value: "", label: "Sin sede asignada" }, ...sedes.filter((s) => s.activo).map((s) => ({ value: s.id, label: s.nombre }))]}
            onChange={(v) => setForm((f) => ({ ...f, punto_id: v }))} />
        )}
        {error && <p className="rv__error" role="alert"><Icon name="alerta" size={16} /> {error}</p>}
      </form>
    </Modal>
  );
}

export default function Usuarios({ titulo }) {
  const avisar = useToast();
  const [filtroRol, setFiltroRol] = useState("");
  const [buscar, setBuscar] = useState("");
  const [editar, setEditar] = useState(null);
  const [restablecer, setRestablecer] = useState(null);
  const [eliminar, setEliminar] = useState(null);
  const [estadoAccion, setEstadoAccion] = useState({ ocupado: false, error: "" });
  const [clave, setClave] = useState(null);
  const [detalleId, setDetalleId] = useState(null);

  const { datos, error, actualizado, refrescar, setDatos } = usePolling(async () => {
    const [u, sedes] = await Promise.all([adminApi.listarUsuarios(), listarSedes({ todos: true })]);
    return { ...u, sedes };
  }, 20000);

  const usuarios = useMemo(() => {
    const f = buscar.trim().toLowerCase();
    return (datos?.usuarios || []).filter((u) =>
      (!filtroRol || u.rol === filtroRol) && (!f || `${u.nombre} ${u.correo}`.toLowerCase().includes(f)));
  }, [datos, filtroRol, buscar]);

  const conteo = (datos?.usuarios || []).reduce((acc, u) => ({ ...acc, [u.rol]: (acc[u.rol] || 0) + 1 }), {});
  const detalle = (datos?.usuarios || []).find((u) => u.id === detalleId) || null;

  async function alternar(u, activo) {
    setDatos((d) => ({ ...d, usuarios: d.usuarios.map((x) => (x.id === u.id ? { ...x, activo } : x)) }));
    try {
      await adminApi.actualizarUsuario(u.id, { activo });
      avisar(activo ? `${u.nombre} puede ingresar de nuevo.` : `${u.nombre} ya no puede ingresar.`);
    } catch (e) {
      avisar(e.message, "error");
    }
    refrescar();
  }

  async function confirmarRestablecer() {
    setEstadoAccion({ ocupado: true, error: "" });
    try {
      const r = await adminApi.restablecerClave(restablecer.id);
      setClave({ titulo: "Contraseña restablecida", usuario: restablecer, clave: r.clave_temporal });
      setRestablecer(null);
      setEstadoAccion({ ocupado: false, error: "" });
      refrescar();
    } catch (e) {
      setEstadoAccion({ ocupado: false, error: e.message });
    }
  }

  async function confirmarEliminar() {
    setEstadoAccion({ ocupado: true, error: "" });
    try {
      const r = await adminApi.eliminarUsuario(eliminar.id);
      avisar(r?.mensaje || `${eliminar.nombre} eliminado.`);
      if (detalleId === eliminar.id) setDetalleId(null);
      setEliminar(null);
      setEstadoAccion({ ocupado: false, error: "" });
      refrescar();
    } catch (e) {
      setEstadoAccion({ ocupado: false, error: e.message });
    }
  }

  const esYoId = (u) => u.id === datos?.yo;
  const pedir = (setter) => (u) => { setter(u); setEstadoAccion({ ocupado: false, error: "" }); };

  const filas = usuarios.map((u) => {
    const r = ROLES[u.rol] || {};
    const esYo = esYoId(u);
    return {
      id: u.id,
      inactivo: !u.activo,
      celdas: [
        <EnlaceDetalle key="n" texto={`${u.nombre}${esYo ? " (tú)" : ""}`} avatar={u.nombre[0]} onClick={() => setDetalleId(u.id)} />,
        <span key="r" className={`rol rol--${r.tono}`}>{r.nombre}</span>,
        u.rol === "AGENTE" ? (u.sede || <span key="k1" className="tenue">Sin sede</span>) : <span key="k2" className="tenue">No aplica</span>,
        <span key="a" title={u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString("es-CO") : undefined}>{hace(u.ultimo_acceso)}</span>,
        <Estado key="e" tono={u.activo ? "ok" : "cancelado"}>{u.activo ? "Activo" : "Bloqueado"}</Estado>,
        <>
          <button className="icono-btn" title="Editar datos y rol" aria-label={`Editar ${u.nombre}`} onClick={() => setEditar(u)}><Icon name="editar" size={17} /></button>
          <button className="icono-btn" title={esYo ? "Usa “Cambiar mi contraseña”" : "Restablecer contraseña"} aria-label={`Restablecer contraseña de ${u.nombre}`} disabled={esYo} onClick={() => pedir(setRestablecer)(u)}><Icon name="llave" size={17} /></button>
          <button className="icono-btn icono-btn--peligro" title={esYo ? "No puedes eliminar tu propia cuenta" : u.protegida ? "Cuenta protegida" : "Eliminar cuenta"} aria-label={`Eliminar a ${u.nombre}`} disabled={esYo || u.protegida} onClick={() => pedir(setEliminar)(u)}><Icon name="eliminar" size={17} /></button>
        </>,
      ],
    };
  });

  const rolDetalle = detalle ? ROLES[detalle.rol] || {} : null;
  const yoDetalle = detalle ? esYoId(detalle) : false;

  return (
    <section className="adm__seccion">
      <Encabezado titulo={titulo} detalle="Cuentas del personal y lo que cada rol puede hacer. Haz clic en un usuario para ver sus permisos." actualizado={actualizado} error={error}>
        <button className="btn btn--primario" onClick={() => setEditar({})}><Icon name="mas" size={17} /> Nuevo usuario</button>
      </Encabezado>

      <article className="panel panel--tabla">
        <div className="barra-tabla barra-tabla--filtros">
          <label className="campo campo--buscar">
            <Icon name="buscar" size={16} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre o correo" aria-label="Buscar usuario" />
          </label>
          <div className="segmentos" role="tablist" aria-label="Filtrar por rol" onKeyDown={teclasPestanas}>
            <button role="tab" tabIndex={!filtroRol ? 0 : -1} aria-selected={!filtroRol} className={!filtroRol ? "activo" : ""} onClick={() => setFiltroRol("")}>Todos</button>
            {Object.entries(ROLES).map(([k, r]) => (
              <button key={k} role="tab" tabIndex={filtroRol === k ? 0 : -1} aria-selected={filtroRol === k} className={filtroRol === k ? "activo" : ""} onClick={() => setFiltroRol(k)}>
                {r.nombre} <small>{conteo[k] || 0}</small>
              </button>
            ))}
          </div>
        </div>
        <TablaSeccion
          etiqueta={titulo}
          columnas={["Usuario", "Rol", "Sede", "Último acceso", "Estado", ""]}
          alinear={["left", "center", "left", "center", "center", "right"]}
          filas={filas}
          cargando={!datos}
          vacio="Ningún usuario con ese filtro."
        />
      </article>

      {detalle && (
        <PanelDetalle
          titulo={detalle.nombre + (yoDetalle ? " (tú)" : "")}
          subtitulo={detalle.correo}
          insignia={<>
            <span className={`rol rol--${rolDetalle.tono}`}>{rolDetalle.nombre}</span>
            <Estado tono={detalle.activo ? "ok" : "cancelado"}>{detalle.activo ? "Activo" : "Bloqueado"}</Estado>
            {detalle.protegida && <span className="insignia-protegida"><Icon name="escudo" size={12} /> Protegida</span>}
          </>}
          onCerrar={() => setDetalleId(null)}
          acciones={<>
            <button className="btn btn--suave" onClick={() => setEditar(detalle)}><Icon name="editar" size={16} /> Editar</button>
            <button className="btn btn--suave" disabled={yoDetalle} onClick={() => pedir(setRestablecer)(detalle)}><Icon name="llave" size={16} /> Restablecer clave</button>
            <button className="btn btn--suave" disabled={yoDetalle || detalle.protegida} onClick={() => alternar(detalle, !detalle.activo)}>
              <Icon name="encender" size={16} /> {detalle.activo ? "Bloquear acceso" : "Permitir acceso"}
            </button>
            <button className="btn btn--peligro" disabled={yoDetalle || detalle.protegida} onClick={() => pedir(setEliminar)(detalle)}><Icon name="eliminar" size={16} /> Eliminar</button>
          </>}
        >
          <section className="detalle__bloque">
            <h3>Permisos del rol</h3>
            <ul className="detalle__lista">{(rolDetalle.permisos || []).map((p) => <li key={p}>{p}</li>)}</ul>
          </section>
          <Datos
            titulo="Cuenta"
            filas={[
              ["Correo de acceso", detalle.correo],
              detalle.rol === "AGENTE" && ["Sede", detalle.sede || "Sin sede"],
              detalle.rol === "AGENTE" && ["Módulo", detalle.modulo || "Sin módulo"],
              ["Último acceso", detalle.ultimo_acceso ? fechaHora(detalle.ultimo_acceso) : "Nunca"],
              ["Contraseña", detalle.debe_cambiar_clave ? "Temporal (debe cambiarla)" : "Propia"],
              ["Creada", detalle.fecha_creacion ? fechaHora(detalle.fecha_creacion) : null],
            ]}
          />
        </PanelDetalle>
      )}

      {editar && (
        <FormularioUsuario
          inicial={editar}
          sedes={datos?.sedes || []}
          yo={datos?.yo}
          onCerrar={() => setEditar(null)}
          onGuardado={(r, editando) => {
            setEditar(null);
            refrescar();
            if (r.clave_temporal) setClave({ titulo: "Usuario creado", usuario: r.usuario, clave: r.clave_temporal });
            else avisar(`${r.usuario?.nombre} ${editando ? "actualizado" : "creado"}.`);
          }}
        />
      )}

      {restablecer && (
        <Confirmar
          titulo="Restablecer contraseña"
          mensaje={`Se generará una contraseña temporal para ${restablecer.nombre}. Su contraseña actual dejará de funcionar y deberá crear una nueva al ingresar.`}
          textoConfirmar="Restablecer"
          peligro={false}
          ocupado={estadoAccion.ocupado}
          error={estadoAccion.error}
          onConfirmar={confirmarRestablecer}
          onCerrar={() => setRestablecer(null)}
        />
      )}

      {eliminar && (
        <Confirmar
          titulo="Eliminar cuenta"
          mensaje={`¿Eliminar definitivamente la cuenta de ${eliminar.nombre}? No podrá volver a ingresar y desaparecerá de la lista. Su historial de atenciones y la bitácora se conservan. Si solo quieres pausar el acceso, usa “Bloquear acceso”.`}
          textoConfirmar="Eliminar cuenta"
          ocupado={estadoAccion.ocupado}
          error={estadoAccion.error}
          onConfirmar={confirmarEliminar}
          onCerrar={() => setEliminar(null)}
        />
      )}

      {clave && <ClaveTemporal {...clave} onCerrar={() => setClave(null)} />}
    </section>
  );
}
