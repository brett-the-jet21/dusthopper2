"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
} from "satellite.js";

/* ------------------------------------------------------------------
   ISS — International Space Station with real orbital position.
   Uses satellite.js with TLE to compute ECI position, then converts
   to scene coordinates (Earth radius = 6 scene units).

   The ISS model: central module + 4 solar panel arrays.
   ------------------------------------------------------------------ */

const EARTH_RADIUS_KM = 6371;
const SCENE_SCALE = 6 / EARTH_RADIUS_KM; // 1 km = this many scene units

// ISS TLE — hardcoded for demo; refreshable from CelesTrak in production
const TLE_LINE1 =
  "1 25544U 98067A   25055.54896991  .00024200  00000+0  42900-3 0  9993";
const TLE_LINE2 =
  "2 25544  51.6420 294.2170 0003568 351.0060  64.9350 15.50037360438908";

const satrec = twoline2satrec(TLE_LINE1, TLE_LINE2);

/** Convert ECI km → scene-space Vector3 (Y-up) */
function eciToScene(
  positionEci: { x: number; y: number; z: number },
  gmst: number,
): THREE.Vector3 {
  // ECI → ECEF rotation by GMST
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);
  const xEcef = positionEci.x * cosG + positionEci.y * sinG;
  const yEcef = -positionEci.x * sinG + positionEci.y * cosG;
  const zEcef = positionEci.z;

  // ECEF → Three.js (X = ECEF X, Y = ECEF Z (north), Z = -ECEF Y)
  return new THREE.Vector3(
    xEcef * SCENE_SCALE,
    zEcef * SCENE_SCALE,
    -yEcef * SCENE_SCALE,
  );
}

type ISSProps = {
  onClick?: () => void;
  positionRef?: React.MutableRefObject<THREE.Vector3>;
};

export default function ISS({ onClick, positionRef }: ISSProps) {
  const groupRef = useRef<THREE.Group>(null);

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#dddddd",
        roughness: 0.4,
        metalness: 0.8,
      }),
    [],
  );
  const panelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a2a66",
        roughness: 0.3,
        metalness: 0.6,
        emissive: "#0a1133",
        emissiveIntensity: 0.2,
      }),
    [],
  );
  const goldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ccaa44",
        roughness: 0.3,
        metalness: 0.9,
      }),
    [],
  );

  useFrame(() => {
    if (!groupRef.current) return;

    const now = new Date();
    const result = propagate(satrec, now);
    if (!result || !result.position) return;
    const posEci = result.position;
    if (typeof posEci === "boolean") return;

    const gmst = gstime(now);
    const pos = eciToScene(posEci, gmst);

    groupRef.current.position.copy(pos);

    // Orient ISS to face direction of travel (velocity vector)
    const velEci = result.velocity;
    if (velEci && typeof velEci !== "boolean") {
      const vel = eciToScene(velEci, gmst).normalize();
      const up = pos.clone().normalize();
      const right = new THREE.Vector3().crossVectors(vel, up).normalize();
      const correctedUp = new THREE.Vector3()
        .crossVectors(right, vel)
        .normalize();
      const m = new THREE.Matrix4().makeBasis(right, correctedUp, vel);
      groupRef.current.quaternion.setFromRotationMatrix(m);
    }

    if (positionRef) positionRef.current.copy(pos);
  });

  // ISS is tiny in scene scale (109m wingspan → ~0.001 scene units)
  // We render it oversized so it's visible, with a scale of ~0.06
  const s = 0.06;

  return (
    <group ref={groupRef} scale={[s, s, s]} onClick={onClick}>
      {/* Central truss */}
      <mesh material={bodyMat}>
        <boxGeometry args={[16, 0.4, 0.4]} />
      </mesh>

      {/* Modules (pressurized) */}
      <mesh position={[0, 0, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.3, 0.3, 3, 12]} />
      </mesh>
      <mesh
        position={[0, 0, 1.2]}
        rotation={[Math.PI / 2, 0, 0]}
        material={bodyMat}
      >
        <cylinderGeometry args={[0.25, 0.25, 2, 12]} />
      </mesh>
      <mesh
        position={[1, 0, 0.4]}
        rotation={[Math.PI / 2, 0, Math.PI / 2]}
        material={bodyMat}
      >
        <cylinderGeometry args={[0.2, 0.2, 1.5, 12]} />
      </mesh>

      {/* Solar arrays — 4 pairs */}
      {[-6, -3, 3, 6].map((x, i) => (
        <group key={`panel-${i}`} position={[x, 0, 0]}>
          {/* Top panel */}
          <mesh position={[0, 2.5, 0]} material={panelMat}>
            <boxGeometry args={[1.8, 4.5, 0.05]} />
          </mesh>
          {/* Bottom panel */}
          <mesh position={[0, -2.5, 0]} material={panelMat}>
            <boxGeometry args={[1.8, 4.5, 0.05]} />
          </mesh>
          {/* Mast */}
          <mesh material={goldMat}>
            <boxGeometry args={[0.05, 0.5, 0.05]} />
          </mesh>
        </group>
      ))}

      {/* Radiators */}
      <mesh position={[-1.5, 0, 0.8]} material={bodyMat}>
        <boxGeometry args={[2.5, 0.05, 1.2]} />
      </mesh>
      <mesh position={[1.5, 0, 0.8]} material={bodyMat}>
        <boxGeometry args={[2.5, 0.05, 1.2]} />
      </mesh>

      {/* Glow point (visible from distance) */}
      <pointLight color="#88aaff" intensity={0.5} distance={3} decay={2} />
    </group>
  );
}

/** Get ISS geodetic info for display (lat, lon, alt) */
export function getISSInfo(): {
  lat: number;
  lon: number;
  alt: number;
  speed: number;
} | null {
  const now = new Date();
  const result = propagate(satrec, now);
  if (!result || !result.position || typeof result.position === "boolean")
    return null;

  const posEci = result.position;
  const gmst = gstime(now);
  const geo = eciToGeodetic(posEci, gmst);
  const latDeg = (geo.latitude * 180) / Math.PI;
  const lonDeg = (geo.longitude * 180) / Math.PI;
  const altKm = geo.height;

  // Speed from velocity magnitude
  let speed = 0;
  const velEci = result.velocity;
  if (velEci && typeof velEci !== "boolean") {
    speed = Math.sqrt(velEci.x * velEci.x + velEci.y * velEci.y + velEci.z * velEci.z);
  }

  return {
    lat: Math.round(latDeg * 100) / 100,
    lon: Math.round(lonDeg * 100) / 100,
    alt: Math.round(altKm),
    speed: Math.round(speed * 3600) / 1000, // km/s → km/h / 1000 for display
  };
}
