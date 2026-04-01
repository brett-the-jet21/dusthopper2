"use client";

import { useRef, useMemo, Suspense, Component } from "react";
import type { ReactNode } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";

const AXIAL_TILT = 23.44 * (Math.PI / 180);

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/* KSC: 28.5729°N, 80.6490°W */
const KSC_LAT = 28.5729 * (Math.PI / 180);
const KSC_LON = -80.649 * (Math.PI / 180);

function KSCMarker({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const r = radius * 1.008;
  const baseX = r * Math.cos(KSC_LAT) * Math.sin(KSC_LON);
  const baseY = r * Math.sin(KSC_LAT);
  const baseZ = r * Math.cos(KSC_LAT) * Math.cos(KSC_LON);

  useFrame((state) => {
    if (!meshRef.current) return;
    const now = new Date();
    const h = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const doy = getDayOfYear(now);
    const seasonAngle = ((doy - 172) / 365.25) * Math.PI * 2;
    const u = ((h - 12) / 24) * Math.PI * 2 - seasonAngle;
    meshRef.current.position.set(
      baseX * Math.cos(u) + baseZ * Math.sin(u),
      baseY,
      -baseX * Math.sin(u) + baseZ * Math.cos(u),
    );
    meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.35);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.025, 8, 8]} />
      <meshBasicMaterial color="#FF8800" />
    </mesh>
  );
}

/* ── Rotation helper — applied inside every earth variant ─────── */
function useEarthRotation(
  earthRef: React.RefObject<THREE.Mesh | null>,
  cloudsRef: React.RefObject<THREE.Mesh | null>,
  outerGroupRef: React.RefObject<THREE.Group | null>,
) {
  const cloudDrift = useRef(0);
  useFrame((_, dt) => {
    cloudDrift.current += dt * 0.00018;
    const now = new Date();
    const h = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const doy = getDayOfYear(now);
    const seasonAngle = ((doy - 172) / 365.25) * Math.PI * 2;
    if (outerGroupRef.current) outerGroupRef.current.rotation.y = seasonAngle;
    const utcRot = ((h - 12) / 24) * Math.PI * 2 - seasonAngle;
    if (earthRef.current)  earthRef.current.rotation.y  = utcRot;
    if (cloudsRef.current) cloudsRef.current.rotation.y = utcRot + cloudDrift.current;
  });
}

/* ── Textured Earth (loads one CDN texture, responds to scene lights) */
function EarthTextured({ radius, onClick, showKSC }: {
  radius: number; onClick?: () => void; showKSC?: boolean;
}) {
  const earthRef      = useRef<THREE.Mesh>(null);
  const cloudsRef     = useRef<THREE.Mesh>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const emissive      = useMemo(() => new THREE.Color("#061a2e"), []);
  const specular      = useMemo(() => new THREE.Color("#3388bb"), []);

  // Versioned URL — stable forever, jsdelivr has 100% uptime SLA
  const colorMap = useLoader(
    TextureLoader,
    "https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg",
  );

  useMemo(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = 8;
  }, [colorMap]);

  useEarthRotation(earthRef, cloudsRef, outerGroupRef);

  return (
    <group>
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          <mesh ref={earthRef} onClick={onClick}>
            <sphereGeometry args={[radius, 128, 64]} />
            <meshPhongMaterial
              map={colorMap}
              emissive={emissive}
              emissiveIntensity={0.8}
              shininess={20}
              specular={specular}
            />
          </mesh>

          {showKSC && <KSCMarker radius={radius} />}

          {/* Cloud shell — plain white, blended with scene lighting */}
          <mesh ref={cloudsRef}>
            <sphereGeometry args={[radius * 1.003, 64, 32]} />
            <meshPhongMaterial
              color="#ffffff"
              emissive="#111111"
              transparent
              opacity={0.28}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[radius * 1.08, 64, 32]} />
        <meshBasicMaterial
          color="#2255ff"
          transparent
          opacity={0.10}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ── Solid fallback — always works, looks great with strong lighting */
function EarthSolid({ radius, onClick, showKSC }: {
  radius: number; onClick?: () => void; showKSC?: boolean;
}) {
  const earthRef      = useRef<THREE.Mesh>(null);
  const cloudsRef     = useRef<THREE.Mesh>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const emissive      = useMemo(() => new THREE.Color("#061520"), []);
  const specular      = useMemo(() => new THREE.Color("#4499cc"), []);

  useEarthRotation(earthRef, cloudsRef, outerGroupRef);

  return (
    <group>
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          <mesh ref={earthRef} onClick={onClick}>
            <sphereGeometry args={[radius, 64, 64]} />
            <meshPhongMaterial
              color="#1a6b9a"
              emissive={emissive}
              emissiveIntensity={0.9}
              shininess={40}
              specular={specular}
            />
          </mesh>
          {showKSC && <KSCMarker radius={radius} />}
        </group>
      </group>

      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[radius * 1.08, 64, 32]} />
        <meshBasicMaterial
          color="#2255ff"
          transparent
          opacity={0.10}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* ── Error boundary — texture failure → solid fallback ─────────── */
class EarthErrorBoundary extends Component<
  { children: ReactNode; radius: number; onClick?: () => void; showKSC?: boolean },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; radius: number; onClick?: () => void; showKSC?: boolean }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn("[Earth] texture failed, using fallback:", e.message); }
  render() {
    if (this.state.hasError) {
      return <EarthSolid radius={this.props.radius} onClick={this.props.onClick} showKSC={this.props.showKSC} />;
    }
    return this.props.children;
  }
}

/* ── Public export ──────────────────────────────────────────────── */
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
    <EarthErrorBoundary radius={radius} onClick={onClick} showKSC={showKSC}>
      <Suspense fallback={<EarthSolid radius={radius} onClick={onClick} showKSC={showKSC} />}>
        <EarthTextured radius={radius} onClick={onClick} showKSC={showKSC} />
      </Suspense>
    </EarthErrorBoundary>
  );
}
