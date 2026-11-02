// Los estilos base van primero: los de cada página (css/*.css) los sobrescriben.
import "./css/index.css";
import "./css/ui.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
