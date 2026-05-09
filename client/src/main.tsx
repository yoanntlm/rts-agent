import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import Editor from "./components/editor/Editor";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const isEditor = window.location.pathname.replace(/\/$/, "") === "/editor";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (isEditor) {
  // Worldbuilder: client-only, no Convex needed.
  root.render(
    <React.StrictMode>
      <Editor />
    </React.StrictMode>,
  );
} else if (!convexUrl) {
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
