"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ===================================================================
   Artemis / SLS Block 1 — proportional 3D model

   Earth radius in scene = 6 units = 6,371 km real
   SLS real height = 98 m = 0.098 km → 0.098 * (6/6371) = 0.0000922 scene units
   Rocket is built at 1 model unit = 1 meter, then scaled by 0.0025
   to give ~0.245 scene units visible height (hugely upscaled for visibility,
   same approach as ISS which is also upscaled ~10000×).
   =================================================================== */

const EARTH_SCENE_R = 2; // Three.js scene units
const EARTH_KM = 6371;
const ORBIT_ALT_KM = 370; // km above Earth surface
const ORBIT_R = EARTH_SCENE_R + (ORBIT_ALT_KM / EARTH_KM) * EARTH_SCENE_R;
// ≈ 6.348 scene units
const INCLINATION = 28.5 * (Math.PI / 180); // Kennedy launch azimuth
const ORBIT_PERIOD_S = 91.5 * 60; // ~91.5 min real period
const ANIM_SPEED = 200; // visual speedup factor

type Props = {
  playing?: boolean;
  positionRef?: React.MutableRefObject<THREE.Vector3>;
  onClick?: () => void;
};

export default function ArtemisRocket({ playing = true, positionRef, onClick }: Props) {
  const groupRef = useRef<THREE.Group>(null);
  const angleRef = useRef(0);
  const glowRef = useRef<THREE.PointLight>(null);

  // Materials — useMemo so they aren't recreated every frame
  const whiteMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#F0F0F0", roughness: 0.3, metalness: 0.5 }),
    [],
  );
  const orangeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#FF6B00", roughness: 0.4, metalness: 0.2 }),
    [],
  );
  const silverMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#C8C8C8", roughness: 0.4, metalness: 0.7 }),
    [],
  );
  const darkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#444444", roughness: 0.5, metalness: 0.8 }),
    [],
  );

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (playing) {
      const angVel = (2 * Math.PI) / ORBIT_PERIOD_S;
      angleRef.current += delta * angVel * ANIM_SPEED;
    }

    const a = angleRef.current;

    // Inclined circular parking orbit
    const x = Math.cos(a) * ORBIT_R;
    const y = Math.sin(a) * ORBIT_R * Math.sin(INCLINATION);
    const z = Math.sin(a) * ORBIT_R * Math.cos(INCLINATION);

    groupRef.current.position.set(x, y, z);

    // Orient rocket radially outward from Earth (Y-axis pointing away)
    const outward = new THREE.Vector3(x, y, z).normalize();
    // Prograde direction (velocity vector, tangent to orbit)
    const prograde = new THREE.Vector3(
      -Math.sin(a),
      Math.cos(a) * Math.sin(INCLINATION),
      Math.cos(a) * Math.cos(INCLINATION),
    ).normalize();
    const side = new THREE.Vector3().crossVectors(outward, prograde).normalize();
    const correctedPrograde = new THREE.Vector3().crossVectors(side, outward).normalize();

    const rotMat = new THREE.Matrix4().makeBasis(side, outward, correctedPrograde.negate());
    groupRef.current.quaternion.setFromRotationMatrix(rotMat);

    if (positionRef) positionRef.current.set(x, y, z);

    // Pulsing engine glow
    if (glowRef.current) {
      glowRef.current.intensity = playing
        ? 0.25 + Math.sin(state.clock.elapsedTime * 8) * 0.08
        : 0;
    }
  });

  // SLS dimensions in meters (model space 1:1)
  const CORE_R = 4.2; // 8.4m core diameter
  const CORE_H = 65.0;
  const SRB_R = 1.85; // 3.7m SRB diameter
  const SRB_H = 54.0;
  const SRB_X = CORE_R + SRB_R + 2.0; // lateral offset — wide enough to be clearly distinct
  const ADAPT_H = 13.0; // upper stage adapter
  const ADAPT_R_BOT = CORE_R;
  const ADAPT_R_TOP = 2.75;
  const SM_H = 4.0; // Orion Service Module
  const CM_H = 3.5; // Orion Crew Module
  const LAS_H = 7.0; // Launch Abort System

  // Scale: 1 model-unit = 1 metre.  At 0.0027 the SLS core is ~0.023 scene-units
  // wide and ~0.26 tall relative to Earth radius 2 — proportionally correct.
  const SCALE = 0.0027;

  return (
    <group ref={groupRef} onClick={onClick}>
      {/* Scale wrapper — 1 unit = 1 metre */}
      <group scale={[SCALE, SCALE, SCALE]}>

        {/* ── Core Stage (LOX / LH2 tank body) ─────────────────────── */}
        <mesh position={[0, CORE_H / 2, 0]} material={whiteMat}>
          <cylinderGeometry args={[CORE_R, CORE_R, CORE_H, 20]} />
        </mesh>
        {/* Orange intertank stripe */}
        <mesh position={[0, CORE_H * 0.52, 0]} material={orangeMat}>
          <cylinderGeometry args={[CORE_R + 0.15, CORE_R + 0.15, 4.5, 20]} />
        </mesh>
        {/* Orange lower accent stripe */}
        <mesh position={[0, 9, 0]} material={orangeMat}>
          <cylinderGeometry args={[CORE_R + 0.15, CORE_R + 0.15, 3.5, 20]} />
        </mesh>

        {/* ── Upper Stage Adapter (tapered orange) ────────────────────── */}
        <mesh position={[0, CORE_H + ADAPT_H / 2, 0]} material={orangeMat}>
          <cylinderGeometry args={[ADAPT_R_TOP, ADAPT_R_BOT, ADAPT_H, 20]} />
        </mesh>

        {/* ── Orion Service Module ─────────────────────────────────────── */}
        <mesh position={[0, CORE_H + ADAPT_H + SM_H / 2, 0]} material={silverMat}>
          <cylinderGeometry args={[ADAPT_R_TOP - 0.2, ADAPT_R_TOP, SM_H, 20]} />
        </mesh>

        {/* ── Orion Crew Module (cone) ─────────────────────────────────── */}
        <mesh position={[0, CORE_H + ADAPT_H + SM_H + CM_H * 0.35, 0]} material={silverMat}>
          <coneGeometry args={[ADAPT_R_TOP - 0.2, CM_H, 20]} />
        </mesh>

        {/* ── Launch Abort System tower ────────────────────────────────── */}
        <mesh position={[0, CORE_H + ADAPT_H + SM_H + CM_H + LAS_H / 2, 0]} material={darkMat}>
          <cylinderGeometry args={[0.5, 0.9, LAS_H, 8]} />
        </mesh>
        {/* LAS tip cone */}
        <mesh
          position={[0, CORE_H + ADAPT_H + SM_H + CM_H + LAS_H + 1.8, 0]}
          material={darkMat}
        >
          <coneGeometry args={[0.5, 3.5, 8]} />
        </mesh>

        {/* ── Solid Rocket Booster — LEFT ─────────────────────────────── */}
        <group position={[-SRB_X, 0, 0]}>
          <mesh position={[0, SRB_H / 2, 0]} material={whiteMat}>
            <cylinderGeometry args={[SRB_R, SRB_R, SRB_H, 16]} />
          </mesh>
          {/* SRB nose cone */}
          <mesh position={[0, SRB_H + 3, 0]} material={whiteMat}>
            <coneGeometry args={[SRB_R, 6, 16]} />
          </mesh>
          {/* SRB orange marking */}
          <mesh position={[0, SRB_H * 0.55, 0]} material={orangeMat}>
            <cylinderGeometry args={[SRB_R + 0.1, SRB_R + 0.1, 3.5, 16]} />
          </mesh>
          {/* SRB nozzle (inverted cone, pointing down) */}
          <mesh position={[0, -3.5, 0]} rotation={[Math.PI, 0, 0]} material={darkMat}>
            <coneGeometry args={[SRB_R * 0.65, 5, 16]} />
          </mesh>
        </group>

        {/* ── Solid Rocket Booster — RIGHT ────────────────────────────── */}
        <group position={[SRB_X, 0, 0]}>
          <mesh position={[0, SRB_H / 2, 0]} material={whiteMat}>
            <cylinderGeometry args={[SRB_R, SRB_R, SRB_H, 16]} />
          </mesh>
          <mesh position={[0, SRB_H + 3, 0]} material={whiteMat}>
            <coneGeometry args={[SRB_R, 6, 16]} />
          </mesh>
          <mesh position={[0, SRB_H * 0.55, 0]} material={orangeMat}>
            <cylinderGeometry args={[SRB_R + 0.1, SRB_R + 0.1, 3.5, 16]} />
          </mesh>
          <mesh position={[0, -3.5, 0]} rotation={[Math.PI, 0, 0]} material={darkMat}>
            <coneGeometry args={[SRB_R * 0.65, 5, 16]} />
          </mesh>
        </group>

        {/* ── RS-25 Engine Bells (4 × RS-25 at core base) ─────────────── */}
        {(
          [
            [-CORE_R * 0.38, -CORE_R * 0.38],
            [CORE_R * 0.38, -CORE_R * 0.38],
            [-CORE_R * 0.38, CORE_R * 0.38],
            [CORE_R * 0.38, CORE_R * 0.38],
          ] as [number, number][]
        ).map(([ex, ez], i) => (
          <mesh
            key={i}
            position={[ex, -5.5, ez]}
            rotation={[Math.PI, 0, 0]}
            material={darkMat}
          >
            <coneGeometry args={[2.0, 5.5, 12]} />
          </mesh>
        ))}

        {/* ── Engine plume glow ────────────────────────────────────────── */}
        <pointLight
          ref={glowRef}
          position={[0, -10, 0]}
          color="#FF6B00"
          intensity={playing ? 0.25 : 0}
          distance={80}
          decay={2}
        />
      </group>
    </group>
  );
}
