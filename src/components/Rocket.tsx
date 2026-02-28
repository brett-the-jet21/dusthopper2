"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Ultra-HD Falcon 9 — detailed geometry with proper proportions,
   octaweb engine cluster, grid fins, raceway, fairing split line,
   shock-diamond exhaust, and stage separation sequence.

   All animation is ref-based (zero React re-renders).

   Timeline (30s compressed from real ~540s):
     T+0.0 – T+8.0   Full-stack ascent (9 Merlin engines)
     T+8.0            MECO — main engine cutoff
     T+8.5            Stage separation
     T+8.5 – T+20.0  S2 continues up (MVac), S1 flips & descends
     T+20.0           SECO — second engine cutoff
     T+20.0 – T+30.0  S2 coasts to orbit, S1 landing burn & touchdown
   ------------------------------------------------------------------ */

export type LaunchTelemetry = {
  met: number;
  altitude: number;
  speed: number;
  phase: string;
};

type RocketProps = {
  isLaunching: boolean;
  padPosition?: [number, number, number];
  scale?: number;
  onTelemetry?: (t: LaunchTelemetry) => void;
  positionRef?: React.MutableRefObject<THREE.Vector3>;
};

function getTelemetry(t30: number): LaunchTelemetry {
  const realT = t30 * 18;
  let altitude = 0,
    speed = 0,
    phase = "Pre-launch";

  if (t30 <= 0) {
    phase = "Pre-launch";
  } else if (t30 < 8) {
    const p = t30 / 8;
    altitude = p * p * 80;
    speed = p * 6800;
    phase = t30 < 4 ? "Max-Q" : "First Stage Burn";
    if (t30 < 1) phase = "Liftoff";
  } else if (t30 < 8.5) {
    altitude = 80;
    speed = 6800;
    phase = "MECO";
  } else if (t30 < 9) {
    altitude = 82;
    speed = 6700;
    phase = "Stage Separation";
  } else if (t30 < 20) {
    const p = (t30 - 9) / 11;
    altitude = 82 + p * 118;
    speed = 6700 + p * 21300;
    phase = "Second Stage Burn";
  } else if (t30 < 21) {
    altitude = 200;
    speed = 28000;
    phase = "SECO";
  } else {
    altitude = 200 + (t30 - 21) * 2;
    speed = 28000;
    phase = "Orbit Insertion";
  }

  return {
    met: realT,
    altitude: Math.round(altitude),
    speed: Math.round(speed),
    phase,
  };
}

/* ------------------------------------------------------------------
   First Stage geometry — LOX tank, RP-1 tank, octaweb, grid fins,
   landing legs, raceway, interstage
   ------------------------------------------------------------------ */
