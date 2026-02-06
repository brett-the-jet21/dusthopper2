"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Line } from "@react-three/drei";
import * as THREE from "three";

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

function Scene({ mission }: { mission: Mission | null }) {
  const earthRef = (globalThis as any).__earthRef ?? ( (globalThis as any).__earthRef = { current: null as any } );
  const rocketRef = (globalThis as any).__rocketRef ?? ( (globalThis as any).__rocketRef = { current: null as any } );

  // Orbit line points (simple ellipse-ish in XZ plane)
  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const a = 3.2; // radius x
    const b = 2.2; // radius z
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * a, 0.6, Math.sin(t) * b));
    }
    return pts;
  }, []);

  // Rocket position along orbit based on T-minus / time
  const rocketPos = useMemo(() => {
    // if upcoming: move rocket slowly toward "launch point"
    const tm = minutesUntil(mission?.startTime ?? null);
    const phase = tm === null ? 0.15 : clamp(1 - tm / (24 * 60), 0, 1); // 0..1 over last 24h
    const angle = phase * Math.PI * 2 * 0.85 + 0.6;
    return new THREE.Vector3(Math.cos(angle) * 3.2, 0.6, Math.sin(angle) * 2.2);
  }, [mission?.startTime]);

  useFrame((_, dt) => {
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.12;
    if (rocketRef.current) {
      rocketRef.current.rotation.y += dt * 0.8;
      rocketRef.current.rotation.z = Math.sin(Date.now() / 700) * 0.06;
    }
  });

  return (
    <>
      <Stars radius={300} depth={60} count={2500} factor={7} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 6, 6]} intensity={1.2} />
      <pointLight position={[-6, 2, -6]} intensity={0.6} />

      {/* Earth */}
      <mesh ref={(r) => (earthRef.current = r)} position={[0, 0, 0]}>
        <sphereGeometry args={[1.55, 64, 64]} />
        <meshStandardMaterial color="#1e90ff" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Orbit */}
      <Line
        points={orbitPoints}
        lineWidth={2}
        color="white"
        transparent
        opacity={0.35}
      />

      {/* Rocket (primitive model) */}
      <group ref={(r) => (rocketRef.current = r)} position={rocketPos.toArray()}>
        {/* body */}
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.9, 24]} />
          <meshStandardMaterial color="white" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* nose */}
        <mesh position={[0, 0.55, 0]}>
          <coneGeometry args={[0.09, 0.22, 24]} />
          <meshStandardMaterial color="white" metalness={0.4} roughness={0.3} />
        </mesh>
        {/* engine glow */}
        <mesh position={[0, -0.55, 0]}>
          <coneGeometry args={[0.08, 0.18, 24]} />
          <meshStandardMaterial color="#ff6b00" emissive="#ff6b00" emissiveIntensity={1.2} />
        </mesh>

        {/* 3D label */}
        <Html distanceFactor={10} position={[0.35, 0.2, 0]}>
          <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white border border-white/10 backdrop-blur">
            <div className="font-semibold">{mission?.name ?? "Mission"}</div>
            <div className="opacity-80">{mission?.status ?? "—"}</div>
          </div>
        </Html>
      </group>

      {/* Earth label */}
      <Html distanceFactor={12} position={[0, 1.9, 0]}>
        <div className="rounded-lg bg-black/70 px-3 py-2 text-xs text-white border border-white/10 backdrop-blur">
          <div className="font-semibold">Earth</div>
          <div className="opacity-80">Command View</div>
        </div>
      </Html>

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        zoomSpeed={0.7}
        rotateSpeed={0.55}
        minDistance={2.2}
        maxDistance={20}
      />
    </>
  );
}

export default function MissionCommandCenter({ missionId }: { missionId: string }) {
  const [data, setData] = useState<Api | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setErr(null);
      const res = await fetch("/api/missions", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (e: any) {
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
  const tLabel =
    tMinus === null ? "—" : tMinus >= 0 ? `T–${tMinus} min` : `T+${Math.abs(tMinus)} min`;

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-white">
      {/* 3D canvas */}
      <Canvas camera={{ position: [0, 2.4, 7], fov: 60 }}>
        <Scene mission={mission} />
      </Canvas>

      {/* Command UI overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute top-6 left-6 right-6 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <a href="/missions" className="inline-flex w-fit rounded-lg bg-white/10 px-3 py-2 text-xs border border-white/10 hover:bg-white/15">
              ← Live Missions
            </a>

            <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur px-5 py-4 max-w-xl">
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
                <Badge label={tLabel} strong />
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

function Badge({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <span className={["rounded-full border border-white/10 px-3 py-1", strong ? "bg-white text-black font-semibold" : "bg-white/5"].join(" ")}>
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
