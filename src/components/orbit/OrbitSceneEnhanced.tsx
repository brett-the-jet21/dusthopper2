"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Sphere } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  useState,
  useMemo,
  useRef,
  Suspense,
  useEffect,
  useCallback,
} from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";
import { Falcon9LaunchScene, LaunchCamera } from "../spacex/Falcon9LaunchScene";
import {
  type LaunchProfile,
  type UpcomingLaunch,
  FALCON9_LEO,
  FALLBACK_LAUNCHES,
  interpolateTrajectory,
} from "../spacex/launchProfiles";

const EARTH_RADIUS = 6.371;

/* ====================================================================
   3-D helper components
   ==================================================================== */

function Sun() {
  return (
    <group position={[80, 0, 0]}>
      <Sphere args={[1, 32, 32]}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>
      <pointLight color="#ffffff" intensity={150} distance={400} decay={1} />
      <Sphere args={[3, 32, 32]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </Sphere>
    </group>
  );
}

function DetailedISS() {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.rotation.y += 0.002;
  });
  return (
    <group ref={g} scale={0.5}>
      <mesh>
        <boxGeometry args={[3, 0.12, 0.12]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.3} emissive="#c0c0c0" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 1.2]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.7} roughness={0.4} emissive="#e8e8e8" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 1.4]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.4} emissive="#e0e0e0" emissiveIntensity={0.4} />
      </mesh>
      {[-1.7, 1.7].map((xOff) => (
        <group key={xOff} position={[xOff, 0, 0]}>
          {[0.12, 0.35].map((yOff) => (
            <mesh key={yOff} position={[0, yOff, 0]}>
              <boxGeometry args={[2, 0.02, 1]} />
              <meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      <pointLight color="#00ffcc" intensity={5} distance={12} />
    </group>
  );
}

function DetailedStarship() {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (g.current) g.current.rotation.y += 0.003;
  });
  return (
    <group ref={g} scale={0.35}>
      <mesh><cylinderGeometry args={[0.3, 0.3, 2.5, 32]} /><meshStandardMaterial color="#d0d0d0" metalness={0.95} roughness={0.15} emissive="#a0a0a0" emissiveIntensity={0.4} /></mesh>
      <mesh position={[0, 1.6, 0]}><coneGeometry args={[0.3, 0.8, 32]} /><meshStandardMaterial color="#c8c8c8" metalness={0.95} roughness={0.12} emissive="#a0a0a0" emissiveIntensity={0.4} /></mesh>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.31, 0.31, 1.2, 32]} /><meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.9} /></mesh>
      <mesh position={[0.4, 0.6, 0]} rotation={[0, 0, Math.PI / 8]}><boxGeometry args={[0.7, 0.05, 0.3]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} emissive="#666" emissiveIntensity={0.4} /></mesh>
      <mesh position={[-0.4, 0.6, 0]} rotation={[0, 0, -Math.PI / 8]}><boxGeometry args={[0.7, 0.05, 0.3]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} emissive="#666" emissiveIntensity={0.4} /></mesh>
      <pointLight color="#ffaa00" intensity={5} distance={12} />
    </group>
  );
}

function DetailedStarlink() {
  return (
    <group scale={0.3}>
      <mesh><boxGeometry args={[0.8, 0.1, 0.5]} /><meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.2} emissive="#2a2a2a" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[1.2, 0.02, 0.4]} /><meshStandardMaterial color="#1a4d7a" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.6} /></mesh>
      <pointLight color="#00ff88" intensity={5} distance={10} />
    </group>
  );
}

/* ====================================================================
   Orbital math
   ==================================================================== */

function calculateOrbitalVelocity(altitudeKm: number) {
  const G = 6.674e-11;
  const M = 5.972e24;
  const r = 6371000 + altitudeKm * 1000;
  const v = Math.sqrt((G * M) / r);
  const kms = v / 1000;
  return { kms, mph: kms * 2236.936 };
}