function FirstStageGeometry() {
  /* Materials */
  const loxMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0f0f0",
        roughness: 0.25,
        metalness: 0.75,
      }),
    [],
  );
  const rp1Mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e6e4e0",
        roughness: 0.28,
        metalness: 0.7,
      }),
    [],
  );
  const darkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        roughness: 0.35,
        metalness: 0.85,
      }),
    [],
  );
  const interstageMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2a2a2a",
        roughness: 0.5,
        metalness: 0.6,
      }),
    [],
  );
  const copperMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#aa6633",
        roughness: 0.3,
        metalness: 0.9,
      }),
    [],
  );
  const gridFinMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#222222",
        roughness: 0.4,
        metalness: 0.85,
      }),
    [],
  );
  const legMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#333333",
        roughness: 0.5,
        metalness: 0.7,
      }),
    [],
  );
  const racewayMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#999999",
        roughness: 0.4,
        metalness: 0.6,
      }),
    [],
  );

  return (
    <>
      {/* === LOX tank (upper section) === */}
      <mesh position={[0, 1.5, 0]} material={loxMat}>
        <cylinderGeometry args={[0.6, 0.6, 4.5, 48]} />
      </mesh>
      {/* LOX/RP-1 dome separator */}
      <mesh position={[0, -0.9, 0]} material={darkMat}>
        <cylinderGeometry args={[0.605, 0.605, 0.08, 48]} />
      </mesh>

      {/* === RP-1 tank (lower section — slightly warmer tone) === */}
      <mesh position={[0, -2.5, 0]} material={rp1Mat}>
        <cylinderGeometry args={[0.6, 0.6, 3.0, 48]} />
      </mesh>

      {/* === Octaweb engine section === */}
      <mesh position={[0, -4.2, 0]} material={darkMat}>
        <cylinderGeometry args={[0.58, 0.68, 0.6, 48]} />
      </mesh>
      {/* Heat shield plate */}
      <mesh position={[0, -3.88, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.04, 48]} />
        <meshStandardMaterial
          color="#3a3a3a"
          roughness={0.6}
          metalness={0.5}
        />
      </mesh>

      {/* === 9 Merlin 1D engines (octaweb + center) === */}
      {[...Array(9)].map((_, i) => {
        const isCenter = i === 8;
        const angle = isCenter ? 0 : (i / 8) * Math.PI * 2;
        const dist = isCenter ? 0 : 0.36;
        const bellSize = isCenter ? 0.13 : 0.11;
        const bellLen = isCenter ? 0.5 : 0.42;
        return (
          <group
            key={`eng${i}`}
            position={[
              Math.cos(angle) * dist,
              -4.55,
              Math.sin(angle) * dist,
            ]}
          >
            {/* Nozzle bell — copper-colored ablative */}
            <mesh material={copperMat}>
              <coneGeometry args={[bellSize, bellLen, 24]} />
            </mesh>
            {/* Nozzle throat */}
            <mesh position={[0, bellLen * 0.35, 0]} material={darkMat}>
              <cylinderGeometry args={[bellSize * 0.35, bellSize * 0.5, 0.08, 16]} />
            </mesh>
            {/* Turbopump exhaust */}
            {!isCenter && (
              <mesh
                position={[0, bellLen * 0.3, bellSize * 0.6]}
                material={darkMat}
              >
                <cylinderGeometry args={[0.015, 0.02, 0.1, 8]} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* === Grid fins (4x) — waffle pattern === */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <group
            key={`gf${i}`}
            position={[Math.cos(a) * 0.68, -3.3, Math.sin(a) * 0.68]}
            rotation={[0, -a, 0]}
          >
            {/* Main fin body */}
            <mesh material={gridFinMat}>
              <boxGeometry args={[0.55, 0.55, 0.06]} />
            </mesh>
            {/* Grid pattern — horizontal bars */}
            {[-0.18, -0.06, 0.06, 0.18].map((y, j) => (
              <mesh
                key={`gh${j}`}
                position={[0, y, 0]}
                material={gridFinMat}
              >
                <boxGeometry args={[0.5, 0.02, 0.07]} />
              </mesh>
            ))}
            {/* Grid pattern — vertical bars */}
            {[-0.18, -0.06, 0.06, 0.18].map((x, j) => (
              <mesh
                key={`gv${j}`}
                position={[x, 0, 0]}
                material={gridFinMat}
              >
                <boxGeometry args={[0.02, 0.5, 0.07]} />
              </mesh>
            ))}
            {/* Hinge actuator */}
            <mesh position={[0, 0.32, 0]} material={darkMat}>
              <cylinderGeometry args={[0.03, 0.03, 0.12, 8]} />
            </mesh>
          </group>
        );
      })}

      {/* === Landing legs (4x) — folded against body === */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={`leg${i}`}>
            {/* Main strut */}
            <mesh
              position={[
                Math.cos(a) * 0.55,
                -3.5,
                Math.sin(a) * 0.55,
              ]}
              rotation={[0.12, -a, 0]}
              material={legMat}
            >
              <boxGeometry args={[0.07, 2.2, 0.05]} />
            </mesh>
            {/* Secondary strut */}
            <mesh
              position={[
                Math.cos(a) * 0.62,
                -3.0,
                Math.sin(a) * 0.62,
              ]}
              rotation={[0.08, -a, 0]}
              material={legMat}
            >
              <boxGeometry args={[0.04, 1.2, 0.04]} />
            </mesh>
            {/* Foot pad */}
            <mesh
              position={[
                Math.cos(a) * 0.58,
                -4.6,
                Math.sin(a) * 0.58,
              ]}
              material={darkMat}
            >
              <boxGeometry args={[0.12, 0.04, 0.08]} />
            </mesh>
          </group>
        );
      })}

      {/* === Raceway (cable/pneumatic conduit) === */}
      <mesh position={[0.0, 0.0, 0.62]} material={racewayMat}>
        <boxGeometry args={[0.06, 8.0, 0.04]} />
      </mesh>
      <mesh position={[0.0, 0.0, -0.62]} material={racewayMat}>
        <boxGeometry args={[0.04, 8.0, 0.03]} />
      </mesh>

      {/* === Interstage === */}
      <mesh position={[0, 4.0, 0]} material={interstageMat}>
        <cylinderGeometry args={[0.6, 0.6, 0.6, 48]} />
      </mesh>
      {/* Interstage vent holes (ring of dark circles) */}
      {[...Array(12)].map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh
            key={`vh${i}`}
            position={[Math.cos(a) * 0.605, 4.1, Math.sin(a) * 0.605]}
            rotation={[0, -a + Math.PI / 2, 0]}
          >
            <cylinderGeometry args={[0.03, 0.03, 0.02, 8]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
        );
      })}

      {/* === SpaceX logo stripe === */}
      <mesh position={[0.0, 1.8, 0.605]}>
        <planeGeometry args={[0.7, 0.1]} />
        <meshBasicMaterial color="#005288" />
      </mesh>
      {/* Secondary livery stripe */}
      <mesh position={[0.0, 1.6, 0.604]}>
        <planeGeometry args={[0.5, 0.03]} />
        <meshBasicMaterial color="#aaaaaa" />
      </mesh>

      {/* === Cold gas thrusters (RCS) at top === */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
        <mesh
          key={`rcs${i}`}
          position={[Math.cos(a) * 0.62, 3.5, Math.sin(a) * 0.62]}
          material={darkMat}
        >
          <boxGeometry args={[0.04, 0.08, 0.04]} />
        </mesh>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------
   Second Stage + Fairing geometry — MVac engine, tanks, ogive fairing
   ------------------------------------------------------------------ */
function SecondStageGeometry() {
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0f0f0",
        roughness: 0.25,
        metalness: 0.75,
      }),
    [],
  );
  const darkMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1a1a",
        roughness: 0.35,
        metalness: 0.85,
      }),
    [],
  );
  const fairingMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f8f8f5",
        roughness: 0.2,
        metalness: 0.45,
      }),
    [],
  );
  const niobiumMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#776655",
        roughness: 0.25,
        metalness: 0.95,
        emissive: "#221100",
        emissiveIntensity: 0.1,
      }),
    [],
  );

  return (
    <>
      {/* === S2 tank body === */}
      <mesh position={[0, 5.5, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.55, 0.55, 2.2, 48]} />
      </mesh>

      {/* === MVac engine — extended nozzle with niobium coloring === */}
      <group position={[0, 4.15, 0]}>
        {/* Nozzle bell (niobium/columbium — dark bronze) */}
        <mesh material={niobiumMat}>
          <coneGeometry args={[0.38, 0.8, 32]} />
        </mesh>
        {/* Upper nozzle (regeneratively cooled) */}
        <mesh position={[0, 0.5, 0]} material={darkMat}>
          <coneGeometry args={[0.2, 0.3, 24]} />
        </mesh>
        {/* Turbopump assembly */}
        <mesh position={[0.15, 0.6, 0]} material={darkMat}>
          <boxGeometry args={[0.12, 0.15, 0.1]} />
        </mesh>
        {/* TEA-TEB igniter */}
        <mesh position={[-0.12, 0.55, 0.08]} material={darkMat}>
          <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
        </mesh>
      </group>

      {/* === Payload adapter === */}
      <mesh position={[0, 6.75, 0]} material={darkMat}>
        <cylinderGeometry args={[0.5, 0.55, 0.3, 48]} />
      </mesh>

      {/* === Fairing — proper ogive shape === */}
      {/* Lower cylindrical section */}
      <mesh position={[0, 7.3, 0]} material={fairingMat}>
        <cylinderGeometry args={[0.62, 0.62, 0.8, 48]} />
      </mesh>
      {/* Upper ogive taper — multiple sections for smooth curve */}
      <mesh position={[0, 7.9, 0]} material={fairingMat}>
        <cylinderGeometry args={[0.58, 0.62, 0.4, 48]} />
      </mesh>
      <mesh position={[0, 8.25, 0]} material={fairingMat}>
        <cylinderGeometry args={[0.5, 0.58, 0.3, 48]} />
      </mesh>
      <mesh position={[0, 8.55, 0]} material={fairingMat}>
        <cylinderGeometry args={[0.35, 0.5, 0.3, 48]} />
      </mesh>
      {/* Nosecone tip */}
      <mesh position={[0, 8.85, 0]} material={fairingMat}>
        <coneGeometry args={[0.35, 0.5, 48]} />
      </mesh>

      {/* Fairing bisector split line */}
      <mesh position={[0.0, 7.8, 0.625]}>
        <boxGeometry args={[0.01, 2.6, 0.01]} />
        <meshBasicMaterial color="#888888" />
      </mesh>
      <mesh position={[0.0, 7.8, -0.625]}>
        <boxGeometry args={[0.01, 2.6, 0.01]} />
        <meshBasicMaterial color="#888888" />
      </mesh>

      {/* Fairing access door */}
      <mesh position={[0.625, 7.5, 0]}>
        <planeGeometry args={[0.15, 0.1]} />
        <meshBasicMaterial color="#cccccc" />
      </mesh>

      {/* S2 raceway */}
      <mesh position={[0.0, 5.8, 0.56]}>
        <boxGeometry args={[0.04, 2.0, 0.03]} />
        <meshStandardMaterial
          color="#999999"
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------
   S1 Exhaust — multi-layered with shock diamonds
   ------------------------------------------------------------------ */
function S1Exhaust({
  coreRef,
  lightRef,
}: {
  coreRef: React.RefObject<THREE.Mesh | null>;
  lightRef: React.RefObject<THREE.PointLight | null>;
}) {
  return (
    <group position={[0, -5.0, 0]}>
      {/* Shock diamond core (bright white/blue) */}
      <mesh ref={coreRef}>
        <coneGeometry args={[0.45, 3.5, 24]} />
        <meshBasicMaterial
          color="#ffe8cc"
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Shock diamond pattern — bright nodes */}
      {[0.8, 1.6, 2.3].map((y, i) => (
        <mesh key={`sd${i}`} position={[0, -y, 0]}>
          <sphereGeometry args={[0.2 - i * 0.04, 12, 12]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.7 - i * 0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Inner plume (orange-white) */}
      <mesh scale={[1.3, 1.1, 1.3]}>
        <coneGeometry args={[0.5, 3.8, 24]} />
        <meshBasicMaterial
          color="#ff8833"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer plume (deep orange, turbulent) */}
      <mesh scale={[1.8, 1.4, 1.8]}>
        <coneGeometry args={[0.55, 4.5, 24]} />
        <meshBasicMaterial
          color="#ff4400"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Wide thermal bloom */}
      <mesh scale={[2.8, 1.8, 2.8]}>
        <coneGeometry args={[0.5, 5.0, 16]} />
        <meshBasicMaterial
          color="#ff2200"
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <pointLight
        ref={lightRef}
        color="#ff7733"
        intensity={0}
        distance={8}
        decay={2}
      />
    </group>
  );
}

/* ------------------------------------------------------------------
   S2 Exhaust — MVac vacuum plume (wide blue expansion)
   ------------------------------------------------------------------ */
function S2Exhaust({
  coreRef,
  lightRef,
}: {
  coreRef: React.RefObject<THREE.Mesh | null>;
  lightRef: React.RefObject<THREE.PointLight | null>;
}) {
  return (
    <group position={[0, 3.5, 0]}>
      {/* Vacuum-expanded core (bright white) */}
      <mesh ref={coreRef}>
        <coneGeometry args={[0.35, 2.8, 24]} />
        <meshBasicMaterial
          color="#eeeeff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Wide vacuum expansion (characteristic blue) */}
      <mesh scale={[1.5, 1.3, 1.5]}>
        <coneGeometry args={[0.4, 3.0, 24]} />
        <meshBasicMaterial
          color="#5588ff"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer glow */}
      <mesh scale={[2.2, 1.6, 2.2]}>
        <coneGeometry args={[0.4, 3.5, 16]} />
        <meshBasicMaterial
          color="#3355cc"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Vacuum expansion disk (perpendicular) */}
      <mesh position={[0, -1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.6, 24]} />
        <meshBasicMaterial
          color="#6699ff"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        ref={lightRef}
        color="#5588ff"
        intensity={0}
        distance={6}
        decay={2}
      />
    </group>
  );
}

