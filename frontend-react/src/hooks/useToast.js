/** Avisos breves (toasts). El proveedor está en components/ui/Toast.jsx. */
import { createContext, useContext } from "react";

export const ContextoAvisos = createContext(() => {});

/** const avisar = useToast(); avisar("Guardado"); avisar("Falló", "error"); */
export const useToast = () => useContext(ContextoAvisos);
