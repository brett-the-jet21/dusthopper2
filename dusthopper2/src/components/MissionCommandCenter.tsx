"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import Earth from "@/components/Earth";

type Mission = {
  id: string;
  provider: string;
  name: string;
  status: string;
  startTime?: string | null;
  agency?: string | null;
  vehicle?: string | null;
  pad?: string | null;
  location?: string | null;
};

type Api = {
  updatedAt: string;
  missions: Mission[];
};

function minutesUntil(iso?: string | null) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 60000);
}

function formatIsoLocal(iso?: string | null) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString();
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function CameraRig({
  camPos,
  camTarget,
}: {
  camPos: React.MutableRefObject<THREE.Vector3>;
  camTarget: React.MutableRefObject<THREE.Vector3>;
}) {
  useFrame(({ camera }) => {
    camera.position.lerp(camPos.current, 0.08);
    camera.lookAt(camTarget.current);
  });
  return null;
}

function Scene({
  mission,
  launchState,
  camPos,
  camTarget,
}: {
  mission: Mission | null;
  launchState: string;
  camPos: React.MutableRefObject<THREE.Vector3>;
  camTarget: React.MutableRefObject<THREE.Vector3>;
}) {
  const rocketRef = useRef<THREE.Group>(null);

  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const a = 3.35;
    const b = 2.35;
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * a, 0.65, Math.sin(t) * b));
    }
    return pts;
  }, []);

  const rocketPos = useMemo(() => {
    const tm = minutesUntil(mission?.startTime ?? null);
    const phase = tm === null ? 0.15 : clamp(1 - tm / (24 * 60), 0, 1);
    const angle = phase * Math.PI * 2 * 0.85 + 0.6;
    return new THREE.Vector3(Math.cos(angle) * 3.35, 0.65, Math.sin(angle) * 2.35);
  }, [mission?.startTime]);

  useFrame((_, dt) => {
    if (rocketRef.current) {
      rocketRef.current.rotation.y += dt * 0.8;
      rocketRef.current.rotation.z = Math.sin(Date.now() / 700) * 0.06;
    }
  });

  const engineIntensity =
    launchState === "final" ? 3.0 : launchState === "imminent" ? 1.8 : 1.1;
  const engineColor = launchState === "final" ? "#ff0000" : "#ff6b00";

  return (
    <>
      <Stars radius={300} depth={60} count={2600} factor={7} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[7, 6, 7]} intensity={1.25} />
      <pointLight position={[-7, 2, -7]} intensity={0.7} />

      <Earth radius={1.55} />

      <Line points={orbitPoints} lineWidth={2} color="white" transparent opacity={0.35} />

      <group ref={rocketRef} position={rocketPos.toArray()}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.9, 24]} />
          <meshStandardMaterial color="white" metalness={0.55} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <coneGeometry args={[0.09, 0.22, 24]} />
          <meshStandardMaterial color="white" metalness={0.45} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.55, 0]}>
          <coneGeometry args={[0.08, 0.18, 24]} />
          <meshStandardMaterial
            color={engineColor}
            emissive={engineColor}
            emissiveIntensity={engineIntensity}
          />
        </mesh>

        <Html distanceFactor={10} position={[0.35, 0.2, 0]}>
          <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white border border-white/10 backdrop-blur">
            <div className="font-semibold">{mission?.name ?? "Mission"}</div>
            <div className="opacity-80">{mission?.status ?? "—"}</div>
          </div>
        </Html>
      </group>

      <Html distanceFactor={12} position={[0, 1.9, 0]}>
        <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white border border-white/10 backdrop-blur">
          <div className="font-semibold">Earth</div>
          <div className="opacity-80">Command View</div>
        </div>
      </Html>

      <CameraRig camPos={camPos} camTarget={camTarget} />

      <OrbitControls enablePan enableZoom enableRotate zoomSpeed={0.7} rotateSpeed={0.55} minDistance={2.2} maxDistance={22} />
    </>
  );
}

