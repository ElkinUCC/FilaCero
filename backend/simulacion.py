"""FilaCero · Simulación de un centro de reparación de televisores.

Un solo archivo para todo lo que necesitas antes de la demo:

  1) CARGAR DATOS DEMO (reemplaza solo los datos operativos del tenant seleccionado)
       python simulacion.py --cargar
       python simulacion.py --cargar --si                       # sin preguntar
       python simulacion.py --cargar --desde 2026-10-25 --hasta 2026-10-30
       python simulacion.py --cargar --dias 15                  # 15 días, ~1200 turnos
       python simulacion.py --cargar --dias 15 --turnos 0       # operación completa (pesado)

     Por defecto simula los 6 días anteriores a hoy (si hoy es 31 de octubre:
     del 25 al 30), más el día de hoy hasta la hora actual y una cola de
     turnos pendientes para hoy y mañana, así la consola del asesor tiene
     gente esperando.

     Algunos días un asesor rota a otra sede (queda en la Actividad).
     Las cuentas de CUENTAS_PROTEGIDAS (.env) se conservan con su contraseña.

  2) SOLO BORRAR todos los registros
       python simulacion.py --borrar

  3) EN VIVO durante la presentación (reservas llegando solas, Ctrl+C para)
       python simulacion.py --en-vivo
       python simulacion.py --en-vivo --cada 10 --por-ciclo 3  # 3 turnos por ciclo

  4) PRUEBA DE CARGA contra el servidor encendido (evidencia de rendimiento)
       python simulacion.py --carga --url http://127.0.0.1:5000 --usuarios 40 --segundos 20
     El servidor local debe correr con RATE_LIMIT_ACTIVO=false y
     FILACERO_OTP_TEST_MODE=true. El modo OTP de prueba solo funciona desde localhost.

  5) VERIFICAR que todo funciona (no toca tu base de datos)
       python simulacion.py
       python simulacion.py --url http://127.0.0.1:5000        # contra el servidor
                                                                # (requiere --cargar antes)

  6) REVISAR LAS CUENTAS PROTEGIDAS (no modifica nada salvo con --desbloquear)
       python simulacion.py --cuentas                  # existe, rol, activa, bloqueada...
       python simulacion.py --cuentas --probar-clave   # además prueba la contraseña
       python simulacion.py --cuentas --desbloquear    # quita el bloqueo por intentos fallidos
     Para crear una cuenta protegida o cambiarle la contraseña:
       python scripts/crear_cuenta.py correo@filacero.co ADMIN "Nombre"

El negocio simulado: TecniVisión, 4 sedes, 2 administradores, 1 supervisor y 8 asesores.
Atención todos los días, 24 horas, en franjas de 30 min, máximo
10 min por persona (3 cupos por asesor y franja). Los clientes son
personas ficticias que reservan con su celular, sin registrarse.
"""

import argparse
import json
import os
import random
import secrets
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, date, datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

VERDE, ROJO, AMBAR, GRIS, NEGRITA, FIN = (
    "\033[32m",
    "\033[31m",
    "\033[33m",
    "\033[90m",
    "\033[1m",
    "\033[0m",
)
if os.name == "nt":
    os.system("")  # habilita colores en la consola de Windows
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# ======================================================================
# DATOS DEL NEGOCIO SIMULADO
# ======================================================================

# En un servidor público cambia estas claves con variables de entorno.
CLAVE_ADMIN = os.getenv("SIM_CLAVE_ADMIN", "Admin12345")
CLAVE_ASESOR = os.getenv("SIM_CLAVE_ASESOR", "Asesor12345")
CLAVE_SUPERVISOR = os.getenv("SIM_CLAVE_SUPERVISOR") or secrets.token_urlsafe(18)

SEDES = [
    ("Sede Centro", "Cra. 50 # 52-20, Centro, Medellín"),
    ("Sede El Poblado", "Cl. 10 # 43D-30, El Poblado, Medellín"),
    ("Sede Itagüí", "Cra. 50A # 50-45, Itagüí, Antioquia"),
    ("Sede Laureles", "Cra. 76 # 33A-15, Laureles, Medellín"),
]

# nombre, descripción, minutos estimados (máx. 10 por regla), peso de demanda
SERVICIOS = [
    (
        "Diagnóstico de televisor",
        "Revisión técnica del equipo y cotización de la reparación.",
        10,
        30,
    ),
    (
        "Reparación de pantalla",
        "Recepción de equipos con pantalla, panel o retroiluminación dañada.",
        10,
        20,
    ),
    (
        "Garantía de televisor",
        "Ingreso a garantía de televisores con máximo 1 año desde la compra.",
        8,
        10,
    ),
    (
        "Reclamos",
        "Seguimiento presencial de un reclamo radicado (también puede radicarse en línea).",
        6,
        3,
    ),
    ("Entrega de equipo reparado", "Prueba del televisor frente al cliente y entrega.", 5, 25),
    (
        "Cotización de repuestos",
        "Consulta de precio y disponibilidad de tarjetas, fuentes y controles.",
        5,
        13,
    ),
]

# Trámites que se alistan ANTES de que llegue el cliente (preparación previa):
# el equipo reparado se prueba y empaca y la garantía se revisa con la factura.
# Lo decide el tipo de atención (ENTREGA o GARANTIA), no el nombre.
SERVICIOS_CON_PREPARACION = {
    "Entrega de equipo reparado",
    "Garantía de televisor",
}
# Cómo se reserva cada trámite (ver ADR-013): los demás son GENERAL.
FLUJOS_SERVICIO = {
    "Entrega de equipo reparado": "ENTREGA",
    "Garantía de televisor": "GARANTIA",
    "Reclamos": "RECLAMO",
}
MARCAS_TV = ["Samsung", "LG", "Sony", "TCL", "Hisense", "Kalley", "Challenger", "Xiaomi"]
MODELOS_TV = ['55" 4K UHD', '43" Full HD', '50" QLED', '65" OLED', '32" Smart TV', '58" 4K']
FALLAS_TV = [
    "No enciende, el led parpadea",
    "Pantalla con líneas verticales",
    "Tiene sonido pero no imagen",
    "Se apaga solo después de unos minutos",
    "No conecta a WiFi",
    "Mancha oscura en una esquina",
]
NOTAS_EQUIPO = {
    "RECIBIDO": "Recibido en sede. Pasa a diagnóstico hoy.",
    "EN_REPARACION": "Se cambia la tarjeta T-CON; esperamos el repuesto.",
    "LISTO": "Probado durante 2 horas. Listo para entregar.",
    "ENTREGADO": "Entregado y probado frente al cliente.",
    "POR_RECIBIR": "Pendiente de que el cliente lo traiga a la sede.",
}
RECLAMOS_DEMO = [
    (
        "DEMORA",
        "La reparación de mi televisor lleva más de 10 días y no me han dado fecha de entrega.",
    ),
    (
        "REPARACION",
        "Recogí el televisor la semana pasada y volvió a presentar la misma falla de imagen.",
    ),
    (
        "ATENCION",
        "En la sede no me explicaron bien el diagnóstico y me cobraron la revisión dos veces.",
    ),
    ("COBRO", "La factura de la reparación tiene un valor diferente al de la cotización aprobada."),
]
# Cliente para la demostración: reserva la entrega de su televisor listo.
CLIENTE_DEMO = ("Juliana Restrepo Arango", "3001112233", "1037654321")
PRESENCIAS_DEMO = {1: "ALMUERZO", 3: "PAUSA", 6: "AUSENTE"}  # índice en ASESORES
NOTAS_LISTO = [
    "Tu equipo ya fue probado y está empacado. Solo trae tu documento.",
    "La revisión de garantía está lista; te explicamos el resultado en el módulo.",
    "La cotización quedó impresa con precios y disponibilidad de repuestos.",
    "Todo listo: firma de entrega y prueba del equipo frente a ti.",
]
NOTAS_NOVEDAD = [
    "El repuesto llega mañana a las 10:00; puedes reprogramar sin costo.",
    "Falta la factura original para validar la garantía; tráela por favor.",
]

ADMINS = [
    ("Laura Gómez Arango", "laura.gomez@filacero.co"),
    ("Andrés Restrepo Mejía", "andres.restrepo@filacero.co"),
]
ADMIN_CORREO = ADMINS[0][1]
SUPERVISORES = [("María Fernanda Giraldo", "supervisora@filacero.co")]

# nombre, correo, índice de sede (8 asesores: 2 por sede)
ASESORES = [
    ("Carlos Mejía", "carlos.mejia@filacero.co", 0),
    ("Diana Ospina", "diana.ospina@filacero.co", 0),
    ("Julián Cárdenas", "julian.cardenas@filacero.co", 1),
    ("Natalia Herrera", "natalia.herrera@filacero.co", 1),
    ("Mauricio Vélez", "mauricio.velez@filacero.co", 2),
    ("Paola Zuluaga", "paola.zuluaga@filacero.co", 2),
    ("Santiago Ríos", "santiago.rios@filacero.co", 3),
    ("Valeria Montes", "valeria.montes@filacero.co", 3),
]
ASESOR_DEMO = ASESORES[0][1]

NOMBRES = [
    "Ana",
    "Luis",
    "María",
    "Jorge",
    "Camila",
    "Andrés",
    "Sofía",
    "Juan",
    "Valentina",
    "Felipe",
    "Daniela",
    "Mateo",
    "Isabela",
    "Sebastián",
    "Mariana",
    "Alejandro",
    "Gabriela",
    "Esteban",
    "Paula",
    "David",
    "Laura",
    "Óscar",
    "Sara",
    "Ricardo",
    "Juliana",
    "Hernán",
    "Catalina",
    "Tomás",
    "Luisa",
    "Miguel",
    "Manuela",
    "Fernando",
    "Carolina",
    "Diego",
    "Verónica",
    "Samuel",
    "Lina",
    "Iván",
]
APELLIDOS = [
    "García",
    "Rodríguez",
    "López",
    "Martínez",
    "Gómez",
    "Restrepo",
    "Muñoz",
    "Álvarez",
    "Arango",
    "Vargas",
    "Castaño",
    "Henao",
    "Zapata",
    "Correa",
    "Ramírez",
    "Cardona",
    "Giraldo",
    "Duque",
    "Mejía",
    "Ospina",
    "Salazar",
    "Quintero",
    "Londoño",
    "Echeverri",
    "Betancur",
    "Posada",
    "Toro",
]

DIAS_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES_ES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
]

# Demanda relativa por hora del día y día de la semana (0 = lunes)
DEMANDA_HORA = {
    0: 0.08,
    1: 0.06,
    2: 0.04,
    3: 0.04,
    4: 0.05,
    5: 0.08,
    6: 0.15,
    7: 0.3,
    8: 0.45,
    9: 0.7,
    10: 0.95,
    11: 0.95,
    12: 0.55,
    13: 0.6,
    14: 0.8,
    15: 0.9,
    16: 0.85,
    17: 0.55,
    18: 0.5,
    19: 0.4,
    20: 0.3,
    21: 0.22,
    22: 0.15,
    23: 0.1,
}
DEMANDA_DIA = {0: 1.0, 1: 0.9, 2: 0.9, 3: 0.95, 4: 1.0, 5: 0.8, 6: 0.5}


# ======================================================================
# CARGA DE DATOS DEMO EN LA BASE DE DATOS
# ======================================================================


def borrar_todo(db, organizacion_id=None):
    """Elimina SOLO datos operativos del tenant indicado; nunca organizaciones.

    La versión anterior truncaba todas las tablas, incluida `organizaciones`,
    y además borraba datos de otros tenants. Esta versión usa DELETE filtrado
    por organizacion_id y conserva intacto el catálogo multiempresa.
    """
    from flask import g, has_app_context

    tenant_id = (
        organizacion_id or (getattr(g, "organizacion_id", None) if has_app_context() else None) or 1
    )
    db.session.rollback()
    tablas = [
        tabla
        for tabla in reversed(db.metadata.sorted_tables)
        if tabla.name != "organizaciones" and "organizacion_id" in tabla.c
    ]
    with db.engine.begin() as con:
        for tabla in tablas:
            con.execute(tabla.delete().where(tabla.c.organizacion_id == int(tenant_id)))
    db.session.expire_all()
    return [t.name for t in tablas]


