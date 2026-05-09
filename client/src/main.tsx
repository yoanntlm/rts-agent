import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import Editor from "./components/editor/Editor";
import Playground from "./components/playground/Playground";
import Preview from "./components/preview/Preview";
import Anchors from "./components/anchors/Anchors";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const path = window.location.pathname.replace(/\/$/, "");
const isPlayground = path === "/playground";
const isPreview = path === "/preview";
const isAnchors = path === "/anchors";
const editorRoomMatch = path.match(/^\/r\/([a-z0-9]{1,32})\/editor$/i);
const isEditor = path === "/editor" || Boolean(editorRoomMatch);

// Multi-room routing
//
// "/r/<slug>" → join that room.
// "/" or anything else → mint a fresh slug and rewrite the URL so each first-
// time visitor lands in their own private project, and the URL is the share
// link they hand to a friend.
//
// Slug is 6 alphanumeric chars (lowercase) — easy to type, ~36^6 = 2.1B combos.
function readOrCreateRoomSlug(): string {
  const m = path.match(/^\/r\/([a-z0-9]{1,32})$/i);
  if (m) return m[1]!.toLowerCase();
  const slug = mintSlug();
  // Use replaceState so we don't break the back button.
  history.replaceState(null, "", `/r/${slug}`);
  return slug;
}

function mintSlug(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (isPlayground) {
  // Asset playground: client-only, talks to /api/img/* via the Vite middleware.
  root.render(
    <React.StrictMode>
      <Playground />
    </React.StrictMode>,
  );
} else if (isAnchors) {
  // Workshop-anchor picker: click 10 tiles, copy array → paste into
  // workshopAnchors.ts to relocate construction sites.
  root.render(
    <React.StrictMode>
      <Anchors />
    </React.StrictMode>,
  );
} else if (isPreview) {
  // Animated-building preview / debug page.
  root.render(
    <React.StrictMode>
      <Preview />
    </React.StrictMode>,
  );
} else if (isEditor && editorRoomMatch && convexUrl) {
  const roomName = editorRoomMatch[1]!.toLowerCase();
  const convex = new ConvexReactClient(convexUrl);
  root.render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <Editor roomName={roomName} />
      </ConvexProvider>
    </React.StrictMode>,
  );
} else if (isEditor) {
  // Local-only worldbuilder fallback.
  root.render(
    <React.StrictMode>
      <Editor />
    </React.StrictMode>,
  );
} else if (!convexUrl) {
  // No deployment configured — render the app shell with a setup banner.
  root.render(
    <React.StrictMode>
      <App convex={null} roomName="demo" />
    </React.StrictMode>,
  );
} else {
  const roomName = readOrCreateRoomSlug();
  const convex = new ConvexReactClient(convexUrl);
  root.render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <App convex={convex} roomName={roomName} />
      </ConvexProvider>
    </React.StrictMode>,
  );
}
