import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./styles.css";
import { App } from "./App";
import { ProgressProvider } from "./store/ProgressContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </HashRouter>
  </StrictMode>,
);

// Offline support: production builds only, on secure origins (localhost counts).
if (import.meta.env.PROD && "serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((e) => console.warn("Offline mode unavailable:", e)));
}
