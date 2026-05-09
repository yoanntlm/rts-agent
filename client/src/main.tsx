import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import Editor from "./components/editor/Editor";
import Playground from "./components/playground/Playground";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const path = window.location.pathname.replace(/\/$/, "");
const isEditor = path === "/editor";
const isPlayground = path === "/playground";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (isPlayground) {
  // Asset playground: client-only, talks to /api/img/* via the Vite middleware.
  root.render(
    <React.StrictMode>
      <Playground />
    </React.StrictMode>,
  );
} else if (isEditor) {
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
