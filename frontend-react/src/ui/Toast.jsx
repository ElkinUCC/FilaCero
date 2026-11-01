import { createContext, useCallback, useContext, useState } from "react";
import Icon from "./Icon";

const Contexto = createContext(() => {});

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  const avisar = useCallback((texto, tipo = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo }]);
    window.setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === "error" ? 6000 : 3500);
  }, []);

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`toast toast--${a.tipo}`}>
            <Icon name={a.tipo === "error" ? "alerta" : "check"} size={17} />
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export const useToast = () => useContext(Contexto);
