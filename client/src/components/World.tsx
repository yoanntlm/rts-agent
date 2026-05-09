import { Canvas, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { AgentView, RoomMap } from "../lib/types";
import Tilemap from "./world/Tilemap";
import AgentSprite from "./world/AgentSprite";
import BuildingSprite from "./world/BuildingSprite";
import MonumentSprite from "./world/MonumentSprite";

const MIN_ZOOM = 12;
const MAX_ZOOM = 120;
const DEFAULT_ZOOM = 28;

type Props = {
  agents: AgentView[];
  mapSize: RoomMap;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  placementColor?: string | null;
  onPlaceAgent?: (position: { x: number; y: number }) => void;
};

function isBuildableTile(
  tile: { x: number; y: number } | null,
  mapSize: RoomMap,
  occupied: Set<string>,
) {
  if (!tile) return false;
  if (tile.x <= 0 || tile.y <= 0 || tile.x >= mapSize.width - 1 || tile.y >= mapSize.height - 1) {
    return false;
  }
  return !occupied.has(`${tile.x},${tile.y}`);
}

export default function World({
  agents,
  mapSize,
  selectedAgentId,
  onSelectAgent,
  placementColor,
  onPlaceAgent,
}: Props) {
  const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);
  const [view, setView] = useState(() => ({
    x: mapSize.width / 2,
    y: mapSize.height / 2,
    zoom: DEFAULT_ZOOM,
  }));
  // Set briefly after a drag-pan ends, so the trailing click doesn't deselect
  // whatever agent the user had highlighted.
  const justPannedRef = useRef(false);
  const occupied = new Set(agents.map((agent) => `${agent.position.x},${agent.position.y}`));
  const placing = Boolean(placementColor && onPlaceAgent);
  const canPlace = isBuildableTile(hoverTile, mapSize, occupied);
  // Recenter when the room's map size changes (rare — only on first mount or
  // if the room doc updates).
  useEffect(() => {
    setView((v) => ({ ...v, x: mapSize.width / 2, y: mapSize.height / 2 }));
  }, [mapSize.width, mapSize.height]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        onPointerMissed={() => {
          if (justPannedRef.current) return;
          onSelectAgent(null);
        }}
        gl={{ antialias: true }}
        style={{ background: "#efe6cd" }}
      >
        <OrthographicCamera
          makeDefault
          position={[view.x, view.y, 50]}
          zoom={view.zoom}
          near={0.1}
          far={1000}
        />
        <WheelZoom onChange={setView} mapSize={mapSize} />
        <DragPan onChange={setView} justPannedRef={justPannedRef} mapSize={mapSize} />
        <ViewportClamp onChange={setView} mapSize={mapSize} />
        <ambientLight intensity={1} />
        <Tilemap width={mapSize.width} height={mapSize.height} tiles={mapSize.tiles} />
        {placing && (
          <mesh
            position={[mapSize.width / 2, mapSize.height / 2, 0.09]}
            onPointerMove={(e) => {
              e.stopPropagation();
              const x = Math.floor(e.point.x);
              const y = Math.floor(e.point.y);
              setHoverTile(
                x >= 0 && y >= 0 && x < mapSize.width && y < mapSize.height ? { x, y } : null,
              );
            }}
            onPointerOut={() => setHoverTile(null)}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (canPlace && hoverTile) onPlaceAgent?.(hoverTile);
            }}
          >
            <planeGeometry args={[mapSize.width, mapSize.height]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        {placing && hoverTile && (
          <group position={[hoverTile.x + 0.5, hoverTile.y + 0.5, 0.14]}>
            <mesh>
              <ringGeometry args={[0.42, 0.55, 40]} />
              <meshBasicMaterial
                color={canPlace ? placementColor ?? "#4ECDC4" : "#71717a"}
                transparent
                opacity={canPlace ? 0.9 : 0.45}
              />
            </mesh>
            <mesh position={[0, 0, -0.01]}>
              <planeGeometry args={[0.92, 0.92]} />
              <meshBasicMaterial
                color={canPlace ? placementColor ?? "#4ECDC4" : "#27272a"}
                transparent
                opacity={canPlace ? 0.12 : 0.28}
              />
            </mesh>
          </group>
        )}
        {/* Workshop tile — animated construction site while building, swapped
            for a finished Singapore landmark image once the user clicks
            "Finish task". Anchor is `workshopTile` on the doc; for legacy
            rows we fall back to (destination.x, destination.y + 2). */}
        {agents.map((agent) => {
          const anchor =
            agent.workshopTile ??
            (agent.destination
              ? { x: agent.destination.x, y: agent.destination.y + 2 }
              : null);
          if (!anchor) return null;
          if (agent.monumentImage) {
            return (
              <MonumentSprite
                key={`monument-${agent.id}`}
                src={agent.monumentImage}
                position={anchor}
              />
            );
          }
          return (
            <BuildingSprite
              key={`construction-${agent.id}`}
              name="construction-zone-3x3"
              position={anchor}
            />
          );
        })}
        {agents.map((agent) => {
          // Once a finished agent has walked back to its home tile, drop the
          // sprite entirely — the monument stays, the agent is "gone".
          if (
            agent.monumentImage &&
            agent.destination &&
            agent.position.x === agent.destination.x &&
            agent.position.y === agent.destination.y
          ) {
            return null;
          }
          return (
            <AgentSprite
              key={agent.id}
              agent={agent}
              selected={agent.id === selectedAgentId}
              onClick={() => onSelectAgent(agent.id)}
            />
          );
        })}
      </Canvas>

      {agents.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-xs rounded-xl border border-line bg-paper/90 p-4 text-center shadow-xl shadow-amber-900/10 backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-800">
              Awaiting deployment
            </div>
            <p className="mt-2 text-sm font-medium text-ink">
              Hit <span className="text-cyan-800">+ Spawn agent</span> in the top-left to pick a specialist and describe the task.
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              The command grid is ready. Agents will appear here as soon as Convex confirms the spawn.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

type View = { x: number; y: number; zoom: number };
type ViewSetter = React.Dispatch<React.SetStateAction<View>>;

// Clamp zoom so the map always fills the viewport in both axes, and clamp x/y
// so the visible rect stays inside the map (no overscroll past the edges).
function clampView(
  view: View,
  map: RoomMap,
  rect: { width: number; height: number },
): View {
  if (rect.width <= 0 || rect.height <= 0) return view;
  const fitZoom = Math.max(rect.width / map.width, rect.height / map.height);
  const minZoom = Math.max(MIN_ZOOM, fitZoom);
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom, view.zoom));
  const halfW = rect.width / (2 * zoom);
  const halfH = rect.height / (2 * zoom);
  // Guards against fp drift where halfW/H slightly exceeds map/2 at the fit zoom.
  const x =
    halfW * 2 >= map.width ? map.width / 2 : Math.min(Math.max(view.x, halfW), map.width - halfW);
  const y =
    halfH * 2 >= map.height ? map.height / 2 : Math.min(Math.max(view.y, halfH), map.height - halfH);
  return { zoom, x, y };
}

// Re-applies clampView after the canvas mounts and whenever it resizes, so the
// initial DEFAULT_ZOOM (or a stale view from a prior map size) is corrected.
function ViewportClamp({ onChange, mapSize }: { onChange: ViewSetter; mapSize: RoomMap }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const apply = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      onChange((prev) => clampView(prev, mapSize, rect));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [gl, onChange, mapSize]);
  return null;
}

// Scroll-wheel + trackpad pinch zoom that anchors on the cursor's world point
// so zooming in keeps whatever you're hovering centered. preventDefault stops
// the browser from page-zooming when the cursor is over the canvas.
function WheelZoom({ onChange, mapSize }: { onChange: ViewSetter; mapSize: RoomMap }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      // exp(-deltaY * k) gives smooth multiplicative zoom in both directions.
      // Trackpad pinch sets ctrlKey; bump sensitivity there since deltaY is small.
      const k = e.ctrlKey ? 0.01 : 0.0015;
      const factor = Math.exp(-e.deltaY * k);

      // Functional update so consecutive wheel ticks compose on the latest
      // accumulated state instead of all reading the original camera values.
      onChange((prev) => {
        const newZoom = prev.zoom * factor;
        // World point currently under the cursor — stays fixed across the zoom.
        const worldX = prev.x + (ndcX * rect.width) / (2 * prev.zoom);
        const worldY = prev.y + (ndcY * rect.height) / (2 * prev.zoom);
        const candidate = {
          zoom: newZoom,
          x: worldX - (ndcX * rect.width) / (2 * newZoom),
          y: worldY - (ndcY * rect.height) / (2 * newZoom),
        };
        return clampView(candidate, mapSize, rect);
      });
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [gl, onChange, mapSize]);

  return null;
}

