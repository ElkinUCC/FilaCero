"""FilaCero · Simulación de un centro de reparación de televisores.

Un solo archivo para todo lo que necesitas antes de la demo:

  1) CARGAR DATOS DEMO (borra la base de datos y la llena con una semana real)
       python simulacion.py --cargar
       python simulacion.py --cargar --si                       # sin preguntar
       python simulacion.py --cargar --desde 2026-10-25 --hasta 2026-10-30
       python simulacion.py --cargar --dias 15                  # 15 días, ~500 turnos
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
       python simulacion.py --en-vivo --cada 8                 # más rápido

  4) PRUEBA DE CARGA contra el servidor encendido (evidencia de rendimiento)
       python simulacion.py --carga --url http://127.0.0.1:5000 --usuarios 40 --segundos 20
     El servidor debe correr con RATE_LIMIT_ACTIVO=false y FILACERO_OTP_TEST_MODE=true
     (si no, el límite por IP corta la prueba, que es justo lo que debe hacer).

  5) VERIFICAR que todo funciona (no toca tu base de datos)
       python simulacion.py
       python simulacion.py --url http://127.0.0.1:5000        # contra el servidor
                                                                # (requiere --cargar antes)

El negocio simulado: TecniVisión, 5 sedes, 2 administradores y 8 asesores.
Atención todos los días de 8:00 a 18:00 en franjas de 30 min, máximo
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

SEDES = [
    ("Sede Centro", "Cra. 50 # 52-20, Centro, Medellín"),
    ("Sede El Poblado", "Cl. 10 # 43D-30, El Poblado, Medellín"),
    ("Sede Itagüí", "Cra. 50A # 50-45, Itagüí, Antioquia"),
    ("Sede Laureles", "Cra. 76 # 33A-15, Laureles, Medellín"),
    ("Sede Montería", "Cl. 29 # 3-40, Centro, Montería"),
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
        "Garantía y reclamos",
        "Revisión de equipos reparados que presentan una falla nuevamente.",
        8,
        12,
    ),
    ("Entrega de equipo reparado", "Prueba del televisor frente al cliente y entrega.", 5, 25),
    (
        "Cotización de repuestos",
        "Consulta de precio y disponibilidad de tarjetas, fuentes y controles.",
        5,
        13,
    ),
]

ADMINS = [
    ("Laura Gómez Arango", "laura.gomez@filacero.co"),
    ("Andrés Restrepo Mejía", "andres.restrepo@filacero.co"),
]
ADMIN_CORREO = ADMINS[0][1]

# nombre, correo, índice de sede (8 asesores: 2+2+2+1+1)
ASESORES = [
    ("Carlos Mejía", "carlos.mejia@filacero.co", 0),
    ("Diana Ospina", "diana.ospina@filacero.co", 0),
    ("Julián Cárdenas", "julian.cardenas@filacero.co", 1),
    ("Natalia Herrera", "natalia.herrera@filacero.co", 1),
    ("Mauricio Vélez", "mauricio.velez@filacero.co", 2),
    ("Paola Zuluaga", "paola.zuluaga@filacero.co", 2),
    ("Santiago Ríos", "santiago.rios@filacero.co", 3),
    ("Valeria Montes", "valeria.montes@filacero.co", 4),
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
}
DEMANDA_DIA = {0: 1.0, 1: 0.9, 2: 0.9, 3: 0.95, 4: 1.0, 5: 0.8, 6: 0.5}


# ======================================================================
# CARGA DE DATOS DEMO EN LA BASE DE DATOS
# ======================================================================


def borrar_todo(db):
    """Vacía todas las tablas de la aplicación (no toca alembic_version)."""
    # Cierra la transacción de la sesión ORM: en MySQL, una consulta previa sin
    # cerrar retiene un bloqueo de metadatos y TRUNCATE se quedaría esperando.
    db.session.rollback()
    db.session.close()
    tablas = list(reversed(db.metadata.sorted_tables))
    motor = db.engine.dialect.name
    with db.engine.begin() as con:
        if motor == "mysql":
            con.exec_driver_sql("SET FOREIGN_KEY_CHECKS = 0")
            for tabla in tablas:
                con.exec_driver_sql(f"TRUNCATE TABLE `{tabla.name}`")  # reinicia los IDs
            con.exec_driver_sql("SET FOREIGN_KEY_CHECKS = 1")
        else:
            for tabla in tablas:
                con.execute(tabla.delete())
    db.session.expire_all()
    return [t.name for t in tablas]


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
    clave_admin = encriptar_password(CLAVE_ADMIN)
    clave_asesor = encriptar_password(CLAVE_ASESOR)
    admins = [
        crear(Usuario, {"correo": c}, nombre=n, rol="ADMIN", activo=True, password_hash=clave_admin)
        for n, c in ADMINS
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
    db.session.commit()
    return {"sedes": sedes, "servicios": servicios, "admins": admins, "asesores": asesores}


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
    codigos = set()
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

    # Horas de inicio de las franjas del día (8:00, 8:30, ... 17:30)
    paso = timedelta(minutes=30)
    horas_dia, cursor = [], datetime.combine(hoy, apertura())
    while cursor + paso <= datetime.combine(hoy, cierre()):
        horas_dia.append(cursor.time())
        cursor += paso

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
                        fin_h = (datetime.combine(fecha, hora) + paso).time()
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


def _guardar_protegidas(app):
    """Copia (con su hash) las cuentas de CUENTAS_PROTEGIDAS antes de borrar."""
    from app.dominios.usuarios.modelos import Usuario

    correos = app.config.get("CUENTAS_PROTEGIDAS", [])
    if not correos:
        return []
    return [
        {
            "nombre": u.nombre,
            "correo": u.correo,
            "rol": u.rol,
            "password_hash": u.password_hash,
            "sede": u.punto_asignado.nombre if u.punto_asignado else None,
        }
        for u in Usuario.query.filter(Usuario.correo.in_(correos)).all()
    ]


def _restaurar_protegidas(db, copias):
    from app.dominios.sedes.modelos import Punto
    from app.dominios.usuarios.modelos import Usuario

    primera = Punto.query.filter_by(activo=True).order_by(Punto.id).first()
    for c in copias:
        sede = Punto.query.filter_by(nombre=c["sede"]).first() if c["sede"] else None
        if c["rol"] == "AGENTE" and not sede:
            sede = primera
        db.session.add(
            Usuario(
                nombre=c["nombre"],
                correo=c["correo"],
                rol=c["rol"],
                password_hash=c["password_hash"],
                activo=True,
                punto_asignado_id=sede.id if (sede and c["rol"] == "AGENTE") else None,
            )
        )
    db.session.commit()
    for c in copias:
        print(f"  {VERDE}✓{FIN} Cuenta protegida conservada: {c['correo']} ({c['rol']})")


def _descripcion_bd(app):
    uri = app.config["SQLALCHEMY_DATABASE_URI"]
    if "@" in uri:  # oculta la contraseña
        esquema, resto = uri.split("://", 1)
        uri = f"{esquema}://***@{resto.split('@', 1)[1]}"
    return uri


def comando_cargar(args, solo_borrar=False):
    from app import create_app, db

    app = create_app()
    with app.app_context():
        if app.config.get("PRODUCCION"):
            print(f"{ROJO}Por seguridad la simulación no se ejecuta con FLASK_ENV=production.{FIN}")
            return 1
        print(f"Base de datos: {NEGRITA}{_descripcion_bd(app)}{FIN}")
        if not args.si:
            print(
                f"{AMBAR}Se borrarán TODOS los registros "
                f"(sedes, trámites, usuarios, turnos, actividad).{FIN}"
            )
            if input("Escribe BORRAR para continuar: ").strip() != "BORRAR":
                print("Cancelado. No se modificó nada.")
                return 1

        protegidas = _guardar_protegidas(app)
        if db.engine.dialect.name == "sqlite":
            db.drop_all()  # SQLite (demo): esquema siempre al día con los modelos
            db.create_all()
        tablas = borrar_todo(db)
        print(f"{VERDE}✓{FIN} Base de datos vacía ({len(tablas)} tablas)")
        if solo_borrar:
            _restaurar_protegidas(db, protegidas)
            return 0

        from app.horario import hoy_local

        hoy = hoy_local()
        if args.dias and not args.desde:
            desde = hoy - timedelta(days=max(1, args.dias))
        else:
            desde = date.fromisoformat(args.desde) if args.desde else hoy - timedelta(days=6)
        hasta = date.fromisoformat(args.hasta) if args.hasta else hoy - timedelta(days=1)
        if desde > hasta:
            print(f"{ROJO}--desde no puede ser posterior a --hasta.{FIN}")
            return 1

        print(
            f"\nSimulando TecniVisión del {desde:%d/%m} al {hasta:%d/%m}, hoy hasta las "
            f"{datetime.now():%H:%M} y las reservas de mañana:"
        )
        inicio = time.time()
        datos, t = cargar_semana(
            db, desde, hasta, semilla=args.semilla, turnos_objetivo=args.turnos or None
        )
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
        for n, correo in ADMINS:
            print(f"  Administrador  {correo:<32} {CLAVE_ADMIN}   ({n})")
        for _n, correo, i in ASESORES:
            print(f"  Asesor         {correo:<32} {CLAVE_ASESOR}  ({SEDES[i][0]})")
        print(
            f"\n{GRIS}Para ver reservas llegando en vivo durante la presentación:"
            f"  python simulacion.py --en-vivo{FIN}"
        )
    return 0


# ======================================================================
# MODO EN VIVO: reservas llegando mientras se presenta
# ======================================================================


def comando_en_vivo(args):
    """Crea reservas de ciudadanos ficticios cada pocos segundos en la BD real,
    respetando el cupo por sede. Sirve para ver el panel y la consola reaccionar
    sin tocar nada. Ctrl+C para detener."""
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
        if app.config.get("PRODUCCION"):
            print(f"{ROJO}El modo en vivo no se ejecuta con FLASK_ENV=production.{FIN}")
            return 1
        sedes = Punto.query.filter_by(activo=True).all()
        servicios = Tramite.query.filter_by(activo=True).all()
        if not sedes or not servicios:
            print(f"{ROJO}No hay sedes o trámites. Primero: python simulacion.py --cargar{FIN}")
            return 1
        print(
            f"{NEGRITA}Modo en vivo{FIN} · {_descripcion_bd(app)}\n"
            f"Una reserva cada ~{args.cada} s (Ctrl+C para detener). "
            f"Mira el panel de admin y la consola del asesor.\n"
        )
        creadas = 0
        try:
            while True:
                ahora = ahora_local()
                sede = rnd.choice(sedes)
                servicio = rnd.choice(servicios)
                turno = None
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
                        f for f in proximas if fecha > ahora.date() or f.hora_inicio > ahora.time()
                    ][:4]
                    rnd.shuffle(proximas)
                    for franja in proximas:
                        prefijo = rnd.choice(["00", "10", "15", "20"])
                        celular = f"3{prefijo}{rnd.randint(1000000, 9999999)}"
                        nombre = (
                            f"{rnd.choice(NOMBRES)} {rnd.choice(APELLIDOS)} {rnd.choice(APELLIDOS)}"
                        )
                        try:
                            cliente = registrar_cliente_publico(nombre, celular)
                            turno = crear_turno(cliente.id, servicio.id, sede.id, franja.id)
                            break
                        except ValueError:
                            db.session.rollback()  # sin cupo: se intenta otra franja
                    if turno:
                        break
                if turno:
                    creadas += 1
                    print(
                        f"  {VERDE}●{FIN} {ahora:%H:%M:%S}  {turno.codigo}  "
                        f"{sede.nombre:<16} {servicio.nombre[:26]:<26} "
                        f"{turno.franja.fecha:%d/%m} {turno.franja.hora_inicio:%H:%M}  "
                        f"{GRIS}{nombre}{FIN}"
                    )
                else:
                    print(f"  {AMBAR}●{FIN} {ahora:%H:%M:%S}  {sede.nombre}: sin cupo cercano")
                # De vez en cuando alguien cancela (libera cupo, como en la vida real)
                if creadas and rnd.random() < 0.12:
                    espera = (
                        Turno.query.filter_by(estado="ESPERANDO")
                        .order_by(Turno.id.desc())
                        .limit(20)
                        .all()
                    )
                    if espera:
                        cancelado = rnd.choice(espera)
                        cancelado.estado = "CANCELADO"
                        db.session.commit()
                        print(f"  {GRIS}○ {cancelado.codigo} canceló su turno{FIN}")
                time.sleep(max(2, args.cada * rnd.uniform(0.6, 1.4)))
        except KeyboardInterrupt:
            print(f"\n{NEGRITA}Listo:{FIN} {creadas} reservas creadas en vivo.")
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
        print(f"    {GRIS}(activa FILACERO_OTP_TEST_MODE=true en el .env){FIN}")
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

    s, d, _ = api(
        "POST",
        "/api/v1/turnos/publico/consultar",
        {"codigo": turno.get("codigo"), "celular": celular},
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

    s, d, _ = api(
        "POST",
        "/api/v1/turnos/publico/cancelar",
        {"codigo": turno.get("codigo"), "celular": celular},
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
                f"    {GRIS}(fuera de 8:00–18:00: pon "
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
        f"{aceptadas} aceptadas, {estados.count(400)} rechazadas por cupo",
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
        "--cargar", action="store_true", help="Borra la BD y carga la semana simulada"
    )
    parser.add_argument("--borrar", action="store_true", help="Solo borra todos los registros")
    parser.add_argument("--si", action="store_true", help="No pedir confirmación al borrar")
    parser.add_argument("--desde", help="Primer día a simular (AAAA-MM-DD). Por defecto: hoy - 6")
    parser.add_argument("--hasta", help="Último día completo a simular. Por defecto: ayer")
    parser.add_argument(
        "--dias", type=int, help="Simula los N días anteriores a hoy (ej. --dias 15)"
    )
    parser.add_argument(
        "--turnos",
        type=int,
        default=500,
        help="Turnos aproximados de los días pasados (0 = operación completa). Por defecto 500",
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
        "--usuarios", type=int, default=30, help="Usuarios simultáneos en la prueba de carga"
    )
    parser.add_argument("--segundos", type=int, default=20, help="Duración de la prueba de carga")
    parser.add_argument(
        "--en-vivo", action="store_true", help="Crea reservas cada pocos segundos (Ctrl+C para)"
    )
    parser.add_argument("--cada", type=int, default=15, help="Segundos entre reservas en vivo")
    args = parser.parse_args()

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