function calculateOrbitalPosition(
  semiMajorAxis: number,
  eccentricity: number,
  inclination: number,
  raan: number,
  argOfPerigee: number,
  meanAnomaly: number,
): THREE.Vector3 {
  const i = (inclination * Math.PI) / 180;
  const omega = (raan * Math.PI) / 180;
  const w = (argOfPerigee * Math.PI) / 180;
  const MA = (meanAnomaly * Math.PI) / 180;

  let E = MA;
  for (let iter = 0; iter < 10; iter++) E = MA + eccentricity * Math.sin(E);

  const v = 2 * Math.atan2(
    Math.sqrt(1 + eccentricity) * Math.sin(E / 2),
    Math.sqrt(1 - eccentricity) * Math.cos(E / 2),
  );

  const r = semiMajorAxis * (1 - eccentricity * Math.cos(E));
  const xO = r * Math.cos(v);
  const yO = r * Math.sin(v);

  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(omega), sO = Math.sin(omega);
  const ci = Math.cos(i), si = Math.sin(i);

  const x = (cw * cO - sw * sO * ci) * xO + (-sw * cO - cw * sO * ci) * yO;
  const y = (cw * sO + sw * cO * ci) * xO + (-sw * sO + cw * cO * ci) * yO;
  const z = sw * si * xO + cw * si * yO;

  return new THREE.Vector3(x, z, -y);
}

function generateRealisticOrbit(mission: any): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const segs = 256;
  const a = EARTH_RADIUS + mission.altitude / 100;
  const e = mission.eccentricity || 0.0001;
  for (let i = 0; i <= segs; i++) {
    pts.push(calculateOrbitalPosition(a, e, mission.inclination, mission.raan || 0, mission.argOfPerigee || 0, (i / segs) * 360));
  }
  return pts;
}

/* ====================================================================
   Orbiting spacecraft
   ==================================================================== */

function OrbitingSpacecraft({ mission, timeScale, startTime, onPositionUpdate }: any) {
  const groupRef = useRef<THREE.Group>(null);
  const simTime = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    simTime.current += delta * timeScale;
    const progress = ((simTime.current + startTime) / (mission.period * 60)) % 1;
    const ma = progress * 360;
    const a = EARTH_RADIUS + mission.altitude / 100;
    const pos = calculateOrbitalPosition(a, mission.eccentricity || 0.0001, mission.inclination, mission.raan || 0, mission.argOfPerigee || 0, ma);
    groupRef.current.position.copy(pos);
    const nextPos = calculateOrbitalPosition(a, mission.eccentricity || 0.0001, mission.inclination, mission.raan || 0, mission.argOfPerigee || 0, ma + 1);
    groupRef.current.lookAt(nextPos);
    onPositionUpdate([pos.x, pos.y, pos.z]);
  });

  const Model = mission.model === "iss" ? DetailedISS : mission.model === "starship" ? DetailedStarship : DetailedStarlink;

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}><Model /></Suspense>
    </group>
  );
}

/* ====================================================================
   Rotating Earth wrapper
   ==================================================================== */

function RotatingEarth({ timeScale, paused }: { timeScale: number; paused: boolean }) {
  const earthRef = useRef<THREE.Group>(null);
  const simExtra = useRef(0);

  useFrame((_, delta) => {
    if (!earthRef.current) return;
    const now = new Date();
    const ms = now.getUTCHours() * 3600000 + now.getUTCMinutes() * 60000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
    const dayFrac = ms / 86400000;
    const realRot = (dayFrac - 0.5) * Math.PI * 2;
    if (!paused && timeScale > 1) simExtra.current += delta * (timeScale - 1);
    earthRef.current.rotation.y = realRot + (simExtra.current / 86400) * Math.PI * 2;
  });

  return (
    <group ref={earthRef}>
      <EarthPro />
    </group>
  );
}

/* ====================================================================
   Camera
   ==================================================================== */

