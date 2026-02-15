"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ====================================================================
   Engine plume  –  animated fire cone
   ==================================================================== */

export function EnginePlume({
  throttle = 1,
  scale = 1,
  vacuum = false,
}: {
  throttle: number;
  scale?: number;
  vacuum?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const flicker = useRef(0);

  useFrame((_, dt) => {
    if (!ref.current) return;
    flicker.current += dt * 40;
    const f = 0.85 + 0.15 * Math.sin(flicker.current);
    ref.current.scale.setScalar(throttle * f * scale);
  });

  const width = vacuum ? 0.6 : 0.22;
  const length = vacuum ? 2.8 : 1.6;

  return (
    <group ref={ref}>
      {/* Bright inner core */}
      <mesh position={[0, -length * 0.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[width * 0.5, length, 16]} />
        <meshBasicMaterial color="#ffe066" transparent opacity={0.95} />
      </mesh>
      {/* Outer glow */}
      <mesh position={[0, -length * 0.55, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[width, length * 1.2, 16]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.35} />
      </mesh>
      {/* Shock diamond core */}
      <mesh position={[0, -length * 0.3, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[width * 0.2, length * 0.6, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      {/* Point light for illumination */}
      <pointLight
        color="#ff8800"
        intensity={throttle * 8}
        distance={4}
        position={[0, -length * 0.4, 0]}
      />
    </group>
  );
}

/* ====================================================================
   Falcon 9 First Stage  (booster)
   ==================================================================== */

export function Falcon9FirstStage({
  gridFins = false,
  legs = false,
  throttle = 0,
  engineCount = 9,
}: {
  gridFins?: boolean;
  legs?: boolean;
  throttle?: number;
  engineCount?: number;
}) {
  return (
    <group>
      {/* ---- Main body tube ---- */}
      <mesh>
        <cylinderGeometry args={[0.185, 0.185, 4.2, 24]} />
        <meshStandardMaterial color="#e8e4e0" metalness={0.15} roughness={0.65} />
      </mesh>

      {/* ---- Interstage (top ring) ---- */}
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.195, 0.195, 0.25, 24]} />
        <meshStandardMaterial color="#222" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* ---- Race stripe (dark worm logo area) ---- */}
      <mesh position={[0, 0.5, 0.188]}>
        <boxGeometry args={[0.06, 2.5, 0.005]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* ---- Landing legs (4x, deployable) ---- */}
      {legs &&
        [0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <group key={`leg-${deg}`} rotation={[0, rad, 0]}>
              <mesh position={[0.22, -1.8, 0]} rotation={[0, 0, 0.35]}>
                <boxGeometry args={[0.02, 1.0, 0.06]} />
                <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
              </mesh>
              {/* Foot */}
              <mesh position={[0.4, -2.25, 0]}>
                <boxGeometry args={[0.08, 0.02, 0.12]} />
                <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          );
        })}

      {/* ---- Grid fins (4x, deployable) ---- */}
      {gridFins &&
        [45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <group key={`gf-${deg}`} rotation={[0, rad, 0]}>
              <mesh position={[0.28, 1.7, 0]}>
                <boxGeometry args={[0.22, 0.16, 0.015]} />
                <meshStandardMaterial
                  color="#444"
                  metalness={0.85}
                  roughness={0.2}
                  emissive="#222"
                  emissiveIntensity={0.2}
                />
              </mesh>
            </group>
          );
        })}

      {/* ---- Octaweb engine cluster (9 engines) ---- */}
      <group position={[0, -2.15, 0]}>
        {/* Center engine */}
        <mesh>
          <cylinderGeometry args={[0.04, 0.06, 0.15, 12]} />
          <meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Ring of 8 engines */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11]}>
              <cylinderGeometry args={[0.035, 0.05, 0.12, 12]} />
              <meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} />
            </mesh>
          );
        })}
      </group>

      {/* ---- Engine plume ---- */}
      {throttle > 0 && (
        <group position={[0, -2.3, 0]}>
          <EnginePlume throttle={throttle} scale={engineCount === 1 ? 0.5 : 1} />
        </group>
      )}
    </group>
  );
}

/* ====================================================================
   Falcon 9 Second Stage
   ==================================================================== */

export function Falcon9SecondStage({
  throttle = 0,
  vacuum = true,
}: {
  throttle?: number;
  vacuum?: boolean;
}) {
  return (
    <group>
      {/* ---- Body tube ---- */}
      <mesh>
        <cylinderGeometry args={[0.185, 0.185, 1.3, 24]} />
        <meshStandardMaterial color="#e8e4e0" metalness={0.15} roughness={0.65} />
      </mesh>

      {/* ---- MVac engine bell ---- */}
      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[0.06, 0.15, 0.4, 16]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* ---- Engine plume ---- */}
      {throttle > 0 && (
        <group position={[0, -1.05, 0]}>
          <EnginePlume throttle={throttle} vacuum={vacuum} />
        </group>
      )}
    </group>
  );
}

/* ====================================================================
   Payload Fairing
   ==================================================================== */

export function PayloadFairing({ separated = false }: { separated?: boolean }) {
  if (separated) return null;
  return (
    <group>
      {/* ---- Cylindrical base ---- */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.6, 24]} />
        <meshStandardMaterial color="#f0ece8" metalness={0.1} roughness={0.7} />
      </mesh>
      {/* ---- Nose cone ---- */}
      <mesh position={[0, 0.55, 0]}>
        <coneGeometry args={[0.26, 0.8, 24]} />
        <meshStandardMaterial color="#f0ece8" metalness={0.1} roughness={0.7} />
      </mesh>
    </group>
  );
}

/* ====================================================================
   Full Falcon 9 stack  (convenience wrapper)
   ==================================================================== */

export function Falcon9Stack({
  stage1Throttle = 0,
  stage2Throttle = 0,
  fairingSeparated = false,
  gridFins = false,
  legs = false,
}: {
  stage1Throttle?: number;
  stage2Throttle?: number;
  fairingSeparated?: boolean;
  gridFins?: boolean;
  legs?: boolean;
}) {
  return (
    <group>
      {/* Fairing at top */}
      <group position={[0, 3.5, 0]}>
        <PayloadFairing separated={fairingSeparated} />
      </group>
      {/* Second stage */}
      <group position={[0, 2.5, 0]}>
        <Falcon9SecondStage throttle={stage2Throttle} />
      </group>
      {/* First stage */}
      <group position={[0, 0, 0]}>
        <Falcon9FirstStage
          throttle={stage1Throttle}
          gridFins={gridFins}
          legs={legs}
        />
      </group>
    </group>
  );
}