def _asegurar_organizacion_simulacion(app, db):
    """Resuelve el tenant configurado o lo crea si fue borrado por una versión anterior."""
    from app.dominios.organizaciones.modelos import Organizacion

    slug = (app.config.get("DEFAULT_ORGANIZATION_SLUG") or "filacero-demo").strip().lower()
    organizacion = Organizacion.query.filter_by(slug=slug).first()
    if organizacion is None:
        # Recuperación del catálogo tenant tras el truncado accidental de la
        # versión anterior. No se inventa una organización si hay un slug ya
        # ocupado ni se modifica ninguna organización existente.
        organizacion = Organizacion(
            nombre=app.config.get("DEFAULT_ORGANIZATION_NAME", "FilaCero Demo"),
            slug=slug,
            industria="general",
            pais="CO",
            zona_horaria="America/Bogota",
            idioma="es",
            moneda="COP",
            plan="essential",
            estado="activa",
            configuracion={},
        )
        db.session.add(organizacion)
        db.session.commit()
    if not organizacion.activa:
        raise RuntimeError(f"La organización '{slug}' está inactiva; no se ejecutó la simulación.")
    return organizacion


def crear_catalogo(db):
    from app.dominios.sedes.modelos import Punto
    from app.dominios.tramites.modelos import Tramite
    from app.dominios.usuarios.modelos import Usuario
    from app.seguridad import encriptar_password

    def crear(modelo, filtro, **valores):
        obj = modelo.query.filter_by(**filtro).first()
        if not obj:
            obj = modelo(**filtro, **valores)
            db.session.add(obj)
            db.session.flush()
        return obj

    sedes = [crear(Punto, {"nombre": n}, direccion=d, activo=True) for n, d in SEDES]
    servicios = [
        crear(Tramite, {"nombre": n}, descripcion=d, tiempo_estimado=m, activo=True)
        for n, d, m, _ in SERVICIOS
    ]
    for servicio in servicios:
        servicio.requiere_preparacion = servicio.nombre in SERVICIOS_CON_PREPARACION
        servicio.tipo_flujo = FLUJOS_SERVICIO.get(servicio.nombre, "GENERAL")
    clave_admin = encriptar_password(CLAVE_ADMIN)
    clave_asesor = encriptar_password(CLAVE_ASESOR)
    admins = [
        crear(Usuario, {"correo": c}, nombre=n, rol="ADMIN", activo=True, password_hash=clave_admin)
        for n, c in ADMINS
    ]
    clave_supervisor = encriptar_password(CLAVE_SUPERVISOR)
    supervisores = [
        crear(
            Usuario,
            {"correo": c},
            nombre=n,
            rol="SUPERVISOR",
            activo=True,
            password_hash=clave_supervisor,
        )
        for n, c in SUPERVISORES
    ]
    asesores = [
        crear(
            Usuario,
            {"correo": c},
            nombre=n,
            rol="AGENTE",
            activo=True,
            punto_asignado_id=sedes[i].id,
            password_hash=clave_asesor,
        )
        for n, c, i in ASESORES
    ]
    # Cada asesor atiende en un módulo de su sede (Módulo 1, Módulo 2...).
    por_sede = {}
    for asesor in asesores:
        por_sede[asesor.punto_asignado_id] = por_sede.get(asesor.punto_asignado_id, 0) + 1
        asesor.modulo = f"Módulo {por_sede[asesor.punto_asignado_id]}"
    db.session.commit()
    return {
        "sedes": sedes,
        "servicios": servicios,
        "admins": admins,
        "supervisores": supervisores,
        "asesores": asesores,
    }


def _clientes(db, rnd, cantidad=160):
    from app.dominios.usuarios.modelos import Usuario

    usados, clientes = set(), []
    while len(clientes) < cantidad:
        prefijo = rnd.choice(["00", "01", "04", "10", "12", "15", "20", "21"])
        celular = f"3{prefijo}{rnd.randint(1000000, 9999999)}"
        if celular in usados:
            continue
        usados.add(celular)
        nombre = f"{rnd.choice(NOMBRES)} {rnd.choice(APELLIDOS)} {rnd.choice(APELLIDOS)}"
        cliente = Usuario.query.filter_by(celular=celular, rol="CLIENTE").first() or Usuario(
            nombre=nombre,
            correo=f"cliente_{celular}@publico.filacero.local",
            password_hash="",
            rol="CLIENTE",
            celular=celular,
            activo=True,
        )
        # Cédula inventada (datos de prueba): se exige al recoger un equipo.
        if not cliente.documento:
            cliente.documento = str(rnd.randint(10_000_000, 1_299_999_999))
        db.session.add(cliente)
        clientes.append(cliente)
    db.session.commit()
    return clientes


def cargar_semana(
    db, desde, hasta, semilla=None, con_hoy=True, con_manana=True, turnos_objetivo=None
):
    """Simula la operación día a día respetando las reglas de FilaCero."""
    from app.dominios.auditoria.modelos import Auditoria
    from app.dominios.franjas.modelos import Franja
    from app.dominios.turnos.modelos import Turno
    from app.horario import (
        ahora_local,
        apertura,
        asegurar_franjas,
        capacidad_sede,
        cierre,
        dia_habil,
        zona,
    )

    rnd = random.Random(semilla)
    datos = crear_catalogo(db)
    clientes = _clientes(db, rnd)
    ahora = ahora_local()
    hoy = ahora.date()
    utc = lambda d: d.astimezone(UTC).replace(tzinfo=None)  # noqa: E731
    pesos = [s[3] for s in SERVICIOS]
    codigos = {codigo for (codigo,) in Turno.query.with_entities(Turno.codigo).all()}
    totales = {"ATENDIDO": 0, "NO_ASISTIO": 0, "CANCELADO": 0, "ESPERANDO": 0}

    dias = []
    d = desde
    while d <= hasta:
        dias.append(d)
        d += timedelta(days=1)
    if con_hoy and hoy not in dias and hoy > hasta:
        dias.append(hoy)
    if con_manana:
        dias.append(hoy + timedelta(days=1))

    # Horas de inicio de las franjas del día, incluida la última parcial (23:30–23:59).
    paso = timedelta(minutes=30)
    limite_dia = datetime.combine(hoy, cierre())
    horas_dia, cursor = [], datetime.combine(hoy, apertura())
    while cursor < limite_dia:
        horas_dia.append(cursor.time())
        cursor = min(cursor + paso, limite_dia)

    # Volumen: los días pasados se escalan para sumar ~turnos_objetivo (más
    # liviano en MySQL). Hoy y mañana conservan una cola realista para la demo.
    escala_pasado = 1.0
    if turnos_objetivo:
        por_dia = sum(
            3 * sum(1 for a in datos["asesores"] if a.punto_asignado_id == s.id)
            for s in datos["sedes"]
        ) * sum(DEMANDA_HORA.get(h.hour, 0.6) for h in horas_dia)
        esperado = sum(por_dia * DEMANDA_DIA[d.weekday()] * 0.925 for d in dias if d < hoy)
        escala_pasado = min(1.0, turnos_objetivo / esperado) if esperado else 1.0

    def cantidad(cupo, factor):
        """Cantidad entera con redondeo probabilístico (evita franjas siempre vacías)."""
        esperado = cupo * factor * rnd.uniform(0.7, 1.15)
        n = int(esperado) + (1 if rnd.random() < esperado - int(esperado) else 0)
        return max(0, min(cupo, n))

    def nuevo_codigo(fecha_solicitud):
        while True:
            c = f"FC-{fecha_solicitud:%Y%m%d}-{rnd.getrandbits(24):06X}"
            if c not in codigos:
                codigos.add(c)
                return c

    base = {a.id: a.punto_asignado_id for a in datos["asesores"]}

    for fecha in dias:
        futuro = fecha > hoy
        rotaciones = _rotar_asesores(db, datos, base, fecha, hoy, rnd)
        for sede in datos["sedes"]:
            cupo = capacidad_sede(sede.id)
            if fecha >= hoy:
                # Hoy y mañana: todas las franjas (para poder reservar en vivo)
                for servicio in datos["servicios"]:
                    asegurar_franjas(sede, servicio, fecha)
                franjas = {
                    (f.tramite_id, f.hora_inicio): f
                    for f in Franja.query.filter_by(punto_id=sede.id, fecha=fecha).all()
                }
                horas = sorted({h for _, h in franjas})
            else:
                # Días pasados: solo se crean las franjas que tienen turnos (rápido)
                franjas = {}
                horas = horas_dia if dia_habil(fecha) else []
            asesores = [a for a in datos["asesores"] if a.punto_asignado_id == sede.id]
            # Algunos días un asesor abre tarde su puesto (tráfico, reunión...):
            # es lo que en la vida real genera los pocos turnos fuera de franja.
            libre = (
                {
                    a.id: datetime.combine(fecha, horas[0], tzinfo=zona())
                    + timedelta(minutes=rnd.uniform(30, 55) if rnd.random() < 0.15 else 0)
                    for a in asesores
                }
                if horas
                else {}
            )

            for hora in horas:
                inicio_f = datetime.combine(fecha, hora, tzinfo=zona())
                factor = DEMANDA_HORA.get(hora.hour, 0.6) * DEMANDA_DIA[fecha.weekday()]
                if futuro:
                    factor *= 0.3 if turnos_objetivo else 0.45
                elif fecha == hoy:
                    factor *= (0.5 if turnos_objetivo else 1.0) * (0.7 if inicio_f > ahora else 1)
                else:
                    factor *= escala_pasado
                n = cantidad(cupo, factor)
                if not n:
                    continue

                personas = rnd.sample(clientes, n)
                llegadas = sorted(
                    rnd.uniform(0, 6) if rnd.random() > 0.08 else rnd.uniform(8, 18)
                    for _ in range(n)
                )
                for cliente, llegada in zip(personas, llegadas, strict=True):
                    idx = rnd.choices(range(len(SERVICIOS)), weights=pesos)[0]
                    servicio = datos["servicios"][idx]
                    franja = franjas.get((servicio.id, hora))
                    if franja is None and fecha < hoy:
                        fin_h = min(
                            datetime.combine(fecha, hora) + paso,
                            datetime.combine(fecha, cierre()),
                        ).time()
                        franja = Franja(
                            punto_id=sede.id,
                            tramite_id=servicio.id,
                            fecha=fecha,
                            hora_inicio=hora,
                            hora_fin=fin_h,
                            capacidad=cupo,
                            activa=True,
                        )
                        db.session.add(franja)
                        franjas[(servicio.id, hora)] = franja
                    elif franja is None:  # sin esa franja: se toma otra del mismo horario
                        franja = next(f for (t, h), f in franjas.items() if h == hora)
                        servicio = next(s for s in datos["servicios"] if s.id == franja.tramite_id)

                    solicitud = inicio_f - timedelta(hours=rnd.uniform(1, 72))
                    if solicitud > ahora:
                        solicitud = ahora - timedelta(minutes=rnd.uniform(5, 120))
                    turno = Turno(
                        codigo=nuevo_codigo(solicitud.date()),
                        usuario_id=cliente.id,
                        tramite_id=servicio.id,
                        punto_id=sede.id,
                        franja=franja,
                        hora_solicitud=utc(solicitud),
                        estado="ESPERANDO",
                    )

                    llega = inicio_f + timedelta(minutes=llegada)
                    estado = rnd.choices(
                        ["ATENDIDO", "NO_ASISTIO", "CANCELADO"], weights=[86, 5, 9]
                    )[0]
                    if estado == "CANCELADO":
                        if inicio_f <= ahora:
                            turno.estado = "CANCELADO"
                    elif asesores:
                        asesor = min(asesores, key=lambda a: libre[a.id])
                        inicio = max(libre[asesor.id], llega)
                        if estado == "ATENDIDO":
                            if rnd.random() < 0.04:  # caso complejo: atrasa a los siguientes
                                minutos = rnd.uniform(11, 16)
                            else:
                                minutos = min(
                                    10.5, max(2.0, rnd.gauss(servicio.tiempo_estimado * 0.72, 1.4))
                                )
                            fin = inicio + timedelta(minutes=minutos)
                        else:
                            fin = inicio + timedelta(minutes=3)
                        if fin <= ahora:  # ya ocurrió
                            turno.estado = estado
                            turno.agente_id = asesor.id
                            turno.fecha_llamado = utc(
                                inicio - timedelta(seconds=rnd.randint(20, 70))
                            )
                            turno.fecha_inicio = utc(inicio) if estado == "ATENDIDO" else None
                            turno.fecha_fin = utc(fin)
                            pausa = rnd.choices([0, 1, 2], weights=[55, 30, 15])[0]
                            libre[asesor.id] = fin + timedelta(minutes=pausa)
                    _simular_preparacion(turno, servicio, asesores, rnd, ahora)
                    _simular_vinculos(turno, servicio, cliente, sede, asesores, rnd, ahora)
                    totales[turno.estado] += 1
                    db.session.add(turno)

        # Rotaciones del día en la bitácora (antes de abrir, 7:50 a. m.)
        for asesor, origen, destino in rotaciones:
            db.session.add(
                Auditoria(
                    fecha=utc(
                        datetime.combine(fecha, datetime.min.time(), tzinfo=zona())
                        + timedelta(hours=7, minutes=50)
                    ),
                    usuario_id=asesor.id,
                    accion="sede_cambiada",
                    detalle=f"{asesor.nombre}: {origen} → {destino}",
                    ip=f"192.168.1.{rnd.randint(10, 80)}",
                )
            )

        # Ingresos y salidas del personal ese día (para la sección Actividad)
        if fecha <= hoy:
            for persona in datos["admins"] + datos["asesores"]:
                if persona.rol == "ADMIN" and rnd.random() < 0.3:
                    continue
                entrada = datetime.combine(fecha, datetime.min.time(), tzinfo=zona()) + timedelta(
                    hours=7, minutes=rnd.randint(40, 75)
                )
                if entrada > ahora:
                    continue
                db.session.add(
                    Auditoria(
                        fecha=utc(entrada),
                        usuario_id=persona.id,
                        accion="login",
                        detalle=persona.rol,
                        ip=f"192.168.1.{rnd.randint(10, 80)}",
                    )
                )
                persona.ultimo_acceso = utc(entrada)
                salida = datetime.combine(fecha, datetime.min.time(), tzinfo=zona()) + timedelta(
                    hours=18, minutes=rnd.randint(2, 25)
                )
                if salida <= ahora:
                    db.session.add(
                        Auditoria(
                            fecha=utc(salida),
                            usuario_id=persona.id,
                            accion="logout",
                            ip=f"192.168.1.{rnd.randint(10, 80)}",
                        )
                    )
                if rnd.random() < 0.04:
                    db.session.add(
                        Auditoria(
                            fecha=utc(entrada - timedelta(minutes=1)),
                            usuario_id=persona.id,
                            accion="login_fallido",
                            detalle="Contraseña incorrecta",
                            ip=f"192.168.1.{rnd.randint(10, 80)}",
                        )
                    )
        db.session.commit()
        extra = "".join(f" {GRIS}· {a.nombre.split()[0]} rota a {d}{FIN}" for a, _, d in rotaciones)
        print(
            f"  {VERDE}✓{FIN} {DIAS_ES[fecha.weekday()]} {fecha.day} de {MESES_ES[fecha.month - 1]}"
            + extra
            + (f" {GRIS}(hoy, hasta ahora + cola){FIN}" if fecha == hoy else "")
            + (f" {GRIS}(reservas de mañana){FIN}" if fecha > hoy else "")
        )

    return datos, totales


