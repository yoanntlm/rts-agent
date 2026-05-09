import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import { useState } from "react";
import type { AgentView, RoomMap } from "../lib/types";
import Tilemap from "./world/Tilemap";
import AgentSprite from "./world/AgentSprite";

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
  const occupied = new Set(agents.map((agent) => `${agent.position.x},${agent.position.y}`));
  const placing = Boolean(placementColor && onPlaceAgent);
  const canPlace = isBuildableTile(hoverTile, mapSize, occupied);

  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        onPointerMissed={() => onSelectAgent(null)}
        gl={{ antialias: true }}
        style={{ background: "#0c0a09" }}
      >
        <OrthographicCamera
          makeDefault
          position={[mapSize.width / 2, mapSize.height / 2, 50]}
          zoom={36}
          near={0.1}
          far={1000}
        />
        <ambientLight intensity={1} />
        <Tilemap width={mapSize.width} height={mapSize.height} />
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
        {agents.map((agent) => (
          <AgentSprite
            key={agent.id}
            agent={agent}
            selected={agent.id === selectedAgentId}
            onClick={() => onSelectAgent(agent.id)}
          />
        ))}
      </Canvas>

      {agents.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-xs rounded-xl border border-cyan-200/10 bg-stone-950/75 p-4 text-center shadow-2xl shadow-black/40 backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/70">
              Awaiting deployment
            </div>
            <p className="mt-2 text-sm font-medium text-stone-200">
              Choose a specialist from the roster, then describe the task to spawn your first agent.
            </p>
            <p className="mt-2 text-xs text-stone-500">
              The command grid is ready. Agents will appear here as soon as Convex confirms the spawn.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
