from .repositorios import obtener_activos, obtener_por_id


def listar_tramites():
    return obtener_activos()


def buscar_tramite(tramite_id):
    return obtener_por_id(tramite_id)