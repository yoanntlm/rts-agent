import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AgentView } from "../../lib/types";

type Props = {
  agent: AgentView;
  selected: boolean;
  onClick: () => void;
};

const BODY_FILL = new THREE.Color("#15110f");
const ERROR_RED = new THREE.Color("#ef4444");
const STUCK_YELLOW = "#facc15";
const PI2 = Math.PI * 2;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function desaturate(color: string, amount: number) {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s * (1 - amount), hsl.l);
  return c;
}

export default function AgentSprite({ agent, selected, onClick }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const selectedMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const progressMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const progressTrailMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const indicatorRef = useRef<THREE.Group>(null);
  const sparkleGroupRef = useRef<THREE.Group>(null);
  const sparkleStartedAtRef = useRef<number | null>(null);
  const previousStatusRef = useRef<AgentView["status"]>(agent.status);
  const statusChangedAtRef = useRef(0);

  const progress = Math.max(0, Math.min(1, agent.progress ?? 0));
  const progressArc = Math.max(0.001, progress * PI2);
  const trailArc = Math.min(progressArc, PI2 * 0.18);
  const trailStart = Math.max(0, progressArc - trailArc);
  const ringColor = useMemo(() => new THREE.Color(agent.color), [agent.color]);
  const bodyColor = useMemo(
    () =>
      agent.status === "stuck"
        ? desaturate(agent.color, 0.4).multiplyScalar(0.55)
        : BODY_FILL.clone(),
    [agent.color, agent.status],
  );

  const sparkleAngles = useMemo(
    () => Array.from({ length: 6 }, (_, i) => (i / 6) * PI2 + (i % 2) * 0.22),
    [],
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const t = state.clock.getElapsedTime();
    if (previousStatusRef.current !== agent.status) {
      statusChangedAtRef.current = t;
      sparkleStartedAtRef.current = agent.status === "done" ? t : null;
      previousStatusRef.current = agent.status;
    }

    const targetX = agent.position.x + 0.5;
    const targetY = agent.position.y + 0.5;
    const idleFloat = easeInOutCubic((Math.sin(t * 1.4) + 1) / 2) * 0.056 - 0.028;
    const workingBob = easeInOutCubic((Math.sin(t * 5.6) + 1) / 2) * 0.038 - 0.019;
    const floatOffset = agent.status === "working" ? workingBob : idleFloat;

    group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, 0.08);
    group.position.y = THREE.MathUtils.lerp(group.position.y, targetY + floatOffset, 0.08);
    group.position.z = 0.12;

    const elapsedSinceChange = t - statusChangedAtRef.current;
    const errorFlash = agent.status === "error" && elapsedSinceChange < 0.22;
    const errorDim = agent.status === "error" ? 0.6 : 1;

    if (bodyMaterialRef.current) {
      bodyMaterialRef.current.color.copy(errorFlash ? ERROR_RED : bodyColor);
      bodyMaterialRef.current.opacity = errorDim;
    }

    if (ringMaterialRef.current) {
      ringMaterialRef.current.color.copy(errorFlash ? ERROR_RED : ringColor);
      ringMaterialRef.current.opacity = errorDim;
    }

    if (selectedMaterialRef.current) {
      selectedMaterialRef.current.opacity = 0.65 + Math.sin(t * 2.2) * 0.25;
    }

    if (progressMaterialRef.current) {
      progressMaterialRef.current.opacity = 0.72 + Math.sin(t * 3.2) * 0.1;
    }

    if (progressTrailMaterialRef.current) {
      progressTrailMaterialRef.current.opacity = 0.92 + Math.sin(t * 4.4) * 0.08;
    }

    if (indicatorRef.current) {
      const pulse = easeInOutCubic((Math.sin(t * 2.6) + 1) / 2);
      indicatorRef.current.position.y = 0.68 + pulse * 0.08;
      indicatorRef.current.scale.setScalar(0.92 + pulse * 0.1);
    }

    if (sparkleGroupRef.current) {
      const startedAt = sparkleStartedAtRef.current;
      const age = startedAt == null ? Number.POSITIVE_INFINITY : t - startedAt;
      const active = age < 0.95;
      sparkleGroupRef.current.visible = active;

      if (active) {
        const eased = easeOutCubic(Math.max(0, Math.min(1, age / 0.95)));
        sparkleGroupRef.current.children.forEach((child, i) => {
          const angle = sparkleAngles[i] ?? 0;
          const distance = 0.22 + eased * 0.52;
          child.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance, 0.08);
          child.scale.setScalar(1 - eased * 0.42);
          const material = (child as THREE.Mesh).material;
          if (material instanceof THREE.MeshBasicMaterial) {
            material.opacity = 1 - eased;
          }
        });
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[agent.position.x + 0.5, agent.position.y + 0.5, 0.12]}
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
      {/* Drop shadow */}
      <mesh position={[0.05, -0.07, -0.05]}>
        <circleGeometry args={[0.42, 40]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.48} depthWrite={false} />
      </mesh>

      {selected && (
        <mesh position={[0, 0, -0.02]}>
          <ringGeometry args={[0.53, 0.65, 56]} />
          <meshBasicMaterial
            ref={selectedMaterialRef}
            color={agent.color}
            transparent
            opacity={0.65}
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh position={[0, 0, 0.01]}>
        <ringGeometry args={[0.35, 0.45, 48]} />
        <meshBasicMaterial ref={ringMaterialRef} color={agent.color} transparent />
      </mesh>

      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.35, 48]} />
        <meshBasicMaterial ref={bodyMaterialRef} color={bodyColor} transparent />
      </mesh>

      {agent.status === "working" && (
        <>
          <mesh position={[0, 0, 0.04]} rotation={[0, 0, -Math.PI / 2]}>
            <ringGeometry args={[0.5, 0.56, 64, 1, 0, progressArc]} />
            <meshBasicMaterial
              ref={progressMaterialRef}
              color={agent.color}
              transparent
              opacity={0.78}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0, 0.05]} rotation={[0, 0, -Math.PI / 2 + trailStart]}>
            <ringGeometry args={[0.565, 0.62, 24, 1, 0, trailArc]} />
            <meshBasicMaterial
              ref={progressTrailMaterialRef}
              color="#ffffff"
              transparent
              opacity={0.95}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {agent.status === "stuck" && (
        <group ref={indicatorRef}>
          <mesh position={[0, 0, 0.04]}>
            <circleGeometry args={[0.18, 24]} />
            <meshBasicMaterial color="#17120a" transparent opacity={0.92} />
          </mesh>
          <Html center transform position={[0, 0.01, 0.08]} distanceFactor={9}>
            <div className="font-mono text-[10px] font-black leading-none text-yellow-300 drop-shadow">
              ?
            </div>
          </Html>
        </group>
      )}

      {agent.status === "done" && (
        <>
          <group ref={sparkleGroupRef}>
            {sparkleAngles.map((angle) => (
              <mesh key={angle} position={[Math.cos(angle) * 0.2, Math.sin(angle) * 0.2, 0.08]}>
                <circleGeometry args={[0.045, 10]} />
                <meshBasicMaterial color="#fde68a" transparent opacity={0} depthWrite={false} />
              </mesh>
            ))}
          </group>
          <group position={[0.3, 0.34, 0.06]}>
            <mesh position={[0, -0.08, 0]}>
              <planeGeometry args={[0.035, 0.34]} />
              <meshBasicMaterial color="#d6d3d1" />
            </mesh>
            <mesh position={[0.09, 0.04, 0.01]}>
              <planeGeometry args={[0.18, 0.13]} />
              <meshBasicMaterial color={agent.color} />
            </mesh>
          </group>
        </>
      )}

      {agent.status === "error" && (
        <group ref={indicatorRef} position={[0, 0.74, 0.04]}>
          <mesh>
            <circleGeometry args={[0.17, 24]} />
            <meshBasicMaterial color="#2b0808" transparent opacity={0.95} />
          </mesh>
          <Html center transform position={[0, 0.01, 0.08]} distanceFactor={9}>
            <div className="font-mono text-[10px] font-black leading-none text-red-300 drop-shadow">
              !
            </div>
          </Html>
        </group>
      )}

      {agent.lastMessage ? (
        <Html center transform position={[0, 0.52, 0.08]} distanceFactor={7}>
          <div
            className="pointer-events-none max-w-[148px] truncate rounded-md border px-1.5 py-0.5 font-mono text-[8px] leading-tight text-stone-100 shadow-lg shadow-black/40"
            style={{
              borderColor: `${agent.color}66`,
              background: "rgba(12,10,9,0.94)",
            }}
            title={agent.lastMessage}
          >
            {agent.lastMessage}
          </div>
        </Html>
      ) : null}

      <Html center transform position={[0, -0.62, 0.08]} distanceFactor={8}>
        <div
          className="max-w-24 truncate rounded-full border border-stone-700/70 bg-stone-950/90 px-1.5 py-0.5 font-mono text-[8px] font-semibold shadow-lg shadow-black/40"
          style={{ color: agent.color }}
        >
          {agent.name}
        </div>
      </Html>
    </group>
  );
}
