import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "webrtc-adapter";
import App from "./App";

//Import CSS files here if there's any
import "../global.css";
import "@/assets/css/backgroundBlobs.css";
import "@/assets/css/coins.background.css";

const root = createRoot(document.getElementById("root"));

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
