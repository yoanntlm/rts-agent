import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (!convexUrl) {
  // No deployment configured — render the app shell with a setup banner.
  // App handles the missing-Convex case gracefully (empty world, disabled spawn).
  root.render(
    <React.StrictMode>
      <App convex={null} />
    </React.StrictMode>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  root.render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <App convex={convex} />
      </ConvexProvider>
    </React.StrictMode>,
  );
}