def _codigo_unico(prefijo, rnd, usados):
    while True:
        codigo = f"{prefijo}-{rnd.randint(0, 0xFFFFFF):06X}"
        if codigo not in usados:
            usados.add(codigo)
            return codigo


_CODIGOS_SIM = set()


def _nuevo_equipo(cliente, sede, rnd, estado, origen="REPARACION", asesor=None, momento=None):
    from app.dominios.equipos.modelos import Equipo

    momento = momento or datetime.now(UTC).replace(tzinfo=None)
    return Equipo(
        codigo=_codigo_unico("EQ", rnd, _CODIGOS_SIM),
        cliente_id=cliente.id,
        punto_id=sede.id,
        tipo="Televisor",
        marca=rnd.choice(MARCAS_TV),
        modelo=rnd.choice(MODELOS_TV),
        serial=f"SN{rnd.randint(10**8, 10**9 - 1)}",
        falla=rnd.choice(FALLAS_TV),
        origen=origen,
        fecha_compra=(
            (date.today() - timedelta(days=rnd.randint(20, 330))) if origen == "GARANTIA" else None
        ),
        estado=estado,
        nota=NOTAS_EQUIPO.get(estado),
        registrado_por_id=asesor.id if asesor and estado != "POR_RECIBIR" else None,
        fecha_registro=momento - timedelta(days=rnd.randint(2, 9)),
        fecha_actualizacion=momento,
        fecha_entrega=momento if estado == "ENTREGADO" else None,
    )


def _simular_vinculos(turno, servicio, cliente, sede, asesores, rnd, ahora):
    """Equipos y reclamos coherentes con el tipo de trámite del turno."""
    from app.dominios.reclamos.modelos import Reclamo

    flujo = FLUJOS_SERVICIO.get(servicio.nombre)
    asesor = asesores[0] if asesores else None
    momento = turno.hora_solicitud or ahora.astimezone(UTC).replace(tzinfo=None)
    pendiente = turno.estado == "ESPERANDO"
    if flujo == "ENTREGA":
        estado = "LISTO" if pendiente or turno.estado != "ATENDIDO" else "ENTREGADO"
        turno.equipo = _nuevo_equipo(cliente, sede, rnd, estado, asesor=asesor, momento=momento)
    elif flujo == "GARANTIA":
        estado = "POR_RECIBIR" if pendiente else rnd.choice(["RECIBIDO", "EN_REPARACION", "LISTO"])
        turno.equipo = _nuevo_equipo(
            cliente, sede, rnd, estado, origen="GARANTIA", asesor=asesor, momento=momento
        )
    elif flujo == "RECLAMO":
        categoria, texto = rnd.choice(RECLAMOS_DEMO)
        resuelto = turno.estado == "ATENDIDO"
        turno.reclamo = Reclamo(
            radicado=_codigo_unico("RC", rnd, _CODIGOS_SIM),
            cliente_id=cliente.id,
            punto_id=sede.id,
            categoria=categoria,
            descripcion=texto,
            presencial=True,
            estado="RESUELTO" if resuelto else "RADICADO",
            respuesta="Revisamos tu caso en sede y quedó solucionado." if resuelto else None,
            gestionado_por_id=asesor.id if resuelto and asesor else None,
            fecha_creacion=momento - timedelta(days=rnd.randint(1, 4)),
            fecha_respuesta=momento if resuelto else None,
        )


def _simular_equipos_y_reclamos(db, datos, rnd):
    """Taller en curso: equipos en reparación en cada sede, reclamos en línea
    y el cliente de la demostración con un televisor listo para recoger."""
    from app.dominios.reclamos.modelos import Reclamo
    from app.dominios.usuarios.modelos import Usuario

    ahora = datetime.now(UTC).replace(tzinfo=None)
    clientes = Usuario.query.filter_by(rol="CLIENTE").limit(80).all()
    for i, cliente in enumerate(clientes[:48]):
        sede = datos["sedes"][i % len(datos["sedes"])]
        asesor = next((a for a in datos["asesores"] if a.punto_asignado_id == sede.id), None)
        estado = rnd.choices(["RECIBIDO", "EN_REPARACION", "LISTO"], weights=[3, 5, 3])[0]
        cuando = ahora - timedelta(minutes=rnd.randint(20, 60 * 72))
        db.session.add(_nuevo_equipo(cliente, sede, rnd, estado, asesor=asesor, momento=cuando))
    respuestas = [
        "Te contactamos por teléfono y acordamos la entrega para mañana a las 10:00.",
        "Revisamos la factura y aplicamos el valor cotizado. Puedes recoger el soporte en sede.",
    ]
    for i, cliente in enumerate(clientes[48:64]):
        sede = datos["sedes"][i % len(datos["sedes"])]
        asesor = next((a for a in datos["asesores"] if a.punto_asignado_id == sede.id), None)
        categoria, texto = rnd.choice(RECLAMOS_DEMO)
        estado = rnd.choices(["RADICADO", "EN_GESTION", "RESUELTO"], weights=[4, 3, 3])[0]
        db.session.add(
            Reclamo(
                radicado=_codigo_unico("RC", rnd, _CODIGOS_SIM),
                cliente_id=cliente.id,
                punto_id=sede.id,
                categoria=categoria,
                descripcion=texto,
                presencial=False,
                estado=estado,
                respuesta=rnd.choice(respuestas) if estado == "RESUELTO" else None,
                gestionado_por_id=asesor.id if estado != "RADICADO" and asesor else None,
                fecha_creacion=ahora - timedelta(hours=rnd.randint(2, 96)),
                fecha_respuesta=ahora if estado == "RESUELTO" else None,
            )
        )

    # Cliente de la demostración (celular conocido).
    nombre, celular, documento = CLIENTE_DEMO
    demo = Usuario.query.filter_by(celular=celular, rol="CLIENTE").first() or Usuario(
        nombre=nombre,
        correo=f"cliente_{celular}@publico.filacero.local",
        password_hash="",
        rol="CLIENTE",
        celular=celular,
        activo=True,
    )
    demo.documento = documento
    db.session.add(demo)
    db.session.flush()
    centro = datos["sedes"][0]
    asesor = datos["asesores"][0]
    listo = _nuevo_equipo(demo, centro, rnd, "LISTO", asesor=asesor, momento=ahora)
    listo.marca, listo.modelo = "Samsung", '55" 4K UHD'
    listo.falla = "No enciende, el led parpadea"
    listo.nota = "Se cambió la fuente de poder. Probado 2 horas: listo para entregar."
    reparando = _nuevo_equipo(demo, centro, rnd, "EN_REPARACION", asesor=asesor, momento=ahora)
    reparando.marca, reparando.modelo = "LG", '43" Full HD'
    reparando.falla = "Pantalla con líneas verticales"
    db.session.add_all([listo, reparando])
    db.session.add(
        Reclamo(
            radicado=_codigo_unico("RC", rnd, _CODIGOS_SIM),
            cliente_id=demo.id,
            punto_id=centro.id,
            equipo_id=None,
            categoria="DEMORA",
            descripcion="El LG lleva varios días en reparación y quisiera saber la fecha estimada.",
            presencial=False,
            estado="EN_GESTION",
            respuesta="Estamos esperando el panel de reemplazo; llega el lunes y te avisamos.",
            gestionado_por_id=asesor.id,
            fecha_creacion=ahora - timedelta(days=1),
            fecha_respuesta=ahora,
        )
    )

    # Qué está haciendo cada asesor en este momento.
    for i, asesor in enumerate(datos["asesores"]):
        asesor.presencia = PRESENCIAS_DEMO.get(i, "DISPONIBLE")
        asesor.presencia_desde = ahora - timedelta(minutes=rnd.randint(4, 35))
    db.session.commit()


def _simular_preparacion(turno, servicio, asesores, rnd, ahora):
    """Estado de la preparación previa según el momento del turno."""
    if not servicio.requiere_preparacion:
        return
    responsable = asesores[0] if asesores else None
    if turno.estado in ("ATENDIDO", "NO_ASISTIO"):
        estado = "LISTO"
    elif turno.estado == "CANCELADO":
        estado = rnd.choice(["PENDIENTE", "LISTO"])
    else:  # en espera: unos listos, otros en curso y alguno con novedad
        estado = rnd.choices(
            ["LISTO", "EN_PREPARACION", "PENDIENTE", "NOVEDAD"], weights=[45, 15, 34, 6]
        )[0]
    turno.estado_preparacion = estado
    if estado == "PENDIENTE" or not responsable:
        return
    turno.preparado_por_id = responsable.id
    momento = min(ahora, ahora - timedelta(minutes=rnd.randint(5, 240)))
    turno.fecha_preparacion = momento.astimezone(UTC).replace(tzinfo=None)
    if estado == "LISTO":
        turno.nota_preparacion = rnd.choice(NOTAS_LISTO)
    elif estado == "NOVEDAD":
        turno.nota_preparacion = rnd.choice(NOTAS_NOVEDAD)


def _rotar_asesores(db, datos, base, fecha, hoy, rnd):
    """Rotación realista: algunos días un asesor de una sede con 2 apoya una
    sede con 1. Hoy y mañana cada uno vuelve a su sede base (la de la tabla
    de credenciales). El cupo de ambas sedes cambia solo (3 x asesores)."""
    for a in datos["asesores"]:
        a.punto_asignado_id = base[a.id]
    cambios = []
    if fecha < hoy and rnd.random() < 0.55:
        nombres = {s.id: s.nombre for s in datos["sedes"]}
        por_sede = {}
        for a in datos["asesores"]:
            por_sede.setdefault(a.punto_asignado_id, []).append(a)
        donantes = [sid for sid, lista in por_sede.items() if len(lista) >= 2]
        receptoras = [s.id for s in datos["sedes"] if len(por_sede.get(s.id, [])) <= 1]
        if donantes and receptoras:
            origen = rnd.choice(donantes)
            asesor = rnd.choice(por_sede[origen])
            destino = rnd.choice(receptoras)
            asesor.punto_asignado_id = destino
            cambios.append((asesor, nombres[origen], nombres[destino]))
    db.session.commit()
    return cambios


