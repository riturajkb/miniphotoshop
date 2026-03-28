import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

/**
 * React entry point - mounts the application.
 */
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