function SpaceCamera({ target, enabled, zoom }: any) {
  const { camera } = useThree();
  useFrame(() => {
    if (enabled && target?.length === 3) {
      const t = new THREE.Vector3(...target);
      const d = 15 / Math.max(zoom, 0.1);
      const off = t.clone().normalize().multiplyScalar(d).add(new THREE.Vector3(0, 5 / Math.max(zoom, 0.1), 0));
      camera.position.lerp(off, 0.03);
      camera.lookAt(t);
    }
  });
  return null;
}

/* ====================================================================
   Live ISS data hook
   ==================================================================== */

interface ISSData {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
  timestamp: number;
}

function useISSLive() {
  const [data, setData] = useState<ISSData | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchISS = async () => {
      try {
        const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
        if (!res.ok) return;
        const json = await res.json();
        if (mounted) setData(json);
      } catch { /* offline / rate-limited */ }
    };
    fetchISS();
    const id = setInterval(fetchISS, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return data;
}

/* ====================================================================
   UTC clock hook
   ==================================================================== */

function useUTCClock() {
  const [utc, setUtc] = useState("");
  useEffect(() => {
    const tick = () => setUtc(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return utc;
}

/* ====================================================================
   SpaceX upcoming launches hook
   ==================================================================== */

function useUpcomingLaunches() {
  const [launches, setLaunches] = useState<UpcomingLaunch[]>(FALLBACK_LAUNCHES);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("https://api.spacexdata.com/v4/launches/upcoming");
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted || !Array.isArray(data) || data.length === 0) return;
        const mapped: UpcomingLaunch[] = data.slice(0, 5).map((l: any) => ({
          id: l.id,
          name: l.name,
          date_utc: l.date_utc,
          rocket: "Falcon 9",
          launchpad: l.launchpad || "KSC LC-39A",
          details: l.details,
          profile: FALCON9_LEO,
        }));
        setLaunches(mapped);
      } catch { /* use fallback */ }
    })();
    return () => { mounted = false; };
  }, []);

  return launches;
}

/* ====================================================================
   Format T+ time
   ==================================================================== */

