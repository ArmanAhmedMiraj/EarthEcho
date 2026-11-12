import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/anek-latin/latin-400.css";
import "@fontsource/anek-latin/latin-600.css";
import "@fontsource/anek-latin/latin-700.css";
import "@fontsource/anek-latin/latin-800.css";
import "@fontsource/anek-bangla/bengali-400.css";
import "@fontsource/anek-bangla/bengali-600.css";
import "@fontsource/anek-bangla/bengali-700.css";
import "@fontsource/anek-bangla/bengali-800.css";
import "./styles.css";
import "./admin.css";
import "./farms.css";
import App from "./App.jsx";
import "./orbit.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
// The service worker lets the app install on a phone and show the last data it saw when there is no internet.
// It is only used in the real site, never while developing.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
