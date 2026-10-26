import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./theme/themes.css";
import "./theme/radial-fix.css";
import "./theme/imagery.css";
import "./theme/adhan-video-overrides.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
