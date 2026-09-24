import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@devbox/ui/styles.css";
import "./i18n";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