// Left-button drag-to-pan. Movement under THRESHOLD is treated as a click, so
// agent selection (R3F onClick) still works on a quick tap. Once the threshold
// is crossed, we set justPannedRef so World's onPointerMissed skips deselect on
// the trailing pointerup.
function DragPan({
  onChange,
  justPannedRef,
  mapSize,
}: {
  onChange: ViewSetter;
  justPannedRef: React.MutableRefObject<boolean>;
  mapSize: RoomMap;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const THRESHOLD = 4; // px before a click becomes a drag

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let active = false;
    let panning = false;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      active = true;
      panning = false;
      startX = lastX = e.clientX;
      startY = lastY = e.clientY;
    };

    const onMove = (e: PointerEvent) => {
      if (!active) return;
      if (!panning) {
        if (
          Math.abs(e.clientX - startX) < THRESHOLD &&
          Math.abs(e.clientY - startY) < THRESHOLD
        )
          return;
        panning = true;
        canvas.style.cursor = "grabbing";
        canvas.setPointerCapture?.(e.pointerId);
      }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const rect = canvas.getBoundingClientRect();
      // Functional update — multiple pointermoves between renders compose
      // correctly. Three.js Y is up vs. screen Y down, hence the sign flip.
      onChange((prev) =>
        clampView(
          {
            x: prev.x - dx / prev.zoom,
            y: prev.y + dy / prev.zoom,
            zoom: prev.zoom,
          },
          mapSize,
          rect,
        ),
      );
    };

    const onUp = () => {
      if (panning) {
        canvas.style.cursor = "";
        justPannedRef.current = true;
        // Clear after the trailing click event is dispatched, so onPointerMissed
        // sees the flag and skips its deselect call.
        window.setTimeout(() => {
          justPannedRef.current = false;
        }, 50);
      }
      active = false;
      panning = false;
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gl, onChange, justPannedRef, mapSize]);

  return null;
}
