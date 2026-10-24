from app.dominios.turnos.dtos import turno_response


def cola_response(turnos):
    return {
        "total_en_espera": len(turnos),
        "turnos": [turno_response(turno) for turno in turnos]
    }