function formatTPlus(seconds: number): string {
  const neg = seconds < 0;
  const abs = Math.abs(Math.floor(seconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `T${neg ? "-" : "+"}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ====================================================================
   Styles (shared)
   ==================================================================== */

const glassPanel: React.CSSProperties = {
  background: "rgba(0, 8, 20, 0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(0, 200, 255, 0.25)",
  borderRadius: 10,
  color: "#0cf",
  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
};

const pill: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  border: "1px solid rgba(0, 200, 255, 0.4)",
  background: "rgba(0, 20, 40, 0.8)",
  color: "#0cf",
  transition: "all 0.2s",
  WebkitTapHighlightColor: "transparent",
};

/* ====================================================================
   Main component
   ==================================================================== */

export function OrbitSceneEnhanced({ missionId }: { missionId: string }) {
  const [freeCam, setFreeCam] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedMission, setSelectedMission] = useState(0);
  const [positions, setPositions] = useState<number[][]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(true);

  // --- Launch mode ---
  const [launchMode, setLaunchMode] = useState(false);
  const [activeLaunch, setActiveLaunch] = useState<UpcomingLaunch | null>(null);
  const [launchT, setLaunchT] = useState(-10); // T-10 countdown
  const [launchPlaying, setLaunchPlaying] = useState(false);
  const [trackBooster, setTrackBooster] = useState(false);
  const [rocketPos, setRocketPos] = useState<number[] | null>(null);
  const [boosterPos, setBoosterPos] = useState<number[] | null>(null);
  const [showLaunchPicker, setShowLaunchPicker] = useState(false);
  const launchInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const issData = useISSLive();
  const utcTime = useUTCClock();
  const upcomingLaunches = useUpcomingLaunches();

  // Launch timer
  useEffect(() => {
    if (launchPlaying && activeLaunch) {
      launchInterval.current = setInterval(() => {
        setLaunchT((prev) => prev + 0.05);
      }, 50);
    } else if (launchInterval.current) {
      clearInterval(launchInterval.current);
    }
    return () => { if (launchInterval.current) clearInterval(launchInterval.current); };
  }, [launchPlaying, activeLaunch]);

  const startLaunch = useCallback((launch: UpcomingLaunch) => {
    setActiveLaunch(launch);
    setLaunchMode(true);
    setLaunchT(-10);
    setLaunchPlaying(true);
    setTrackBooster(false);
    setFreeCam(false);
    setShowLaunchPicker(false);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const missions = useMemo(
    () => [
      { name: "ISS", color: "#00ffcc", altitude: 408, inclination: 51.6416, eccentricity: 0.0006703, raan: 247.4627, argOfPerigee: 130.536, period: 92.68, model: "iss" as const },
      { name: "STARSHIP HLS-1", color: "#ffaa00", altitude: 350, inclination: 28.5, eccentricity: 0.0001, raan: 0, argOfPerigee: 0, period: 91.5, model: "starship" as const },
      { name: "STARLINK-6548", color: "#00ff88", altitude: 550, inclination: 53.0, eccentricity: 0.0001, raan: 120, argOfPerigee: 0, period: 95.6, model: "starlink" as const },
    ],
    [],
  );

  const orbitPaths = useMemo(() => missions.map((m) => generateRealisticOrbit(m)), [missions]);

  const updatePos = useCallback(
    (i: number) => (pos: number[]) =>
      setPositions((prev) => {
        const next = [...prev];
        next[i] = pos;
        return next;
      }),
    [],
  );

  const cur = missions[selectedMission];
  const vel = calculateOrbitalVelocity(cur.altitude);
  const startTimes = [0, 1800, 3600];

  // Use live ISS data when ISS is selected
  const liveAlt = selectedMission === 0 && issData ? issData.altitude : cur.altitude;
  const liveVel = selectedMission === 0 && issData ? issData.velocity : vel.kms * 3600;
  const liveLat = selectedMission === 0 && issData ? issData.latitude : null;
  const liveLon = selectedMission === 0 && issData ? issData.longitude : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {/* ---- 3-D Canvas ---- */}
      <Canvas
        camera={{ position: [0, 12, 22], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <color attach="background" args={["#000005"]} />
        <Sun />
        <ambientLight intensity={0.15} />
        <directionalLight position={[80, 0, 0]} intensity={3} />
        <StarsField />
        <RotatingEarth timeScale={timeScale} paused={!playing} />

        {orbitPaths.map((path, i) => (
          <Line key={`p-${i}`} points={path} color={missions[i].color} lineWidth={1.5} transparent opacity={0.5} />
        ))}

        {missions.map((m, i) => (
          <OrbitingSpacecraft
            key={i}
            mission={m}
            timeScale={playing ? timeScale : 0}
            startTime={startTimes[i]}
            onPositionUpdate={updatePos(i)}
          />
        ))}

        {/* ---- Launch simulation ---- */}
        {launchMode && activeLaunch && launchT >= 0 && (
          <Falcon9LaunchScene
            launchT={launchT}
            profile={activeLaunch.profile}
            trackBooster={trackBooster}
            onRocketPosition={setRocketPos}
            onBoosterPosition={setBoosterPos}
          />
        )}

        {/* ---- Cameras ---- */}
        {launchMode ? (
          <LaunchCamera
            target={trackBooster ? boosterPos : rocketPos}
            enabled={!freeCam}
          />
        ) : (
          <SpaceCamera target={positions[selectedMission]} enabled={!freeCam} zoom={zoom} />
        )}
        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.35} luminanceSmoothing={0.9} />
        </EffectComposer>
        <OrbitControls
          enabled={freeCam}
          enableDamping
          dampingFactor={0.05}
          enablePan={!isMobile}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        />
      </Canvas>

      {/* ============================================================
          UI OVERLAY
          ============================================================ */}

      {/* ---- Top bar ---- */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: isMobile ? 48 : 56,
          ...glassPanel,
          borderRadius: 0,
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "0 12px" : "0 24px",
          zIndex: 100,
        }}
      >
        {/* Left: live badge + mission */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0, 255, 100, 0.12)",
              border: "1px solid rgba(0, 255, 100, 0.4)",
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#0f8",
                boxShadow: "0 0 8px #0f8",
                animation: "pulse 2s infinite",
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#0f8", letterSpacing: 1 }}>LIVE</span>
          </div>
          <span style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, letterSpacing: 0.5 }}>
            {launchMode && activeLaunch ? activeLaunch.name : cur.name}
          </span>
          {launchMode && (
            <span style={{ fontSize: 14, fontWeight: 700, color: launchT < 0 ? "#f44" : "#0f8", fontVariantNumeric: "tabular-nums", marginLeft: 8 }}>
              {formatTPlus(launchT)}
            </span>
          )}
        </div>

        {/* Right: UTC clock + controls */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14 }}>
          <span
            style={{
              fontSize: isMobile ? 11 : 13,
              fontWeight: 600,
              color: "rgba(0, 200, 255, 0.7)",
              letterSpacing: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {utcTime} UTC
          </span>

          {!isMobile && (
            <>
              <button onClick={() => setFreeCam((f) => !f)} style={{ ...pill, ...(freeCam ? { background: "#0cf", color: "#000" } : {}) }}>
                {freeCam ? "FREE CAM" : "TRACKING"}
              </button>
              <button
                onClick={() => setPlaying((p) => !p)}
                style={{
                  ...pill,
                  background: playing ? "rgba(0, 255, 100, 0.2)" : "rgba(255, 60, 60, 0.2)",
                  borderColor: playing ? "rgba(0, 255, 100, 0.5)" : "rgba(255, 60, 60, 0.5)",
                  color: playing ? "#0f8" : "#f44",
                }}
              >
                {playing ? "PAUSE" : "PLAY"}
              </button>
              <select
                value={timeScale}
                onChange={(e) => setTimeScale(Number(e.target.value))}
                style={{
                  ...pill,
                  appearance: "none" as const,
                  WebkitAppearance: "none" as const,
                  paddingRight: 20,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%2300ccff' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                }}
              >
                <option value={1}>1x REAL</option>
                <option value={60}>60x</option>
                <option value={360}>360x</option>
                <option value={1440}>1440x</option>
                <option value={3600}>3600x</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* ---- Telemetry panel ---- */}
      <div
        style={{
          position: "fixed",
          ...(isMobile
            ? { bottom: 56, left: 8, right: 8, maxHeight: showTelemetry ? 260 : 0 }
            : { top: 72, right: 20, width: 280 }),
          ...glassPanel,
          padding: showTelemetry ? (isMobile ? 12 : "16px 20px") : 0,
          overflow: "hidden",
          transition: "max-height 0.3s ease, padding 0.3s ease",
          zIndex: 100,
          fontSize: isMobile ? 11 : 12,
        }}
      >
        {showTelemetry && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(0, 200, 255, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: cur.color, boxShadow: `0 0 10px ${cur.color}` }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{cur.name}</span>
              </div>
              {isMobile && (
                <button onClick={() => setShowTelemetry(false)} style={{ background: "none", border: "none", color: "#0cf", fontSize: 18, cursor: "pointer", padding: 4 }}>
                  ×
                </button>
              )}
            </div>

            {/* Telemetry rows */}
            {launchMode && activeLaunch ? (
              <LaunchTelemetry launchT={launchT} profile={activeLaunch.profile} trackBooster={trackBooster} />
            ) : (
              <>
                <TelRow label="ALTITUDE" value={`${liveAlt.toFixed(1)} km`} live={selectedMission === 0 && !!issData} />
                <TelRow label="VELOCITY" value={`${(liveVel / 3600).toFixed(2)} km/s`} live={selectedMission === 0 && !!issData} />
                <TelRow label="SPEED" value={`${Math.round(liveVel * 0.621371)} mph`} />
                {liveLat !== null && <TelRow label="LATITUDE" value={`${liveLat.toFixed(4)}°`} live />}
                {liveLon !== null && <TelRow label="LONGITUDE" value={`${liveLon.toFixed(4)}°`} live />}
                <TelRow label="INCLINATION" value={`${cur.inclination.toFixed(4)}°`} />
                <TelRow label="PERIOD" value={`${cur.period.toFixed(1)} min`} />
              </>
            )}

            <div style={{ borderTop: "1px solid rgba(0, 200, 255, 0.2)", marginTop: 10, paddingTop: 10 }}>
              {launchMode ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setLaunchPlaying((p) => !p)} style={{ ...pill, fontSize: 10 }}>
                    {launchPlaying ? "PAUSE" : "PLAY"}
                  </button>
                  <button onClick={() => setTrackBooster((b) => !b)} style={{ ...pill, fontSize: 10, ...(trackBooster ? { background: "#0cf", color: "#000" } : {}) }}>
                    {trackBooster ? "BOOSTER" : "STAGE 2"}
                  </button>
                  <button onClick={() => { setLaunchMode(false); setActiveLaunch(null); setLaunchPlaying(false); }} style={{ ...pill, fontSize: 10, borderColor: "#f44", color: "#f44" }}>
                    EXIT
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ opacity: 0.6, fontSize: 10, marginBottom: 4, letterSpacing: 0.5 }}>TIME SCALE</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#00ff88" }}>{timeScale}x {timeScale === 1 && "REAL-TIME"}</div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---- Desktop: zoom buttons ---- */}
      {!isMobile && (
        <div style={{ position: "fixed", left: 20, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 6, ...glassPanel, padding: 8, zIndex: 100 }}>
          <button onClick={() => setZoom((z) => Math.min(z * 1.3, 4))} style={{ ...pill, padding: "8px 14px", fontSize: 18 }}>+</button>
          <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "2px 0", fontVariantNumeric: "tabular-nums" }}>{zoom.toFixed(1)}x</div>
          <button onClick={() => setZoom((z) => Math.max(z / 1.3, 0.4))} style={{ ...pill, padding: "8px 14px", fontSize: 18 }}>-</button>
        </div>
      )}

      {/* ---- Desktop: telemetry toggle ---- */}
      {!isMobile && (
        <button
          onClick={() => setShowTelemetry((s) => !s)}
          style={{
            position: "fixed",
            top: 72,
            right: showTelemetry ? 306 : 20,
            ...glassPanel,
            padding: "8px 6px",
            cursor: "pointer",
            fontSize: 14,
            zIndex: 100,
            transition: "right 0.3s ease",
          }}
        >
          {showTelemetry ? "▶" : "◀"}
        </button>
      )}

      {/* ---- Mission selector (bottom) ---- */}
      <div
        style={{
          position: "fixed",
          bottom: isMobile ? 0 : 20,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: isMobile ? 0 : 12,
          zIndex: 100,
          ...(isMobile
            ? { background: "rgba(0, 8, 20, 0.92)", borderTop: "1px solid rgba(0, 200, 255, 0.2)" }
            : {}),
        }}
      >
        {missions.map((m, i) => {
          const active = i === selectedMission && !launchMode;
          return (
            <button
              key={i}
              onClick={() => { setSelectedMission(i); setLaunchMode(false); setActiveLaunch(null); setLaunchPlaying(false); }}
              style={{
                background: active ? m.color : "transparent",
                color: active ? "#000" : "#fff",
                border: isMobile ? "none" : `1px solid ${m.color}`,
                borderRadius: isMobile ? 0 : 8,
                padding: isMobile ? "14px 0" : "10px 28px",
                flex: isMobile ? 1 : undefined,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: isMobile ? 10 : 12,
                letterSpacing: 1,
                textTransform: "uppercase" as const,
                fontFamily: "inherit",
                transition: "all 0.2s",
                borderBottom: isMobile && active ? `3px solid ${m.color}` : isMobile ? "3px solid transparent" : undefined,
                boxShadow: !isMobile && active ? `0 0 20px ${m.color}60` : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {isMobile ? m.name.split(" ")[0] : m.name}
            </button>
          );
        })}
        {/* SpaceX Launches button */}
        <button
          onClick={() => setShowLaunchPicker(true)}
          style={{
            background: launchMode ? "#ff4444" : "transparent",
            color: launchMode ? "#000" : "#fff",
            border: isMobile ? "none" : "1px solid #ff4444",
            borderRadius: isMobile ? 0 : 8,
            padding: isMobile ? "14px 0" : "10px 28px",
            flex: isMobile ? 1 : undefined,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: isMobile ? 10 : 12,
            letterSpacing: 1,
            textTransform: "uppercase" as const,
            fontFamily: "inherit",
            transition: "all 0.2s",
            borderBottom: isMobile && launchMode ? "3px solid #ff4444" : isMobile ? "3px solid transparent" : undefined,
            boxShadow: !isMobile && launchMode ? "0 0 20px rgba(255,68,68,0.4)" : "none",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {isMobile ? "LAUNCH" : "SPACEX LAUNCHES"}
        </button>
      </div>

      {/* ---- Mobile: bottom controls row (above mission tabs) ---- */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            bottom: 44,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 10px",
            background: "rgba(0, 8, 20, 0.9)",
            borderTop: "1px solid rgba(0, 200, 255, 0.15)",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setFreeCam((f) => !f)}
              style={{ ...pill, fontSize: 10, padding: "5px 10px", ...(freeCam ? { background: "#0cf", color: "#000" } : {}) }}
            >
              {freeCam ? "FREE" : "TRACK"}
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              style={{
                ...pill,
                fontSize: 10,
                padding: "5px 10px",
                borderColor: playing ? "rgba(0, 255, 100, 0.5)" : "rgba(255, 60, 60, 0.5)",
                color: playing ? "#0f8" : "#f44",
              }}
            >
              {playing ? "PAUSE" : "PLAY"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setShowTelemetry((s) => !s)} style={{ ...pill, fontSize: 10, padding: "5px 10px" }}>
              DATA
            </button>
            <select
              value={timeScale}
              onChange={(e) => setTimeScale(Number(e.target.value))}
              style={{ ...pill, fontSize: 10, padding: "5px 8px" }}
            >
              <option value={1}>1x</option>
              <option value={60}>60x</option>
              <option value={360}>360x</option>
              <option value={1440}>1440x</option>
            </select>
          </div>
        </div>
      )}

      {/* ---- SpaceX Launch Picker ---- */}
      {showLaunchPicker && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            ...glassPanel,
            padding: 20,
            width: isMobile ? "90%" : 400,
            maxHeight: "70vh",
            overflow: "auto",
            zIndex: 200,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>SPACEX LAUNCHES</span>
            <button onClick={() => setShowLaunchPicker(false)} style={{ background: "none", border: "none", color: "#0cf", fontSize: 20, cursor: "pointer" }}>×</button>
          </div>
          {upcomingLaunches.map((launch) => {
            const date = new Date(launch.date_utc);
            const isNow = Math.abs(date.getTime() - Date.now()) < 3600000;
            return (
              <button
                key={launch.id}
                onClick={() => startLaunch(launch)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  ...glassPanel,
                  padding: 14,
                  marginBottom: 8,
                  cursor: "pointer",
                  border: isNow ? "1px solid #f44" : "1px solid rgba(0, 200, 255, 0.2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{launch.name}</span>
                  {isNow && <span style={{ fontSize: 9, fontWeight: 700, color: "#f44", background: "rgba(255,68,68,0.15)", padding: "2px 6px", borderRadius: 4 }}>NOW</span>}
                </div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>
                  {launch.rocket} · {launch.launchpad}
                </div>
                <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
                  {date.toLocaleDateString()} {date.toLocaleTimeString()} UTC
                </div>
                {launch.details && (
                  <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, lineHeight: 1.4 }}>
                    {launch.details.slice(0, 100)}{launch.details.length > 100 ? "…" : ""}
                  </div>
                )}
              </button>
            );
          })}
          <div style={{ fontSize: 10, opacity: 0.4, marginTop: 10, textAlign: "center" }}>
            Data from SpaceX API · Trajectories are simulated
          </div>
        </div>
      )}

      {/* ---- SpaceX Launch Picker backdrop ---- */}
      {showLaunchPicker && (
        <div onClick={() => setShowLaunchPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199 }} />
      )}

      {/* ---- Launch events timeline overlay ---- */}
      {launchMode && activeLaunch && (
        <LaunchEventsBar events={activeLaunch.profile.events} launchT={launchT} isMobile={isMobile} />
      )}

      {/* ---- Pulse animation ---- */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

/* ====================================================================
   Telemetry row helper
   ==================================================================== */

function TelRow({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
      <span style={{ opacity: 0.6, fontSize: 10, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#0ff", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
        {value}
        {live && <span style={{ color: "#0f8", fontSize: 8, marginLeft: 4, verticalAlign: "super" }}>LIVE</span>}
      </span>
    </div>
  );
}

/* ====================================================================
   Launch telemetry panel content
   ==================================================================== */

function LaunchTelemetry({
  launchT,
  profile,
  trackBooster,
}: {
  launchT: number;
  profile: LaunchProfile;
  trackBooster: boolean;
}) {
  const source = trackBooster ? profile.boosterReturn : profile.trajectory;
  const traj = interpolateTrajectory(source, launchT);
  if (!traj) return <div style={{ opacity: 0.5, padding: 8 }}>Awaiting launch…</div>;

  return (
    <>
      <TelRow label="T+" value={formatTPlus(launchT)} />
      <TelRow label="ALTITUDE" value={`${traj.alt.toFixed(1)} km`} />
      <TelRow label="VELOCITY" value={`${traj.vel.toFixed(0)} m/s`} />
      <TelRow label="SPEED" value={`${Math.round(traj.vel * 2.237)} mph`} />
      <TelRow label="DOWNRANGE" value={`${traj.downrange.toFixed(1)} km`} />
      <TelRow label="THROTTLE" value={`${Math.round(traj.throttle * 100)}%`} />
    </>
  );
}

/* ====================================================================
   Launch events horizontal timeline bar
   ==================================================================== */

function LaunchEventsBar({
  events,
  launchT,
  isMobile,
}: {
  events: { t: number; label: string; type: string }[];
  launchT: number;
  isMobile: boolean;
}) {
  const maxT = events[events.length - 1]?.t || 600;

  return (
    <div
      style={{
        position: "fixed",
        left: isMobile ? 8 : 60,
        right: isMobile ? 8 : 320,
        bottom: isMobile ? 100 : 70,
        height: 32,
        background: "rgba(0, 8, 20, 0.8)",
        borderRadius: 6,
        border: "1px solid rgba(0, 200, 255, 0.15)",
        zIndex: 100,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        padding: "0 4px",
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.min(100, (launchT / maxT) * 100)}%`,
          background: "rgba(255, 68, 68, 0.15)",
          borderRight: "2px solid #f44",
          transition: "width 0.1s linear",
        }}
      />
      {/* Event markers */}
      {events.map((evt, i) => {
        const pct = (evt.t / maxT) * 100;
        const passed = launchT >= evt.t;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${pct}%`,
              top: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: passed ? "#0f8" : "rgba(0, 200, 255, 0.4)",
                boxShadow: passed ? "0 0 6px #0f8" : "none",
                marginLeft: -3,
              }}
            />
            {!isMobile && (
              <span
                style={{
                  position: "absolute",
                  top: -16,
                  left: -20,
                  fontSize: 8,
                  fontWeight: 600,
                  color: passed ? "#0f8" : "rgba(0, 200, 255, 0.5)",
                  whiteSpace: "nowrap",
                  fontFamily: "monospace",
                  letterSpacing: 0.5,
                }}
              >
                {evt.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
