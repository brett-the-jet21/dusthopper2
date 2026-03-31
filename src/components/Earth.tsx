"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";

/* ===================================================================
   Photorealistic Earth — CDN textures, 3-layer mesh
   ● Layer 1: Blue-marble surface with specular ocean sheen
   ● Layer 2: Cloud shell, rotates independently
   ● Layer 3: Atmospheric rim glow
   =================================================================== */

const AXIAL_TILT = 23.44 * (Math.PI / 180);

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/* KSC: 28.5729°N, 80.6490°W — placed in Earth's local (pre-rotation) space */
const KSC_LAT = 28.5729 * (Math.PI / 180);
const KSC_LON = -80.649 * (Math.PI / 180);

function KSCMarker({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  // Place slightly above surface
  const r = radius * 1.005;
  const x = r * Math.cos(KSC_LAT) * Math.sin(KSC_LON);
  const y = r * Math.sin(KSC_LAT);
  const z = r * Math.cos(KSC_LAT) * Math.cos(KSC_LON);

  useFrame((state) => {
    if (!meshRef.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.35;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef} position={[x, y, z]}>
      <sphereGeometry args={[0.022, 8, 8]} />
      <meshBasicMaterial color="#FF6B00" />
    </mesh>
  );
}

function EarthInner({ radius, onClick, showKSC }: { radius: number; onClick?: () => void; showKSC?: boolean }) {
  const earthRef      = useRef<THREE.Mesh>(null);
  const cloudsRef     = useRef<THREE.Mesh>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const cloudDrift    = useRef(0);

  const [colorMap, cloudsMap, specMap] = useLoader(TextureLoader, [
    "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    "https://unpkg.com/three-globe/example/img/earth-clouds.png",
    "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg",
  ]);

  useMemo(() => {
    [colorMap, cloudsMap, specMap].forEach((t) => {
      t.anisotropy = 8;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
    });
    colorMap.colorSpace  = THREE.SRGBColorSpace;
    cloudsMap.colorSpace = THREE.SRGBColorSpace;
  }, [colorMap, cloudsMap, specMap]);

  const specularColor = useMemo(() => new THREE.Color(0x226699), []);
  const emissiveColor = useMemo(() => new THREE.Color("#1133cc"), []);

  useFrame((_, dt) => {
    cloudDrift.current += dt * 0.00018;

    const now        = new Date();
    const hoursUTC   = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const doy        = getDayOfYear(now);
    const seasonAngle = ((doy - 172) / 365.25) * Math.PI * 2;

    if (outerGroupRef.current) outerGroupRef.current.rotation.y = seasonAngle;

    const utcRotation = ((hoursUTC - 12) / 24) * Math.PI * 2 - seasonAngle;
    if (earthRef.current)  earthRef.current.rotation.y  = utcRotation;
    if (cloudsRef.current) cloudsRef.current.rotation.y = utcRotation + cloudDrift.current;
  });

  return (
    <group>
      {/* Seasonal tilt + UTC rotation */}
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          {/* Layer 1: Earth surface */}
          <mesh ref={earthRef} onClick={onClick}>
            <sphereGeometry args={[radius, 128, 128]} />
            <meshPhongMaterial
              map={colorMap}
              specularMap={specMap}
              specular={specularColor}
              shininess={25}
            />
            {showKSC && <KSCMarker radius={radius} />}
          </mesh>

          {/* Layer 2: Cloud shell */}
          <mesh ref={cloudsRef}>
            <sphereGeometry args={[radius * 1.003, 128, 128]} />
            <meshPhongMaterial
              map={cloudsMap}
              transparent
              opacity={0.38}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      </group>

      {/* Layer 3: Atmospheric rim glow */}
      <mesh>
        <sphereGeometry args={[radius * 1.075, 64, 64]} />
        <meshPhongMaterial
          color="#2255ff"
          emissive={emissiveColor}
          emissiveIntensity={0.3}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function EarthFallback({ radius }: { radius: number }) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial color="#0b3d91" roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

export default function Earth({
  radius = 2,
  onClick,
  showKSC = false,
}: {
  radius?: number;
  onClick?: () => void;
  showKSC?: boolean;
}) {
  return (
    <Suspense fallback={<EarthFallback radius={radius} />}>
      <EarthInner radius={radius} onClick={onClick} showKSC={showKSC} />
    </Suspense>
  );
}
