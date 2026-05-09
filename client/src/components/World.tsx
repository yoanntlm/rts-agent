import { Canvas } from "@react-three/fiber";
import { OrthographicCamera } from "@react-three/drei";
import type { AgentView, RoomMap } from "../lib/types";
import Tilemap from "./world/Tilemap";
import AgentSprite from "./world/AgentSprite";

type Props = {
  agents: AgentView[];
  mapSize: RoomMap;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
};

export default function World({ agents, mapSize, selectedAgentId, onSelectAgent }: Props) {
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
          zoom={28}
          near={0.1}
          far={1000}
        />
        <ambientLight intensity={1} />
        <Tilemap width={mapSize.width} height={mapSize.height} />
        {agents.map((agent) => (
          <AgentSprite
            key={agent.id}
            agent={agent}
            selected={agent.id === selectedAgentId}
            onClick={() => onSelectAgent(agent.id)}
          />
        ))}
      </Canvas>
    </div>
  );
}