export default function MissionCommandCenter({ missionId }: { missionId: string }) {
  const [data, setData] = useState<Api | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const camPos = useRef(new THREE.Vector3(0, 2.4, 7));
  const camTarget = useRef(new THREE.Vector3(0, 0, 0));

  async function load() {
    try {
      setErr(null);
      const res = await fetch("/api/missions", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      setErr("Feed error");
    }
  }

  useEffect(() => {
    let alive = true;
    load();
    const id = setInterval(() => alive && load(), 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  const mission = useMemo(() => {
    const missions: Mission[] = (data?.missions ?? []) as any;
    return missions.find((m) => m.id === missionId) ?? null;
  }, [data, missionId]);

  const tMinus = minutesUntil(mission?.startTime ?? null);
  const launchState =
    tMinus === null
      ? "unknown"
      : tMinus <= 0
      ? "launched"
      : tMinus <= 10
      ? "final"
      : tMinus <= 60
      ? "imminent"
      : "normal";

  const tLabel =
    tMinus === null ? "—" : tMinus >= 0 ? `T–${tMinus} min` : `T+${Math.abs(tMinus)} min`;

  function presetEarth() {
    camPos.current.set(0, 2.4, 7);
    camTarget.current.set(0, 0, 0);
  }
  function presetRocket() {
    camPos.current.set(2.2, 1.4, 2.2);
    camTarget.current.set(2.0, 0.65, 2.0);
  }
  function presetOrbit() {
    camPos.current.set(0, 6.5, 0.1);
    camTarget.current.set(0, 0, 0);
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-white">
      <Canvas camera={{ position: [0, 2.4, 7], fov: 60 }}>
        <Scene mission={mission} launchState={launchState} camPos={camPos} camTarget={camTarget} />
      </Canvas>

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute top-6 left-6 right-6 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <a href="/missions" className="inline-flex w-fit rounded-lg bg-white/10 px-3 py-2 text-xs border border-white/10 hover:bg-white/15">
              ← Live Missions
            </a>

            <div className="flex gap-2 text-xs">
              <button onClick={presetEarth} className="px-3 py-1 rounded bg-white/10 border border-white/10 hover:bg-white/15">
                Earth
              </button>
              <button onClick={presetRocket} className="px-3 py-1 rounded bg-white/10 border border-white/10 hover:bg-white/15">
                Rocket
              </button>
              <button onClick={presetOrbit} className="px-3 py-1 rounded bg-white/10 border border-white/10 hover:bg-white/15">
                Orbit
              </button>
            </div>

            <div
              className={[
                "rounded-2xl border backdrop-blur px-5 py-4 max-w-xl transition-colors",
                launchState === "final"
                  ? "border-red-500 bg-red-950/70"
                  : launchState === "imminent"
                  ? "border-yellow-400 bg-yellow-950/60"
                  : "border-white/10 bg-black/55",
              ].join(" ")}
            >
              <div className="text-xs uppercase tracking-wider opacity-70">
                DustHopper2 • Mission Command
              </div>

              <div className="mt-2 text-2xl font-bold">
                {mission?.name ?? "Loading mission..."}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge label={mission?.provider?.toUpperCase() ?? "—"} />
                <Badge label={mission?.agency ?? "—"} />
                <Badge label={mission?.status ?? "—"} />
                <Badge label={tLabel} strong warn={launchState === "imminent"} danger={launchState === "final"} />
              </div>

              <div className="mt-4 grid gap-1 text-sm text-white/85">
                <Row k="NET" v={formatIsoLocal(mission?.startTime ?? null)} />
                <Row k="Vehicle" v={mission?.vehicle ?? "—"} />
                <Row k="Pad" v={mission?.pad ?? "—"} />
                <Row k="Location" v={mission?.location ?? "—"} />
              </div>

              <div className="mt-3 text-xs text-white/60">
                Updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"} • auto-refresh 30s
                {err ? ` • ${err}` : ""}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur px-4 py-3 text-xs text-white/70">
            <div className="font-semibold text-white/90">Controls</div>
            <div className="mt-2 space-y-1">
              <div>Drag: orbit camera</div>
              <div>Scroll: zoom</div>
              <div>Right-drag: pan</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({
  label,
  strong,
  danger,
  warn,
}: {
  label: string;
  strong?: boolean;
  danger?: boolean;
  warn?: boolean;
}) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-1 transition-colors",
        danger
          ? "bg-red-500 text-white border-red-400 animate-pulse"
          : warn
          ? "bg-yellow-400 text-black border-yellow-300"
          : strong
          ? "bg-white text-black border-white/10"
          : "bg-white/5 text-white border-white/10",
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <div className="text-white/55">{k}</div>
      <div className="text-right">{v}</div>
    </div>
  );
}