/* ==================================================================
   Main Rocket component
   ================================================================== */
export default function Rocket({
  isLaunching,
  padPosition = [0, 6.08, 0],
  scale = 0.025,
  onTelemetry,
  positionRef,
}: RocketProps) {
  const s1Ref = useRef<THREE.Group>(null);
  const s2Ref = useRef<THREE.Group>(null);
  const s1ExhaustRef = useRef<THREE.Group>(null);
  const s2ExhaustRef = useRef<THREE.Group>(null);
  const s1CoreRef = useRef<THREE.Mesh>(null);
  const s2CoreRef = useRef<THREE.Mesh>(null);
  const s1LightRef = useRef<THREE.PointLight>(null);
  const s2LightRef = useRef<THREE.PointLight>(null);

  const startTimeRef = useRef(0);
  const launchedRef = useRef(false);
  const separatedRef = useRef(false);

  useFrame((state) => {
    if (!s1Ref.current || !s2Ref.current) return;

    if (!isLaunching && !launchedRef.current) {
      s1Ref.current.visible = false;
      s2Ref.current.visible = false;
      if (s1ExhaustRef.current) s1ExhaustRef.current.visible = false;
      if (s2ExhaustRef.current) s2ExhaustRef.current.visible = false;
      return;
    }

    if (isLaunching && !launchedRef.current) {
      launchedRef.current = true;
      startTimeRef.current = state.clock.elapsedTime;
      s1Ref.current.visible = true;
      s2Ref.current.visible = true;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const t = Math.min(elapsed, 30);
    const time = state.clock.elapsedTime;

    if (onTelemetry) onTelemetry(getTelemetry(t));

    const SEP_TIME = 8.5;
    const hasSeparated = t >= SEP_TIME;

    if (hasSeparated && !separatedRef.current) {
      separatedRef.current = true;
    }

    if (!hasSeparated) {
      const p = t / SEP_TIME;
      const altitude = p * p * 5;
      const tilt = p * p * 0.25;

      const pos: [number, number, number] = [
        padPosition[0] + tilt * 0.4,
        padPosition[1] + altitude,
        padPosition[2],
      ];

      s1Ref.current.position.set(...pos);
      s1Ref.current.rotation.z = -tilt;
      s2Ref.current.position.set(...pos);
      s2Ref.current.rotation.z = -tilt;

      if (positionRef) positionRef.current.set(...pos);

      const showS1 = t > 0 && t < 8;
      if (s1ExhaustRef.current) s1ExhaustRef.current.visible = showS1;
      if (s2ExhaustRef.current) s2ExhaustRef.current.visible = false;

      if (s1CoreRef.current && showS1) {
        const fx =
          0.85 +
          Math.sin(time * 23.7) * 0.1 +
          Math.sin(time * 47.3) * 0.05;
        const fy =
          1.0 +
          Math.sin(time * 31.1) * 0.2 +
          Math.sin(time * 67.9) * 0.1;
        s1CoreRef.current.scale.set(fx, fy, fx);
      }
      if (s1LightRef.current)
        s1LightRef.current.intensity = showS1
          ? 4.5 + Math.sin(time * 19.3) * 1.5
          : 0;
    } else {
      const sepElapsed = t - SEP_TIME;

      // S2
      const s2p = Math.min(sepElapsed / 21.5, 1);
      const s2BaseAlt = 5;
      const s2Altitude = s2BaseAlt + s2p * 15;
      const s2Tilt = 0.25 + s2p * 0.6;

      s2Ref.current.position.set(
        padPosition[0] + s2Tilt * 0.8,
        padPosition[1] + s2Altitude,
        padPosition[2],
      );
      s2Ref.current.rotation.z = -s2Tilt;

      if (positionRef) {
        positionRef.current.set(
          padPosition[0] + s2Tilt * 0.8,
          padPosition[1] + s2Altitude,
          padPosition[2],
        );
      }

      const showS2Exhaust = sepElapsed < 11.5;
      if (s2ExhaustRef.current) s2ExhaustRef.current.visible = showS2Exhaust;
      if (s2CoreRef.current && showS2Exhaust) {
        const fx = 0.8 + Math.sin(time * 29.1) * 0.1;
        const fy = 1.0 + Math.sin(time * 37.3) * 0.15;
        s2CoreRef.current.scale.set(fx, fy, fx);
      }
      if (s2LightRef.current)
        s2LightRef.current.intensity = showS2Exhaust
          ? 2.5 + Math.sin(time * 22.1) * 0.8
          : 0;

      // S1
      const s1p = Math.min(sepElapsed / 21.5, 1);
      const s1BaseAlt = 5;
      const flipProgress = Math.min(sepElapsed / 2, 1);
      const flipAngle = flipProgress * Math.PI;
      const s1Altitude =
        s1BaseAlt + Math.sin(s1p * Math.PI) * 2 - s1p * s1BaseAlt;
      const s1Drift = -s1p * 1.5;

      s1Ref.current.position.set(
        padPosition[0] + 0.1 + s1Drift,
        padPosition[1] + Math.max(s1Altitude, 0),
        padPosition[2],
      );
      s1Ref.current.rotation.z = -(0.25 - flipAngle * 0.08);

      const entryBurn = sepElapsed > 4.5 && sepElapsed < 7.5;
      const landingBurn = sepElapsed > 17.5 && sepElapsed < 21.5;
      const showS1Exhaust = entryBurn || landingBurn;
      if (s1ExhaustRef.current) s1ExhaustRef.current.visible = showS1Exhaust;
      if (s1CoreRef.current && showS1Exhaust) {
        const intensity = landingBurn ? 0.6 : 1.0;
        const fx = (0.85 + Math.sin(time * 23.7) * 0.1) * intensity;
        const fy = (1.0 + Math.sin(time * 31.1) * 0.2) * intensity;
        s1CoreRef.current.scale.set(fx, fy, fx);
      }
      if (s1LightRef.current)
        s1LightRef.current.intensity = showS1Exhaust
          ? 3.0 + Math.sin(time * 19.3) * 1.0
          : 0;
    }
  });

  return (
    <>
      {/* ===== FIRST STAGE ===== */}
      <group ref={s1Ref} scale={[scale, scale, scale]} visible={false}>
        <FirstStageGeometry />
        <group ref={s1ExhaustRef} visible={false}>
          <S1Exhaust coreRef={s1CoreRef} lightRef={s1LightRef} />
        </group>
      </group>

      {/* ===== SECOND STAGE + FAIRING ===== */}
      <group ref={s2Ref} scale={[scale, scale, scale]} visible={false}>
        <SecondStageGeometry />
        <group ref={s2ExhaustRef} visible={false}>
          <S2Exhaust coreRef={s2CoreRef} lightRef={s2LightRef} />
        </group>
      </group>
    </>
  );
}
