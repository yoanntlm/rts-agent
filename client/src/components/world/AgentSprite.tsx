import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { AgentView } from "../../lib/types";

type Props = {
  agent: AgentView;
  selected: boolean;
  onClick: () => void;
};

const STATUS_COLOR_MOD: Record<AgentView["status"], number> = {
  idle: 1,
  working: 1,
  stuck: 0.5,
  done: 1.2,
  error: 0.7,
};

export default function AgentSprite({ agent, selected, onClick }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  // Idle bob + working bob (both subtle).
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const amp = agent.status === "working" ? 0.06 : 0.03;
    groupRef.current.position.z = 0.05 + Math.sin(t * 3) * amp;
  });

  const colorMod = STATUS_COLOR_MOD[agent.status];
  const baseColor = new THREE.Color(agent.color).multiplyScalar(colorMod);

  return (
    <group
      ref={groupRef}
      position={[agent.position.x + 0.5, agent.position.y + 0.5, 0.1]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0, -0.05]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={agent.color} transparent opacity={0.9} />
        </mesh>
      )}
      {/* Body */}
      <mesh>
        <circleGeometry args={[0.32, 24]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>
      {/* Status pip */}
      <mesh position={[0.25, 0.25, 0.01]}>
        <circleGeometry args={[0.08, 12]} />
        <meshBasicMaterial color={STATUS_PIP[agent.status]} />
      </mesh>
      {/* Stuck "?" indicator (just a small bright triangle for now) */}
      {agent.status === "stuck" && (
        <mesh position={[0, 0.55, 0.01]}>
          <circleGeometry args={[0.15, 12]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      )}
      {/* Done flag */}
      {agent.status === "done" && (
        <mesh position={[0.3, 0.4, 0.01]}>
          <planeGeometry args={[0.2, 0.15]} />
          <meshBasicMaterial color={agent.color} />
        </mesh>
      )}
    </group>
  );
}

const STATUS_PIP: Record<AgentView["status"], string> = {
  idle: "#a8a29e",
  working: "#34d399",
  stuck: "#facc15",
  done: "#60a5fa",
  error: "#f87171",
};