def _correos_protegidos(app):
    return [c.strip().lower() for c in app.config.get("CUENTAS_PROTEGIDAS", []) if c.strip()]


def _parecidas(correo):
    """Cuentas del personal con el mismo usuario y otro dominio (p. ej. .com vs .co)."""
    from app.dominios.usuarios.modelos import Usuario

    usuario = correo.split("@", 1)[0]
    return [
        u.correo
        for u in Usuario.query.filter(Usuario.correo.like(f"{usuario}@%")).all()
        if u.correo.lower() != correo and u.rol != "CLIENTE"
    ]


def _guardar_protegidas(app):
    """Copia (con su hash) las cuentas de CUENTAS_PROTEGIDAS antes de borrar y
    avisa de las que no existen: esas NO se pueden conservar."""
    from app.dominios.usuarios.modelos import Usuario

    correos = _correos_protegidos(app)
    if not correos:
        return []
    encontradas = Usuario.query.filter(Usuario.correo.in_(correos)).all()
    existentes = {u.correo.lower() for u in encontradas}
    for correo in correos:
        if correo in existentes:
            continue
        print(
            f"  {AMBAR}⚠ {correo} está en CUENTAS_PROTEGIDAS pero no existe en esta base "
            f"de datos: no hay nada que conservar.{FIN}"
        )
        for otra in _parecidas(correo):
            print(
                f"    {AMBAR}Existe {otra} (¿es la misma con otro dominio?). "
                f"Esa cuenta NO está protegida y se borrará.{FIN}"
            )
        print(
            f"    {GRIS}Créala después con: python scripts/crear_cuenta.py {correo} "
            f'ADMIN "Tu nombre"{FIN}'
        )
    return [
        {
            "nombre": u.nombre,
            "correo": u.correo,
            "rol": u.rol,
            "password_hash": u.password_hash,
            "sede": u.punto_asignado.nombre if u.punto_asignado else None,
            "modulo": u.modulo,
            "celular": u.celular,
            "documento": u.documento,
            "debe_cambiar_clave": bool(u.debe_cambiar_clave),
        }
        for u in encontradas
    ]


def _restaurar_protegidas(db, copias):
    from app.dominios.sedes.modelos import Punto
    from app.dominios.usuarios.modelos import Usuario

    primera = Punto.query.filter_by(activo=True).order_by(Punto.id).first()
    for c in copias:
        sede = Punto.query.filter_by(nombre=c["sede"]).first() if c["sede"] else None
        if c["rol"] == "AGENTE" and not sede:
            sede = primera
        usuario = Usuario.query.filter_by(correo=c["correo"]).first()
        if usuario is None:
            usuario = Usuario(correo=c["correo"])
            db.session.add(usuario)
        usuario.nombre = c["nombre"]
        usuario.rol = c["rol"]
        usuario.password_hash = c["password_hash"]
        usuario.activo = True
        usuario.eliminado_en = None
        usuario.debe_cambiar_clave = c.get("debe_cambiar_clave", False)
        # La recarga no debe dejar la cuenta bloqueada por intentos anteriores.
        usuario.intentos_fallidos = 0
        usuario.bloqueado_hasta = None
        usuario.celular = c.get("celular")
        usuario.documento = c.get("documento")
        usuario.punto_asignado_id = sede.id if (sede and c["rol"] == "AGENTE") else None
        if c["rol"] == "AGENTE":
            usuario.modulo = c.get("modulo") or "Módulo 3"
            usuario.presencia = "DISPONIBLE"
    db.session.commit()
    for c in copias:
        print(f"  {VERDE}✓{FIN} Cuenta protegida conservada: {c['correo']} ({c['rol']})")


