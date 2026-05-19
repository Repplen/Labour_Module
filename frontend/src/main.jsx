import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles/browserCompat.css";
import "./styles/variables.css";
import "./index.css";
import App from "./App";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")).render(
  <GlobalErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </GlobalErrorBoundary>
);
