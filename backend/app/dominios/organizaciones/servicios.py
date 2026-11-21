"""Servicios de la organización: validar y aplicar cambios de configuración."""

import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.errores import DatosInvalidosError

from . import repositorios as repo


def actualizar_configuracion(organizacion, datos):
    """Valida y aplica los cambios; si algo no es válido no se guarda nada."""
    try:
        _aplicar(organizacion, datos)
    except DatosInvalidosError:
        repo.deshacer()
        raise
    repo.confirmar()
    return organizacion


def _aplicar(organizacion, datos):
    permitidos = {
        "nombre",
        "industria",
        "pais",
        "zona_horaria",
        "idioma",
        "moneda",
        "configuracion",
    }
    no_permitidos = set(datos) - permitidos
    if no_permitidos:
        raise DatosInvalidosError(
            "Hay campos que no se pueden modificar.", detalles={"campos": sorted(no_permitidos)}
        )

    validaciones = {
        "nombre": (160, r".{2,160}"),
        "industria": (60, r"[a-zA-Z0-9_-]{2,60}"),
        "pais": (2, r"[A-Z]{2}"),
        "zona_horaria": (64, r"[A-Za-z_+-]+(?:/[A-Za-z0-9_+.-]+)*"),
        "idioma": (10, r"[a-z]{2}(?:-[A-Z]{2})?"),
        "moneda": (3, r"[A-Z]{3}"),
    }
    for campo, (maximo, patron) in validaciones.items():
        if campo not in datos:
            continue
        valor = datos[campo]
        if (
            not isinstance(valor, str)
            or len(valor) > maximo
            or not re.fullmatch(patron, valor.strip())
        ):
            raise DatosInvalidosError(f"El campo {campo} no tiene un formato válido.")
        if campo == "zona_horaria":
            try:
                ZoneInfo(valor.strip())
            except ZoneInfoNotFoundError:
                raise DatosInvalidosError("La zona horaria no existe en la base IANA.") from None
        setattr(organizacion, campo, valor.strip())

    if "configuracion" in datos:
        configuracion = datos["configuracion"]
        if not isinstance(configuracion, dict):
            raise DatosInvalidosError("La configuración debe ser un objeto JSON.")
        # No se permite almacenar credenciales ni secretos en este JSON.
        claves_prohibidas = {
            "password",
            "secret",
            "token",
            "api_key",
            "apikey",
            "private_key",
            "credential",
        }

        def contiene_secreto(valor):
            if isinstance(valor, dict):
                for clave, contenido in valor.items():
                    nombre = str(clave).lower()
                    if nombre in claves_prohibidas or any(
                        fragmento in nombre
                        for fragmento in (
                            "password",
                            "secret",
                            "token",
                            "api_key",
                            "private_key",
                            "credential",
                        )
                    ):
                        return True
                    if contiene_secreto(contenido):
                        return True
            elif isinstance(valor, list):
                return any(contiene_secreto(elemento) for elemento in valor)
            return False

        if contiene_secreto(configuracion):
            raise DatosInvalidosError(
                "Las credenciales deben gestionarse mediante un almacén de secretos."
            )

        horario = configuracion.get("horario", {})
        if not isinstance(horario, dict):
            raise DatosInvalidosError("configuracion.horario debe ser un objeto JSON.")
        campos_horario = {
            "apertura",
            "cierre",
            "dias_atencion",
            "duracion_franja_min",
            "dias_max_reserva",
            "duracion_max_atencion_min",
            "cupos_por_asesor_franja",
            "franjas_automaticas",
            "restringir_atencion_horario",
            "cola_solo_hoy",
        }
        if set(horario) - campos_horario:
            raise DatosInvalidosError("La configuración de horario contiene campos desconocidos.")
        for campo in ("apertura", "cierre"):
            if campo in horario and (
                type(horario[campo]) is not int or not 0 <= horario[campo] <= 24
            ):
                raise DatosInvalidosError(f"horario.{campo} debe ser un entero entre 0 y 24.")
        if (
            "apertura" in horario
            and "cierre" in horario
            and horario["cierre"] <= horario["apertura"]
        ):
            raise DatosInvalidosError("La hora de cierre debe ser posterior a la apertura.")
        for campo, minimo, maximo in (
            ("duracion_franja_min", 5, 240),
            ("dias_max_reserva", 1, 365),
            ("duracion_max_atencion_min", 1, 240),
            ("cupos_por_asesor_franja", 0, 500),
        ):
            if campo in horario and (
                type(horario[campo]) is not int or not minimo <= horario[campo] <= maximo
            ):
                raise DatosInvalidosError(f"horario.{campo} debe estar entre {minimo} y {maximo}.")
        if "dias_atencion" in horario and (
            not isinstance(horario["dias_atencion"], list)
            or not horario["dias_atencion"]
            or any(type(dia) is not int or dia not in range(7) for dia in horario["dias_atencion"])
            or len(set(horario["dias_atencion"])) != len(horario["dias_atencion"])
        ):
            raise DatosInvalidosError(
                "horario.dias_atencion debe contener días únicos entre 0 y 6."
            )
        for campo in ("franjas_automaticas", "restringir_atencion_horario", "cola_solo_hoy"):
            if campo in horario and not isinstance(horario[campo], bool):
                raise DatosInvalidosError(f"horario.{campo} debe ser booleano.")

        organizacion.configuracion = configuracion
