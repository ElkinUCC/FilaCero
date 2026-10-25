from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

def ejecutar_en_paralelo(operaciones):
    barrera = Barrier(len(operaciones))

    def ejecutar(operacion):
        barrera.wait()
        try:
            return operacion()
        except Exception as error:
            return error

    with ThreadPoolExecutor(
        max_workers=len(operaciones)
    ) as executor:
        return list(executor.map(ejecutar, operaciones))