def comando_cuentas(args):
    """Diagnóstico de CUENTAS_PROTEGIDAS: por qué una cuenta no puede entrar."""
    import getpass

    from app import create_app, db
    from app.dominios.usuarios.modelos import Usuario
    from app.seguridad import verificar_password

    app = create_app()
    with app.app_context():
        from flask import g

        try:
            organizacion = _preparar_organizacion_simulacion(app, db)
        except RuntimeError as error:
            print(f"{ROJO}No se pudo revisar: {error}{FIN}")
            return 1
        g.organizacion_id = organizacion.id
        g.organizacion = organizacion
        correos = _correos_protegidos(app)
        print(
            f"Base de datos: {NEGRITA}{_descripcion_bd(app)}{FIN} · "
            f"organización '{organizacion.nombre}'"
        )
        if not correos:
            print(
                f"{AMBAR}CUENTAS_PROTEGIDAS está vacía en backend/.env.{FIN}\n"
                "Agrega, por ejemplo: "
                "CUENTAS_PROTEGIDAS=elkinadmin@filacero.co,elkinagente@filacero.co"
            )
            return 1
        ahora = datetime.now(UTC).replace(tzinfo=None)
        problemas = 0
        for correo in correos:
            print(f"\n{NEGRITA}{correo}{FIN}")
            u = Usuario.query.filter_by(correo=correo).first()
            if u is None:
                problemas += 1
                print(f"  {ROJO}✗ No existe en esta base de datos.{FIN}")
                for otra in _parecidas(correo):
                    print(
                        f"  {AMBAR}Existe {otra}: revisa si escribiste otro dominio "
                        f"(.co / .com).{FIN}"
                    )
                print(
                    f'  {GRIS}Créala: python scripts/crear_cuenta.py {correo} ADMIN "Tu nombre"\n'
                    f'  (para asesor: ... {correo} AGENTE "Tu nombre" "Sede Centro"){FIN}'
                )
                continue
            sede = u.punto_asignado.nombre if u.punto_asignado else "—"
            print(f"  {VERDE}✓{FIN} Existe · rol {u.rol} · sede {sede} · módulo {u.modulo or '—'}")
            if not u.activo or u.eliminado_en:
                problemas += 1
                print(
                    f"  {ROJO}✗ Está desactivada o dada de baja.{FIN} "
                    "Reactívala con crear_cuenta.py."
                )
            if not u.password_hash:
                problemas += 1
                print(f"  {ROJO}✗ No tiene contraseña.{FIN} Asígnala con crear_cuenta.py.")
            if u.bloqueado_hasta and u.bloqueado_hasta > ahora:
                minutos = int((u.bloqueado_hasta - ahora).total_seconds() // 60) + 1
                if args.desbloquear:
                    u.bloqueado_hasta = None
                    u.intentos_fallidos = 0
                    db.session.commit()
                    print(f"  {VERDE}✓ Estaba bloqueada ({minutos} min); ya se desbloqueó.{FIN}")
                else:
                    problemas += 1
                    print(
                        f"  {ROJO}✗ Bloqueada {minutos} min por intentos fallidos.{FIN} "
                        "Espera o usa --desbloquear."
                    )
            elif u.intentos_fallidos:
                print(
                    f"  {AMBAR}· Lleva {u.intentos_fallidos} intento(s) fallido(s) seguidos.{FIN}"
                )
            if u.debe_cambiar_clave:
                print(f"  {AMBAR}· Tiene clave temporal: al entrar te pedirá cambiarla.{FIN}")
            if args.probar_clave and u.password_hash:
                clave = getpass.getpass("  Escribe la contraseña para probarla (no se ve): ")
                if verificar_password(clave, u.password_hash):
                    print(f"  {VERDE}✓ La contraseña es correcta.{FIN}")
                else:
                    problemas += 1
                    print(
                        f"  {ROJO}✗ Esa contraseña NO coincide.{FIN} Cámbiala con: "
                        f'python scripts/crear_cuenta.py {correo} {u.rol} "{u.nombre}"'
                        + (f' "{sede}"' if u.rol == "AGENTE" and sede != "—" else "")
                    )
        print()
        if problemas:
            print(f"{AMBAR}{problemas} problema(s) encontrado(s).{FIN}")
            return 1
        print(f"{VERDE}Las cuentas protegidas están listas para entrar.{FIN}")
        return 0


def _descripcion_bd(app):
    uri = app.config["SQLALCHEMY_DATABASE_URI"]
    if "@" in uri:  # oculta la contraseña
        esquema, resto = uri.split("://", 1)
        uri = f"{esquema}://***@{resto.split('@', 1)[1]}"
    return uri


def _base_es_remota(url):
    host = url.host
    return bool(host and host.lower() not in {"localhost", "127.0.0.1", "::1"})


def _preparar_organizacion_simulacion(app, db):
    """Prepara el esquema local y devuelve el tenant configurado para la simulación."""
    from sqlalchemy import inspect

    if db.engine.dialect.name == "sqlite":
        db.create_all()
    elif not inspect(db.engine).has_table("organizaciones"):
        raise RuntimeError(
            "No existe el esquema de organizaciones. Ejecuta `flask db upgrade` "
            "desde la carpeta backend."
        )
    return _asegurar_organizacion_simulacion(app, db)


def comando_cargar(args, solo_borrar=False):
    from app import create_app, db

    app = create_app()
    with app.app_context():
        host = db.engine.url.host
        base_remota = _base_es_remota(db.engine.url)
        if base_remota and not args.permitir_borrar_remoto:
            print(
                f"{ROJO}Se canceló: --cargar/--borrar modifica datos y el destino "
                f"parece remoto ({host}).{FIN}\n"
                "No ejecutes esta simulación contra una base remota. "
                "Usa una base local aislada para los datos demo."
            )
            return 1
        from flask import g

        try:
            organizacion = _preparar_organizacion_simulacion(app, db)
        except RuntimeError as error:
            print(f"{ROJO}No se pudo preparar la simulación: {error}{FIN}")
            return 1
        g.organizacion_id = organizacion.id
        g.organizacion = organizacion
        if not solo_borrar:
            from app.horario import hoy_local

            hoy = hoy_local()
            try:
                desde = (
                    hoy - timedelta(days=args.dias)
                    if args.dias and not args.desde
                    else date.fromisoformat(args.desde) if args.desde else hoy - timedelta(days=6)
                )
                hasta = date.fromisoformat(args.hasta) if args.hasta else hoy - timedelta(days=1)
            except ValueError:
                print(f"{ROJO}Las fechas deben tener formato AAAA-MM-DD.{FIN}")
                return 1
            if desde > hasta:
                print(f"{ROJO}--desde no puede ser posterior a --hasta.{FIN}")
                return 1
        print(f"Base de datos: {NEGRITA}{_descripcion_bd(app)}{FIN}")
        if not args.si or base_remota:
            print(
                f"{AMBAR}Se reemplazarán los datos operativos de la organización "
                f"'{organizacion.nombre}' (no se borran organizaciones ni otros tenants).{FIN}"
            )
            if input("Escribe BORRAR para continuar: ").strip() != "BORRAR":
                print("Cancelado. No se modificó nada.")
                return 1

        nombre_organizacion = organizacion.nombre
        # Si una cuenta protegida no existe pero hay una igual con otro dominio
        # (.com / .co), lo más probable es un error en el .env: se cancela para
        # no borrar la cuenta real.
        from app.dominios.usuarios.modelos import Usuario

        en_riesgo = [
            (correo, otra)
            for correo in _correos_protegidos(app)
            if not Usuario.query.filter_by(correo=correo).first()
            for otra in _parecidas(correo)
        ]
        if en_riesgo:
            for correo, otra in en_riesgo:
                print(
                    f"{ROJO}Se canceló: {correo} está en CUENTAS_PROTEGIDAS pero no existe, "
                    f"y sí existe {otra}.{FIN}"
                )
            print(
                "Corrige CUENTAS_PROTEGIDAS en backend/.env (o crea la cuenta con "
                "scripts/crear_cuenta.py) y vuelve a ejecutar. No se modificó nada.\n"
                "Revisa el estado con: python simulacion.py --cuentas"
            )
            return 1
        protegidas = _guardar_protegidas(app)
        tablas = borrar_todo(db, organizacion.id)
        print(
            f"{VERDE}✓{FIN} Datos operativos de '{nombre_organizacion}' limpiados "
            f"({len(tablas)} tablas; organizaciones y otros tenants conservados)"
        )
        if solo_borrar:
            _restaurar_protegidas(db, protegidas)
            return 0

        print(
            f"\nSimulando TecniVisión del {desde:%d/%m} al {hasta:%d/%m}, hoy hasta las "
            f"{datetime.now():%H:%M} y las reservas de mañana:"
        )
        inicio = time.time()
        datos, t = cargar_semana(
            db, desde, hasta, semilla=args.semilla, turnos_objetivo=args.turnos or None
        )
        _simular_equipos_y_reclamos(db, datos, random.Random(args.semilla))
        _restaurar_protegidas(db, protegidas)

        from app.dominios.agentes.despacho import cumplimiento
        from app.dominios.turnos.modelos import Turno

        c = cumplimiento(Turno.query.filter_by(estado="ATENDIDO").all())
        total = sum(t.values())
        print(f"\n{NEGRITA}Listo en {time.time() - inicio:.1f} s{FIN}")
        print(
            f"  {total} turnos: {t['ATENDIDO']} atendidos, {t['ESPERANDO']} en espera, "
            f"{t['CANCELADO']} cancelados, {t['NO_ASISTIO']} no asistieron"
        )
        print(
            f"  Atendidos dentro de su franja: {c['puntualidad_pct']}% · "
            f"dentro de 10 min: {c['dentro_tiempo_max_pct']}%"
        )
        print(f"\n{NEGRITA}Credenciales{FIN}")
        correos_protegidos = {c["correo"].lower() for c in protegidas}
        for n, correo in ADMINS:
            clave = "(clave conservada)" if correo.lower() in correos_protegidos else CLAVE_ADMIN
            print(f"  Administrador  {correo:<32} {clave}   ({n})")
        for n, correo in SUPERVISORES:
            clave = (
                "(clave conservada)" if correo.lower() in correos_protegidos else CLAVE_SUPERVISOR
            )
            print(f"  Supervisor     {correo:<32} {clave}  ({n})")
        for _n, correo, i in ASESORES:
            clave = "(clave conservada)" if correo.lower() in correos_protegidos else CLAVE_ASESOR
            print(f"  Asesor         {correo:<32} {clave}  ({SEDES[i][0]})")
        demo = {c.lower() for _n, c in ADMINS} | {c.lower() for _n, c in SUPERVISORES}
        demo |= {c.lower() for _n, c, _i in ASESORES}
        for c in protegidas:
            if c["correo"].lower() not in demo:
                print(f"  Protegida      {c['correo']:<32} (tu contraseña)  ({c['rol']})")
        print(
            f"\n{NEGRITA}Cliente de la demostración{FIN}  {CLIENTE_DEMO[0]} · celular "
            f"{CLIENTE_DEMO[1]} · cédula {CLIENTE_DEMO[2]} "
            f"(tiene un Samsung listo para recoger y un LG en reparación)"
        )
        print(
            f"\n{GRIS}Para ver reservas llegando en vivo durante la presentación:"
            f"  python simulacion.py --en-vivo{FIN}"
        )
    return 0


# ======================================================================
# MODO EN VIVO: reservas llegando mientras se presenta
# ======================================================================


def _agentes_demo_automaticos():
    from app.dominios.usuarios.modelos import Usuario

    correos_demo = {correo.lower() for _nombre, correo, _sede in ASESORES}
    protegidas = {
        correo.lower()
        for correo in __import__("flask").current_app.config.get("CUENTAS_PROTEGIDAS", [])
    }
    return [
        agente
        for agente in Usuario.query.filter_by(rol="AGENTE", activo=True).all()
        if agente.correo.lower() in correos_demo - protegidas
        and not agente.protegida
        and agente.punto_asignado_id is not None
    ]


def _cerrar_vinculos(db, turno, agente_id):
    """Al terminar la atención, el equipo o el reclamo del turno avanzan como en la sede."""
    ahora = datetime.now(UTC).replace(tzinfo=None)
    if turno.equipo is not None:
        equipo = turno.equipo
        if equipo.estado == "LISTO":
            equipo.estado, equipo.fecha_entrega = "ENTREGADO", ahora
            equipo.nota = NOTAS_EQUIPO["ENTREGADO"]
        elif equipo.estado == "POR_RECIBIR":
            equipo.estado, equipo.registrado_por_id = "RECIBIDO", agente_id
            equipo.nota = NOTAS_EQUIPO["RECIBIDO"]
        equipo.fecha_actualizacion = ahora
    if turno.reclamo is not None and turno.reclamo.estado != "RESUELTO":
        reclamo = turno.reclamo
        reclamo.estado, reclamo.gestionado_por_id = "RESUELTO", agente_id
        reclamo.respuesta = "Revisamos tu caso en sede y quedó solucionado."
        reclamo.fecha_respuesta = ahora
    db.session.commit()


def _avanzar_atenciones_simuladas(db, trabajos, agentes, instante, rnd):
    """Avanza únicamente reservas creadas por esta ejecución de --en-vivo:
    alistar (si el trámite lo requiere) → llamar → atender → finalizar, y a
    veces la persona no llega."""
    from app.dominios.agentes.servicios import (
        finalizar_atencion,
        iniciar_atencion,
        llamar_turno,
        marcar_no_asistio,
    )
    from app.dominios.turnos.modelos import Turno
    from app.dominios.turnos.preparacion import registrar_preparacion

    if not trabajos or not agentes:
        return

    nombres = {agente.id: agente.nombre for agente in agentes}
    ids_agentes = list(nombres)
    activos = Turno.query.filter(
        Turno.agente_id.in_(ids_agentes),
        Turno.estado.in_(("LLAMADO", "EN_ATENCION")),
    ).all()
    ocupados = {turno.agente_id for turno in activos}

    for turno_id, trabajo in list(trabajos.items()):
        turno = db.session.get(Turno, turno_id)
        if turno is None:
            trabajos.pop(turno_id)
            continue
        visible = turno.codigo_corto or turno.codigo

        if trabajo["estado"] == "ESPERANDO":
            if turno.estado != "ESPERANDO":
                trabajos.pop(turno_id)
                continue
            agente = next(
                (
                    candidato
                    for candidato in agentes
                    if candidato.punto_asignado_id == turno.punto_id
                    and candidato.id not in ocupados
                ),
                None,
            )
            if agente is None:
                continue
            # Preparación previa: el asesor deja listo el pedido antes de llamar.
            if turno.estado_preparacion in ("PENDIENTE", "EN_PREPARACION"):
                try:
                    registrar_preparacion(agente.id, turno.id, "LISTO", rnd.choice(NOTAS_LISTO))
                    ocupados.add(agente.id)
                    print(f"  {GRIS}✎ {agente.nombre} alista el pedido de {visible}{FIN}")
                except ValueError:
                    db.session.rollback()
                continue
            try:
                llamar_turno(agente.id, turno.id)
            except ValueError as error:
                print(f"  {AMBAR}⚠ No se pudo llamar {visible}: {error}{FIN}")
                trabajos.pop(turno_id)
                continue
            trabajo.update(
                estado="LLAMADO",
                agente_id=agente.id,
                siguiente_en=instante + rnd.uniform(2, 5),
            )
            ocupados.add(agente.id)
            print(f"  {AMBAR}↗ {agente.nombre} llama {visible}{FIN}")
            continue

        if turno.agente_id != trabajo["agente_id"]:
            print(f"  {AMBAR}⚠ Se detuvo la simulación de {visible}: cambió su asesor.{FIN}")
            trabajos.pop(turno_id)
            continue

        if instante < trabajo["siguiente_en"]:
            continue

        nombre = nombres.get(trabajo["agente_id"], "El asesor")
        try:
            if trabajo["estado"] == "LLAMADO" and turno.estado == "LLAMADO":
                if trabajo.get("no_asiste"):
                    marcar_no_asistio(trabajo["agente_id"], turno_id)
                    trabajos.pop(turno_id)
                    print(f"  {GRIS}✗ {visible} no llegó: {nombre} lo marca como no asistió{FIN}")
                    continue
                iniciar_atencion(trabajo["agente_id"], turno_id)
                trabajo.update(
                    estado="EN_ATENCION",
                    siguiente_en=instante + rnd.uniform(18, 32),
                )
                print(f"  {VERDE}● {nombre} atiende {visible}{FIN}")
            elif trabajo["estado"] == "EN_ATENCION" and turno.estado == "EN_ATENCION":
                finalizar_atencion(trabajo["agente_id"], turno_id)
                _cerrar_vinculos(db, turno, trabajo["agente_id"])
                trabajos.pop(turno_id)
                print(f"  {VERDE}✓ {visible} atendido por {nombre}{FIN}")
            else:
                print(
                    f"  {AMBAR}⚠ Se detuvo la simulación de {visible}: "
                    f"estado inesperado ({turno.estado}).{FIN}"
                )
                trabajos.pop(turno_id)
        except ValueError as error:
            print(f"  {AMBAR}⚠ No se pudo avanzar {visible}: {error}{FIN}")
            trabajos.pop(turno_id)


def _liberar_asesores_trabados(db, agentes, minutos=10):
    """Una ejecución anterior detenida a la fuerza pudo dejar asesores demo con un
    turno "llamado" o "en atención". Si lleva más de 10 min (el máximo por regla),
    se cierra para que el asesor vuelva a quedar disponible."""
    from app.dominios.agentes.servicios import finalizar_atencion, marcar_no_asistio
    from app.dominios.turnos.modelos import Turno

    limite = datetime.now(UTC).replace(tzinfo=None) - timedelta(minutes=minutos)
    trabados = Turno.query.filter(
        Turno.agente_id.in_([a.id for a in agentes]),
        Turno.estado.in_(("LLAMADO", "EN_ATENCION")),
        Turno.fecha_llamado < limite,
    ).all()
    for turno in trabados:
        try:
            if turno.estado == "EN_ATENCION":
                finalizar_atencion(turno.agente_id, turno.id)
                _cerrar_vinculos(db, turno, turno.agente_id)
            else:
                marcar_no_asistio(turno.agente_id, turno.id)
        except ValueError:
            db.session.rollback()
    if trabados:
        print(
            f"  {GRIS}Se liberaron {len(trabados)} asesor(es) que quedaron atendiendo "
            f"en una ejecución anterior.{FIN}"
        )


def _cerrar_atenciones_abiertas(db, trabajos):
    """Al detener --en-vivo no deja asesores "atendiendo" para siempre: termina las
    atenciones en curso y devuelve a la cola los turnos que solo estaban llamados."""
    from app.dominios.agentes.servicios import devolver_a_cola, finalizar_atencion
    from app.dominios.turnos.modelos import Turno

    cerradas = devueltas = 0
    for turno_id, trabajo in list(trabajos.items()):
        turno = db.session.get(Turno, turno_id)
        if turno is None or "agente_id" not in trabajo:
            continue
        try:
            if turno.estado == "EN_ATENCION":
                finalizar_atencion(trabajo["agente_id"], turno_id)
                _cerrar_vinculos(db, turno, trabajo["agente_id"])
                cerradas += 1
            elif turno.estado == "LLAMADO":
                devolver_a_cola(trabajo["agente_id"], turno_id)
                devueltas += 1
        except ValueError:
            db.session.rollback()
    if cerradas or devueltas:
        print(
            f"  {GRIS}Cierre ordenado: {cerradas} atención(es) finalizada(s), "
            f"{devueltas} turno(s) devuelto(s) a la cola.{FIN}"
        )


def _registrar_sesion_agentes(db, agentes, accion, detalle):
    """Registra entrada/salida de los agentes demo para que aparezcan en Actividad."""
    from app.dominios.auditoria.modelos import Auditoria

    instante = datetime.now(UTC).replace(tzinfo=None)
    for agente in agentes:
        db.session.add(
            Auditoria(
                fecha=instante,
                usuario_id=agente.id,
                accion=accion,
                detalle=detalle,
                ip="127.0.0.1",
            )
        )
        if accion == "login":
            agente.ultimo_acceso = instante
    db.session.commit()


def _mostrar_tablero_operativo(Turno, agentes, trabajos, ids_turnos, creadas, intervalo):
    """Resumen de operación para comprobar que los agentes sí están atendiendo."""
    ids = [a.id for a in agentes]
    estados = ("ESPERANDO", "LLAMADO", "EN_ATENCION", "ATENDIDO", "NO_ASISTIO", "CANCELADO")
    conteos = {
        estado: (
            Turno.query.filter(Turno.id.in_(ids_turnos), Turno.estado == estado).count()
            if ids_turnos
            else 0
        )
        for estado in estados
    }
    activos = (
        Turno.query.filter(
            Turno.agente_id.in_(ids), Turno.estado.in_(("LLAMADO", "EN_ATENCION"))
        ).all()
        if ids
        else []
    )
    ocupados = {t.agente_id: t for t in activos}
    print(f"\n{NEGRITA}TABLERO OPERATIVO · últimas {intervalo}s{FIN}")
    print(
        f"Reservas generadas: {creadas} | En espera: {conteos['ESPERANDO']} | "
        f"Llamados: {conteos['LLAMADO']} | En atención: {conteos['EN_ATENCION']} | "
        f"Atendidos: {conteos['ATENDIDO']} | No asistieron: {conteos['NO_ASISTIO']} | "
        f"Cancelados: {conteos['CANCELADO']}"
    )
    for agente in agentes:
        turno = ocupados.get(agente.id)
        if turno:
            estado = "LLAMANDO" if turno.estado == "LLAMADO" else "ATENDIENDO"
            print(f"  {VERDE}●{FIN} {agente.nombre:<24} {estado:<12} {turno.codigo_corto}")
        else:
            print(f"  {GRIS}○{FIN} {agente.nombre:<24} DISPONIBLE")
    print()


def comando_en_vivo(args):
    """Crea reservas de ciudadanos ficticios cada pocos segundos en la BD real,
    respetando el cupo por sede y, por defecto, simula la atención de esas
    reservas con los asesores demo. Nunca toma turnos ajenos. Ctrl+C para detener."""
    from app import create_app, db
    from app.dominios.franjas.modelos import Franja
    from app.dominios.sedes.modelos import Punto
    from app.dominios.tramites.modelos import Tramite
    from app.dominios.turnos.modelos import Turno
    from app.dominios.turnos.servicios import crear_turno
    from app.dominios.usuarios.servicios import registrar_cliente_publico
    from app.horario import ahora_local, asegurar_franjas, hoy_local

    app = create_app()
    rnd = random.Random()
    with app.app_context():
        from flask import g

        try:
            organizacion = _preparar_organizacion_simulacion(app, db)
        except RuntimeError as error:
            print(f"{ROJO}No se pudo preparar la simulación: {error}{FIN}")
            return 1
        g.organizacion_id = organizacion.id
        g.organizacion = organizacion
        sedes = Punto.query.filter_by(activo=True).all()
        servicios = Tramite.query.filter_by(activo=True).all()
        if not sedes or not servicios:
            print(f"{ROJO}No hay sedes o trámites. Primero: python simulacion.py --cargar{FIN}")
            return 1
        agentes_sesion = [] if args.solo_reservas else _agentes_demo_automaticos()
        if agentes_sesion:
            _liberar_asesores_trabados(db, agentes_sesion)
        if agentes_sesion:
            _registrar_sesion_agentes(
                db, agentes_sesion, "login", "Inicio de jornada · simulación FilaCero"
            )
        print(
            f"{NEGRITA}Modo operativo integral{FIN} · {_descripcion_bd(app)}\n"
            f"Hasta {args.por_ciclo} reservas cada ~{args.cada} s "
            + (
                "· atención automática de turnos demo (Ctrl+C para detener).\n"
                if not args.solo_reservas
                else "· sin atención automática (Ctrl+C para detener).\n"
            )
            + "Mira el panel de admin, la consola de cada agente y la actividad.\n"
            + f"Tablero de consola cada {args.tablero_cada}s · duración: "
            + (f"{args.duracion}s\n" if args.duracion else "indefinida\n")
        )
        pesos = {nombre: peso for nombre, _d, _m, peso in SERVICIOS}
        creadas = 0
        turnos_simulados = []
        trabajos_atencion = {}
        inicio_simulacion = time.monotonic()
        ultimo_tablero = inicio_simulacion
        try:
            while True:
                if args.duracion and time.monotonic() - inicio_simulacion >= args.duracion:
                    break
                for _ in range(args.por_ciclo):
                    ahora = ahora_local()
                    sede = rnd.choice(sedes)
                    servicio = rnd.choices(
                        servicios, weights=[pesos.get(s.nombre, 5) for s in servicios]
                    )[0]
                    turno = None
                    nombre = ""
                    for fecha in (hoy_local(), hoy_local() + timedelta(days=1)):
                        asegurar_franjas(sede, servicio, fecha)
                        proximas = (
                            Franja.query.filter_by(
                                punto_id=sede.id, tramite_id=servicio.id, fecha=fecha, activa=True
                            )
                            .order_by(Franja.hora_inicio)
                            .all()
                        )
                        proximas = [
                            f
                            for f in proximas
                            if fecha > ahora.date() or f.hora_inicio > ahora.time()
                        ][:4]
                        rnd.shuffle(proximas)
                        for franja in proximas:
                            prefijo = rnd.choice(["00", "10", "15", "20"])
                            celular = f"3{prefijo}{rnd.randint(1000000, 9999999)}"
                            nombre = (
                                f"{rnd.choice(NOMBRES)} {rnd.choice(APELLIDOS)} "
                                f"{rnd.choice(APELLIDOS)}"
                            )
                            try:
                                cliente = registrar_cliente_publico(nombre, celular)
                                turno = crear_turno(cliente.id, servicio.id, sede.id, franja.id)
                                break
                            except ValueError:
                                db.session.rollback()
                        if turno:
                            break
                    if turno:
                        # Igual que en el portal: la entrega lleva su equipo listo,
                        # la garantía su televisor por recibir y el reclamo su radicado.
                        _simular_vinculos(turno, servicio, cliente, sede, [], rnd, ahora_local())
                        db.session.commit()
                        creadas += 1
                        turnos_simulados.append(turno.id)
                        turnos_simulados = turnos_simulados[-100:]
                        if not args.solo_reservas:
                            trabajos_atencion[turno.id] = {
                                "estado": "ESPERANDO",
                                "punto_id": sede.id,
                                "no_asiste": rnd.random() < 0.06,
                            }
                        print(
                            f"  {VERDE}●{FIN} {ahora:%H:%M:%S}  {turno.codigo_corto}  "
                            f"{sede.nombre:<16} {servicio.nombre[:26]:<26} "
                            f"{turno.franja.fecha:%d/%m} {turno.franja.hora_inicio:%H:%M}  "
                            f"{GRIS}{nombre}{FIN}"
                        )
                    else:
                        print(f"  {AMBAR}●{FIN} {ahora:%H:%M:%S}  {sede.nombre}: sin cupo cercano")
                if not args.solo_reservas:
                    db.session.expire_all()
                    agentes = _agentes_demo_automaticos()
                    if not agentes:
                        print(
                            f"  {AMBAR}⚠ No hay asesores demo activos con sede; "
                            f"las reservas nuevas quedarán en espera.{FIN}"
                        )
                    else:
                        _avanzar_atenciones_simuladas(
                            db, trabajos_atencion, agentes, time.monotonic(), rnd
                        )
                # De vez en cuando alguien cancela (libera cupo, como en la vida real)
                if creadas and rnd.random() < 0.12:
                    espera = [
                        turno
                        for turno in Turno.query.filter(
                            Turno.id.in_(turnos_simulados), Turno.estado == "ESPERANDO"
                        )
                        .order_by(Turno.id.desc())
                        .limit(20)
                        .all()
                        if turno.id in trabajos_atencion
                        and trabajos_atencion[turno.id]["estado"] == "ESPERANDO"
                    ]
                    if espera:
                        cancelado = rnd.choice(espera)
                        cancelado.estado = "CANCELADO"
                        db.session.commit()
                        trabajos_atencion.pop(cancelado.id, None)
                        print(f"  {GRIS}○ {cancelado.codigo_corto} canceló su turno{FIN}")
                ahora_mono = time.monotonic()
                if not args.solo_reservas and ahora_mono - ultimo_tablero >= args.tablero_cada:
                    db.session.expire_all()
                    agentes_actuales = _agentes_demo_automaticos()
                    _mostrar_tablero_operativo(
                        Turno,
                        agentes_actuales,
                        trabajos_atencion,
                        turnos_simulados,
                        creadas,
                        args.tablero_cada,
                    )
                    ultimo_tablero = ahora_mono
                time.sleep(max(1, args.cada * rnd.uniform(0.6, 1.4)))
        except KeyboardInterrupt:
            print(f"\n{AMBAR}Interrupción solicitada por el usuario.{FIN}")
        finally:
            if trabajos_atencion:
                _cerrar_atenciones_abiertas(db, trabajos_atencion)
            if agentes_sesion:
                _registrar_sesion_agentes(
                    db, agentes_sesion, "logout", "Fin de jornada · simulación FilaCero"
                )
            print(f"\n{NEGRITA}Resumen final:{FIN} {creadas} reservas creadas en vivo.")
            if not args.solo_reservas:
                _mostrar_tablero_operativo(
                    Turno,
                    _agentes_demo_automaticos(),
                    trabajos_atencion,
                    turnos_simulados,
                    creadas,
                    args.tablero_cada,
                )
    return 0


# ======================================================================
# VERIFICACIÓN DE EXTREMO A EXTREMO
# ======================================================================

resultados = {"ok": 0, "fallo": 0}


def paso(descripcion, condicion, detalle=""):
    if condicion:
        resultados["ok"] += 1
        print(f"  {VERDE}✓{FIN} {descripcion} {GRIS}{detalle}{FIN}")
    else:
        resultados["fallo"] += 1
        print(f"  {ROJO}✗ {descripcion}{FIN} {detalle}")
    return condicion


def titulo(texto):
    print(f"\n{NEGRITA}{texto}{FIN}")


class ClienteLocal:
    def __init__(self, app):
        self.c = app.test_client()

    def __call__(self, metodo, ruta, json_=None, token=None, headers=None):
        h = dict(headers or {})
        if token:
            h["Authorization"] = f"Bearer {token}"
        r = self.c.open(ruta, method=metodo, json=json_, headers=h)
        return r.status_code, (r.get_json(silent=True) or {}), dict(r.headers)


class ClienteHTTP:
    def __init__(self, base):
        self.base = base.rstrip("/")

    def __call__(self, metodo, ruta, json_=None, token=None, headers=None):
        h = {"Accept": "application/json", **(headers or {})}
        datos = None
        if json_ is not None:
            datos = json.dumps(json_).encode()
            h["Content-Type"] = "application/json"
        if token:
            h["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(self.base + ruta, data=datos, method=metodo, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.status, json.loads(r.read() or b"{}"), dict(r.headers)
        except urllib.error.HTTPError as e:
            cuerpo = e.read()
            try:
                return e.code, json.loads(cuerpo or b"{}"), dict(e.headers)
            except ValueError:
                return e.code, {}, dict(e.headers)
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            return 0, {}, {}


# ----------------------------------------------------------------------
# Escenarios
# ----------------------------------------------------------------------


def login(api, correo, password):
    s, d, _ = api("POST", "/api/v1/usuarios/login", {"correo": correo, "password": password})
    return d.get("access_token") if s == 200 else None


def escenario_ciudadano(api, celular):
    titulo("1. CIUDADANO — reserva sin cuenta")
    s, horario, _ = api("GET", "/api/v1/horario")
    paso(
        "Consulta el horario de atención",
        s == 200,
        f"{horario.get('hora_apertura')}–{horario.get('hora_cierre')}, "
        f"todos los días={horario.get('todos_los_dias')}",
    )

    _, d, _ = api("GET", "/api/v1/sedes/")
    sedes = d.get("puntos", [])
    _, d, _ = api("GET", "/api/v1/tramites/")
    tramites = d.get("tramites", [])
    if not paso(
        "Carga sedes y trámites",
        sedes and tramites,
        f"{len(sedes)} sedes, {len(tramites)} trámites",
    ):
        return None
    sede, tramite = sedes[0], tramites[0]

    manana = (date.today() + timedelta(days=1)).isoformat()
    s, d, _ = api(
        "GET",
        f"/api/v1/franjas/disponibles?sede_id={sede['id']}&tramite_id={tramite['id']}&fecha={manana}",
    )
    franjas = d.get("franjas", [])
    if not paso(
        "Ve franjas para mañana (generadas automáticamente)",
        s == 200 and franjas,
        f"{len(franjas)} franjas, primera {franjas[0]['hora_inicio'] if franjas else '-'}",
    ):
        return None

    s, d, _ = api("POST", "/api/v1/turnos/publico/solicitar-codigo", {"celular": "123"})
    paso("Rechaza celular inválido", s == 400)

    s, d, _ = api("POST", "/api/v1/turnos/publico/solicitar-codigo", {"celular": celular})
    codigo = d.get("codigo_prueba")
    if not paso("Solicita código de verificación", s == 200 and codigo, f"código prueba {codigo}"):
        print(f"    {GRIS}(activa FILACERO_OTP_TEST_MODE=true y prueba contra localhost){FIN}")
        return None

    s, _, _ = api(
        "POST", "/api/v1/turnos/publico/verificar-codigo", {"celular": celular, "codigo": "000000"}
    )
    paso("Rechaza código incorrecto", s == 400)

    s, d, _ = api(
        "POST", "/api/v1/turnos/publico/verificar-codigo", {"celular": celular, "codigo": codigo}
    )
    verificacion = d.get("token_verificacion")
    paso("Verifica el celular", s == 200 and verificacion)

    s, d, _ = api(
        "POST",
        "/api/v1/turnos/publico",
        {
            "nombre": "Ciudadano Simulado",
            "celular": celular,
            "token_verificacion": verificacion,
            "punto_id": sede["id"],
            "tramite_id": tramite["id"],
            "franja_id": franjas[0]["franja_id"],
        },
    )
    turno = d.get("turno", {})
    paso(
        "Reserva el turno",
        s == 201,
        f"{turno.get('codigo')} · {turno.get('sede')} · {turno.get('hora_inicio')}",
    )
    paso(
        "El celular se devuelve enmascarado",
        turno.get("celular", "").count("*") == 4,
        turno.get("celular", ""),
    )

    s_otp, d_otp, _ = api("POST", "/api/v1/turnos/publico/solicitar-codigo", {"celular": celular})
    otp_consulta = d_otp.get("codigo_prueba")
    _, d_otp, _ = (
        api(
            "POST",
            "/api/v1/turnos/publico/verificar-codigo",
            {
                "celular": celular,
                "codigo": otp_consulta,
                "proposito": "consulta",
                "codigo_turno": turno.get("codigo"),
            },
        )
        if otp_consulta
        else (0, {}, {})
    )
    s, d, _ = api(
        "POST",
        "/api/v1/turnos/publico/consultar",
        {
            "codigo": turno.get("codigo"),
            "celular": celular,
            "token_verificacion": d_otp.get("token_verificacion"),
        },
    )
    paso(
        "Consulta su turno con código + celular",
        s == 200,
        f"estado {d.get('turno', {}).get('estado')}, "
        f"espera ~{d.get('espera', {}).get('tiempo_estimado_minutos')} min",
    )

    s, _, _ = api(
        "POST",
        "/api/v1/turnos/publico/consultar",
        {"codigo": turno.get("codigo"), "celular": "3110000000"},
    )
    paso("Otro celular NO puede ver el turno", s == 400)

    _, d_otp, _ = api("POST", "/api/v1/turnos/publico/solicitar-codigo", {"celular": celular})
    otp_cancelacion = d_otp.get("codigo_prueba")
    _, d_otp, _ = (
        api(
            "POST",
            "/api/v1/turnos/publico/verificar-codigo",
            {
                "celular": celular,
                "codigo": otp_cancelacion,
                "proposito": "cancelacion",
                "codigo_turno": turno.get("codigo"),
            },
        )
        if otp_cancelacion
        else (0, {}, {})
    )
    s, d, _ = api(
        "POST",
        "/api/v1/turnos/publico/cancelar",
        {
            "codigo": turno.get("codigo"),
            "celular": celular,
            "token_verificacion": d_otp.get("token_verificacion"),
        },
    )
    paso("Cancela su turno", s == 200 and d.get("turno", {}).get("estado") == "CANCELADO")

    # Reserva hoy (si quedan franjas) para que el agente la atienda.
    hoy = date.today().isoformat()
    _, d, _ = api(
        "GET",
        f"/api/v1/franjas/disponibles?sede_id={sede['id']}&tramite_id={tramite['id']}&fecha={hoy}",
    )
    franjas_hoy = d.get("franjas", []) or franjas
    _, d, _ = api(
        "POST",
        "/api/v1/turnos/publico",
        {
            "nombre": "Ciudadano Simulado",
            "celular": celular,
            "token_verificacion": verificacion,
            "punto_id": sede["id"],
            "tramite_id": tramite["id"],
            "franja_id": franjas_hoy[0]["franja_id"],
        },
    )
    paso(
        "Reserva un segundo turno para que lo atienda el agente",
        "turno" in d,
        f"{d.get('turno', {}).get('fecha')} {d.get('turno', {}).get('hora_inicio')}",
    )
    return sede


def escenario_agente(api, correo):
    titulo("2. AGENTE — consola de atención")
    token = login(api, correo, CLAVE_ASESOR)
    if not paso("Inicia sesión", token, correo):
        return
    s, panel, _ = api("GET", "/api/v1/agente/panel", token=token)
    paso(
        "Abre su panel",
        s == 200,
        f"sede {panel.get('agente', {}).get('sede')}, "
        f"en espera {panel.get('resumen', {}).get('en_espera')}, "
        f"en horario={panel.get('en_horario')}",
    )
    rec = panel.get("recomendacion") or {}
    paso(
        "El asistente de despacho da una recomendación",
        bool(rec.get("accion")),
        f"{rec.get('accion')}: {rec.get('titulo')}",
    )
    fa = panel.get("franja_actual")
    if fa:
        paso(
            "Muestra la franja actual y su cupo",
            fa["capacidad"] >= 3,
            f"{fa['inicio']}–{fa['fin']}, {fa['reservados']}/{fa['capacidad']} cupos, "
            f"quedan {fa['restante_seg'] // 60} min",
        )
    paso(
        "Proyecta la puntualidad de cada turno",
        all("puntualidad" in t for t in panel.get("cola", [])),
        ", ".join(f"{t['codigo'][-6:]}:{t['puntualidad']}" for t in panel.get("cola", [])[:3]),
    )

    s, d, _ = api("POST", "/api/v1/agente/llamar-siguiente", token=token)
    if s != 200:
        paso("Llama al siguiente turno", False, d.get("error", ""))
        if "horario" in d.get("error", ""):
            print(
                f"    {GRIS}(horario restringido: pon "
                f"RESTRINGIR_ATENCION_HORARIO=false para probar){FIN}"
            )
        return
    turno = d["turno"]
    paso("Llama al siguiente turno", True, f"{turno['codigo']} · {turno['usuario_nombre']}")

    s, d, _ = api("POST", "/api/v1/agente/llamar-siguiente", token=token)
    paso("No puede llamar otro con uno abierto", s == 400)

    s, d, _ = api("POST", f"/api/v1/agente/turnos/{turno['id']}/iniciar", token=token)
    paso("Inicia la atención", s == 200 and d["turno"]["estado"] == "EN_ATENCION")
    time.sleep(1)
    s, d, _ = api("POST", f"/api/v1/agente/turnos/{turno['id']}/finalizar", token=token)
    paso("Finaliza la atención", s == 200 and d["turno"]["estado"] == "ATENDIDO")

    s, d, _ = api("POST", "/api/v1/agente/llamar-siguiente", token=token)
    if s == 200:
        s, d, _ = api("POST", f"/api/v1/agente/turnos/{d['turno']['id']}/no-asistio", token=token)
        paso("Marca un turno como 'no asistió'", s == 200 and d["turno"]["estado"] == "NO_ASISTIO")

    _, panel, _ = api("GET", "/api/v1/agente/panel", token=token)
    r = panel.get("resumen", {})
    paso(
        "El panel refleja la jornada",
        r.get("atendidos_hoy", 0) >= 1,
        f"atendidos hoy {r.get('atendidos_hoy')}, no asistió {r.get('no_asistio_hoy')}",
    )

    s, _, _ = api("GET", "/api/v1/admin/agentes/metricas", token=token)
    paso("El agente NO puede ver métricas de admin", s == 403)


def escenario_admin(api):
    titulo("3. ADMINISTRADOR — gestión y métricas")
    token = login(api, ADMIN_CORREO, CLAVE_ADMIN)
    if not paso("Inicia sesión", token):
        return
    sufijo = str(int(time.time()))[-5:]

    s, d, _ = api(
        "POST",
        "/api/v1/sedes/",
        {"nombre": f"Sede Simulada {sufijo}", "direccion": "Calle 10"},
        token,
    )
    sede = d.get("punto", {})
    paso("Crea una sede", s == 201, sede.get("nombre", ""))
    s, d, _ = api(
        "PUT", f"/api/v1/sedes/{sede.get('id')}", {"direccion": "Calle 20 # 30-40"}, token
    )
    paso("Edita la sede", s == 200 and d["punto"]["direccion"] == "Calle 20 # 30-40")

    s, d, _ = api(
        "POST",
        "/api/v1/tramites/",
        {"nombre": f"Trámite Simulado {sufijo}", "tiempo_estimado": 12},
        token,
    )
    tramite = d.get("tramite", {})
    paso("Crea un trámite", s == 201, tramite.get("nombre", ""))
    s, _, _ = api(
        "POST",
        "/api/v1/tramites/",
        {"nombre": f"Trámite Simulado {sufijo}", "tiempo_estimado": 12},
        token,
    )
    paso("Rechaza trámite duplicado (409 Conflicto)", s == 409)

    s, d, _ = api(
        "POST",
        "/api/v1/admin/agentes/",
        {
            "nombre": "Agente Simulado",
            "correo": f"sim{sufijo}@filacero.co",
            "password": "Clave12345",
            "punto_id": sede.get("id"),
        },
        token,
    )
    paso("Crea un agente y le asigna sede", s == 201, d.get("agente", {}).get("sede", ""))
    agente_prueba = d.get("agente", {}).get("id")

    s, _, _ = api("DELETE", f"/api/v1/tramites/{tramite.get('id')}", token=token)
    paso("Elimina el trámite sin turnos", s == 200)
    s, _, _ = api("PUT", f"/api/v1/sedes/{sede.get('id')}", {"activo": False}, token)
    paso("Desactiva la sede de prueba", s == 200)
    # Limpieza: no deja rastros de la prueba en tu base de datos.
    s1, _, _ = api("DELETE", f"/api/v1/sedes/{sede.get('id')}", token=token)
    s2, _, _ = api("PUT", f"/api/v1/admin/usuarios/{agente_prueba}", {"activo": False}, token)
    paso("Limpia la sede y el asesor de prueba", s1 == 200 and s2 == 200)

    s, m, _ = api("GET", "/api/v1/admin/agentes/metricas", token=token)
    paso(
        "Consulta métricas generales",
        s == 200,
        f"{m.get('total_turnos')} turnos, {m.get('atendidos')} atendidos, "
        f"promedio {round((m.get('promedio_atencion_segundos') or 0) / 60, 1)} min",
    )
    s, d, _ = api("GET", "/api/v1/admin/agentes/metricas/sedes", token=token)
    paso(
        "Métricas por sede con nombre",
        s == 200 and all("nombre" in x for x in d.get("sedes", [])),
        ", ".join(f"{x['nombre']}: {x['total_turnos']}" for x in d.get("sedes", [])[:3]),
    )
    s, d, _ = api(
        "GET", "/api/v1/admin/agentes/historial?por_pagina=5&estado=ATENDIDO", token=token
    )
    paso(
        "Historial paginado con filtros",
        s == 200,
        f"{d.get('total')} atendidos en {d.get('total_paginas')} páginas",
    )


def escenario_permisos(api):
    titulo("4. USUARIOS Y PERMISOS")
    admin = login(api, ADMIN_CORREO, CLAVE_ADMIN)
    sufijo = str(int(time.time() * 1000))[-6:]
    s, d, _ = api(
        "POST",
        "/api/v1/admin/usuarios/",
        {
            "nombre": "Supervisor Simulado",
            "correo": f"sup{sufijo}@filacero.co",
            "rol": "SUPERVISOR",
        },
        admin,
    )
    temporal = d.get("clave_temporal")
    supervisor_id = d.get("usuario", {}).get("id")
    if not paso("El admin crea un supervisor con clave temporal", s == 201 and temporal):
        return
    token = login(api, f"sup{sufijo}@filacero.co", temporal)
    s, d, _ = api("GET", "/api/v1/admin/agentes/metricas", token=token)
    paso(
        "Con clave temporal no puede entrar al panel",
        s == 403 and d.get("codigo") == "CAMBIAR_CLAVE",
    )
    s, d, _ = api(
        "POST", "/api/v1/usuarios/me/clave", {"actual": temporal, "nueva": "Supervisor2026"}, token
    )
    paso("Cambia su contraseña y recibe una sesión nueva", s == 200 and d.get("access_token"))
    token = d.get("access_token")
    s, _, _ = api("GET", "/api/v1/admin/agentes/metricas", token=token)
    paso("El supervisor ve las métricas", s == 200)
    s, _, _ = api("POST", "/api/v1/sedes/", {"nombre": f"No permitida {sufijo}"}, token)
    paso("El supervisor NO puede crear sedes", s == 403)
    s, d, _ = api("GET", "/api/v1/admin/usuarios/auditoria?por_pagina=5", token=admin)
    paso(
        "La auditoría registra lo ocurrido",
        s == 200 and d.get("total", 0) > 0,
        ", ".join(e["accion_texto"] for e in d.get("eventos", [])[:3]),
    )
    s, _, _ = api("PUT", f"/api/v1/admin/usuarios/{supervisor_id}", {"activo": False}, admin)
    paso("Bloquea el acceso del supervisor de prueba", s == 200)


def escenario_seguridad(api):
    titulo("5. SEGURIDAD")
    s, _, _ = api("GET", "/api/v1/admin/agentes/metricas")
    paso("Sin token → 401", s == 401)
    s, _, _ = api("GET", "/api/v1/admin/agentes/metricas", token="token.falso.123")
    paso("Token falso → 401", s == 401)
    s, d, _ = api("POST", "/api/v1/usuarios/login", {"correo": ADMIN_CORREO, "password": "mala"})
    paso("Contraseña errada → mensaje genérico", s == 401, d.get("error", ""))
    s, _, _ = api("POST", "/api/v1/usuarios/registro", {"correo": "no-es-correo"})
    paso("Datos inválidos → 400 (no 500)", s == 400)
    _, _, h = api("GET", "/api/v1/horario", headers={"Origin": "https://sitio-malicioso.com"})
    paso("CORS bloquea orígenes no autorizados", "Access-Control-Allow-Origin" not in h)
    paso("Cabeceras de seguridad presentes", h.get("X-Frame-Options") == "DENY")


# ======================================================================
# PRUEBA DE CARGA
# ======================================================================


def _percentil(valores, p):
    if not valores:
        return 0
    v = sorted(valores)
    return v[min(len(v) - 1, int(round(p / 100 * (len(v) - 1))))]


def comando_carga(args):
    import threading
    from concurrent.futures import ThreadPoolExecutor

    if not args.url:
        print(f"{ROJO}La prueba de carga necesita --url (servidor encendido).{FIN}")
        return 1
    api = ClienteHTTP(args.url)
    s, d, _ = api("GET", "/api/v1/sedes/")
    sedes = d.get("puntos", [])
    _, d, _ = api("GET", "/api/v1/tramites/")
    tramites = d.get("tramites", [])
    if s != 200 or not sedes or not tramites:
        print(f"{ROJO}No hay sedes/trámites. Ejecuta antes: python simulacion.py --cargar{FIN}")
        return 1

    manana = (date.today() + timedelta(days=1)).isoformat()
    tiempos, errores, candado = {}, {}, threading.Lock()
    fin = time.time() + args.segundos

    def medir(nombre, metodo, ruta, cuerpo=None):
        t0 = time.perf_counter()
        estado, _, _ = api(metodo, ruta, cuerpo)
        ms = (time.perf_counter() - t0) * 1000
        with candado:
            tiempos.setdefault(nombre, []).append(ms)
            if estado >= 500 or estado == 429 or estado == 0:
                errores[nombre] = errores.get(nombre, 0) + 1
        return estado

    def usuario_virtual(i):
        r = random.Random(i)
        while time.time() < fin:
            sede, tramite = r.choice(sedes), r.choice(tramites)
            medir("Consultar horario", "GET", "/api/v1/horario")
            medir(
                "Disponibilidad",
                "GET",
                f"/api/v1/franjas/disponibles?sede_id={sede['id']}&tramite_id={tramite['id']}&fecha={manana}",
            )
            medir("Pantalla de sala", "GET", f"/api/v1/turnos/publico/sala?sede_id={sede['id']}")
            time.sleep(r.uniform(0.2, 0.8))  # tiempo de "pensar" de una persona

    print(
        f"Carga: {args.usuarios} usuarios simultáneos durante {args.segundos} s contra {args.url}"
    )
    with ThreadPoolExecutor(max_workers=args.usuarios) as ex:
        list(ex.map(usuario_virtual, range(args.usuarios)))

    total = sum(len(v) for v in tiempos.values())
    print(
        f"\n{NEGRITA}{'Operación':<22}{'peticiones':>11}{'p50 ms':>9}"
        f"{'p95 ms':>9}{'máx ms':>9}{'errores':>9}{FIN}"
    )
    for nombre, v in tiempos.items():
        print(
            f"{nombre:<22}{len(v):>11}{_percentil(v, 50):>9.0f}"
            f"{_percentil(v, 95):>9.0f}{max(v):>9.0f}{errores.get(nombre, 0):>9}"
        )
    print(f"Rendimiento: {total / args.segundos:.1f} peticiones/s")

    # --- Consistencia: reservas simultáneas a UNA franja no superan el cupo
    titulo("Reservas simultáneas a la misma franja")
    sede, tramite = sedes[0], tramites[0]
    pasado_manana = (date.today() + timedelta(days=2)).isoformat()
    _, d, _ = api(
        "GET",
        f"/api/v1/franjas/disponibles?sede_id={sede['id']}&tramite_id={tramite['id']}&fecha={pasado_manana}",
    )
    franjas = d.get("franjas", [])
    if not franjas:
        print("  (sin franjas libres para la prueba)")
        return 0
    franja = franjas[-1]
    cupo = franja["disponibles"]
    intentos = cupo + 12

    def reservar(i):
        celular = f"318{random.randint(1000000, 9999999)}"
        _, c, _ = api("POST", "/api/v1/turnos/publico/solicitar-codigo", {"celular": celular})
        _, v, _ = api(
            "POST",
            "/api/v1/turnos/publico/verificar-codigo",
            {"celular": celular, "codigo": c.get("codigo_prueba", "")},
        )
        estado, _, _ = api(
            "POST",
            "/api/v1/turnos/publico",
            {
                "nombre": f"Carga Concurrente {i}",
                "celular": celular,
                "token_verificacion": v.get("token_verificacion", ""),
                "punto_id": sede["id"],
                "tramite_id": tramite["id"],
                "franja_id": franja["franja_id"],
            },
        )
        return estado

    with ThreadPoolExecutor(max_workers=intentos) as ex:
        estados = list(ex.map(reservar, range(intentos)))
    aceptadas = estados.count(201)
    print(
        f"  {intentos} reservas al mismo tiempo a la franja {franja['hora_inicio']} "
        f"con {cupo} cupos libres"
    )
    paso(
        "Nunca se supera el cupo de la franja",
        aceptadas <= cupo,
        f"{aceptadas} aceptadas, {estados.count(409) + estados.count(400)} rechazadas por cupo",
    )
    return 0 if aceptadas <= cupo else 1


def comando_verificar(args):
    if args.url:
        print(f"Verificando contra {args.url} (usa los datos de --cargar)")
        api = ClienteHTTP(args.url)
    else:
        print("Verificando sobre una base de datos temporal en memoria (tus datos no se tocan)")
        from app import create_app, db
        from app.horario import hoy_local

        app = create_app(
            {
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
                "SECRET_KEY": secrets.token_urlsafe(48),
                "JWT_SECRET_KEY": secrets.token_urlsafe(48),
                "OTP_TEST_MODE": True,
                "RESTRINGIR_ATENCION_HORARIO": False,
                "RATE_LIMIT_ACTIVO": False,
            }
        )
        ctx = app.app_context()
        ctx.push()
        db.create_all()
        hoy = hoy_local()
        import contextlib
        import io

        with contextlib.redirect_stdout(io.StringIO()):
            _, t = cargar_semana(db, hoy - timedelta(days=2), hoy - timedelta(days=1), semilla=7)
        print(
            f"{GRIS}Datos de prueba: {len(SEDES)} sedes, {len(ASESORES)} asesores, "
            f"{sum(t.values())} turnos{FIN}"
        )
        api = ClienteLocal(app)

    escenario_ciudadano(api, args.celular)
    escenario_agente(api, ASESOR_DEMO)
    escenario_admin(api)
    escenario_permisos(api)
    escenario_seguridad(api)

    total = resultados["ok"] + resultados["fallo"]
    color = VERDE if not resultados["fallo"] else ROJO
    print(f"\n{color}{NEGRITA}{resultados['ok']}/{total} verificaciones correctas{FIN}")
    return 1 if resultados["fallo"] else 0


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--cargar",
        action="store_true",
        help="Reemplaza los datos del tenant y carga la semana demo",
    )
    parser.add_argument("--borrar", action="store_true", help="Solo borra los datos del tenant")
    parser.add_argument("--si", action="store_true", help="No pedir confirmación al borrar")
    parser.add_argument(
        "--permitir-borrar-remoto",
        action="store_true",
        help="Permite --cargar/--borrar en una BD remota; aún requiere confirmar BORRAR",
    )
    parser.add_argument("--desde", help="Primer día a simular (AAAA-MM-DD). Por defecto: hoy - 6")
    parser.add_argument("--hasta", help="Último día completo a simular. Por defecto: ayer")
    parser.add_argument(
        "--dias", type=int, help="Simula los N días anteriores a hoy (ej. --dias 15)"
    )
    parser.add_argument(
        "--turnos",
        type=int,
        default=1200,
        help="Turnos aproximados de los días pasados (0 = operación completa). Por defecto 1200",
    )
    parser.add_argument(
        "--semilla", type=int, help="Número fijo para repetir exactamente los mismos datos"
    )
    parser.add_argument("--url", help="Verificar contra un servidor, ej. http://127.0.0.1:5000")
    parser.add_argument(
        "--celular", default="3005550101", help="Celular ficticio para la verificación"
    )
    parser.add_argument("--carga", action="store_true", help="Prueba de carga contra --url")
    parser.add_argument(
        "--cuentas", action="store_true", help="Revisa las cuentas de CUENTAS_PROTEGIDAS"
    )
    parser.add_argument(
        "--probar-clave", action="store_true", help="Con --cuentas: prueba la contraseña"
    )
    parser.add_argument(
        "--desbloquear", action="store_true", help="Con --cuentas: quita el bloqueo por intentos"
    )
    parser.add_argument(
        "--usuarios", type=int, default=30, help="Usuarios simultáneos en la prueba de carga"
    )
    parser.add_argument("--segundos", type=int, default=20, help="Duración de la prueba de carga")
    parser.add_argument(
        "--en-vivo", action="store_true", help="Crea reservas cada pocos segundos (Ctrl+C para)"
    )
    parser.add_argument("--cada", type=int, default=10, help="Segundos entre ciclos en vivo")
    parser.add_argument(
        "--solo-reservas",
        action="store_true",
        help="Solo crea reservas; no simula agentes atendiendo",
    )
    parser.add_argument(
        "--duracion",
        type=int,
        default=0,
        help="Segundos de operación en vivo; 0 = hasta Ctrl+C",
    )
    parser.add_argument(
        "--tablero-cada",
        type=int,
        default=15,
        help="Frecuencia en segundos del tablero operativo de agentes",
    )
    parser.add_argument(
        "--por-ciclo",
        type=int,
        default=3,
        help="Reservas que intenta crear en cada ciclo en vivo (por defecto 3)",
    )
    args = parser.parse_args()

    if args.cada < 1:
        parser.error("--cada debe ser al menos 1 segundo.")
    if args.por_ciclo < 1 or args.por_ciclo > 20:
        parser.error("--por-ciclo debe estar entre 1 y 20.")
    if args.duracion < 0:
        parser.error("--duracion no puede ser negativa.")
    if args.tablero_cada < 5:
        parser.error("--tablero-cada debe ser al menos 5 segundos.")
    if args.dias is not None and args.dias < 1:
        parser.error("--dias debe ser al menos 1.")
    if args.turnos < 0:
        parser.error("--turnos no puede ser negativo.")

    if args.cuentas:
        return comando_cuentas(args)
    if args.en_vivo:
        return comando_en_vivo(args)

    if args.borrar:
        return comando_cargar(args, solo_borrar=True)
    if args.cargar:
        return comando_cargar(args)
    if args.carga:
        return comando_carga(args)
    return comando_verificar(args)


if __name__ == "__main__":
    sys.exit(main())
