"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";
import { OrbitTrail } from "./OrbitTrail";
import { CraftMarker } from "./CraftMarker";
import { OrbitRibbon } from "./OrbitRibbon";
import { TrackCamera } from "./TrackCamera";
import { useSimTime } from "./useSimTime";

import { mockTelemetry } from "@/lib/telemetry";
import { latLonAltToXYZ, EARTH_RADIUS_UNITS } from "@/lib/orbitMath";

import { EffectComposer, Bloom } from "@react-three/postprocessing";

type Mission = { id: string; colorA: string; colorB: string; show: boolean };

export function OrbitScene({ missionId }: { missionId: string }) {
  const { playing, setPlaying, speed, setSpeed, t, setT, realNow } = useSimTime();

  const [trackId, setTrackId] = useState<string>(missionId);
  const [freeCam, setFreeCam] = useState(false);

  const [missions, setMissions] = useState<Mission[]>(() => [
    { id: missionId,     colorA: "#7efcff", colorB: "#1a62ff", show: true },
    { id: "voyager-ish", colorA: "#ffd27e", colorB: "#ff5f6d", show: true },
    { id: "starlink-ish",colorA: "#a5ff7e", colorB: "#2bd9ff", show: true },
    { id: "lunar-ish",   colorA: "#d6b3ff", colorB: "#6b7bff", show: false },
    { id: "mars-ish",    colorA: "#ff9a7e", colorB: "#ff3b30", show: false },
  ]);

  // Compute positions for all missions at current sim time
  const computed = useMemo(() => {
    return missions.map((m) => {
      const tel = mockTelemetry(t, m.id);
      const posArr = latLonAltToXYZ(tel.lat, tel.lon, tel.altKm);
      return { ...m, tel, posArr, posV: new THREE.Vector3(...posArr) };
    });
  }, [missions, t]);

  const trackTarget = useMemo(() => {
    const found = computed.find((m) => m.id === trackId) ?? computed[0];
    return found?.posV ?? new THREE.Vector3(0, 0, 0);
  }, [computed, trackId]);

  // anchors for ribbons (ground stations) just for visual richness
  const anchors = useMemo(
    () => [
      latLonAltToXYZ(28.5, -80.6, 0),
      latLonAltToXYZ(0, -120, 0),
      latLonAltToXYZ(35.7, 139.7, 0),
    ],
    []
  );

  // time UI range: +/- 6 hours around initial real time
  const minT = realNow - 6 * 60 * 60 * 1000;
  const maxT = realNow + 6 * 60 * 60 * 1000;

  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        camera={{ position: [0, 0, 22], fov: 55, near: 0.01, far: 3000 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#000008"]} />

        {/* SUN + terminator feel (keep ambient low) */}
        <ambientLight intensity={0.10} />
        <directionalLight position={[18, 6, 10]} intensity={2.6} />
        <directionalLight position={[-10, -4, -14]} intensity={0.18} />

        <StarsField />
        <EarthPro />

        {/* RIBBONS + MARKERS */}
        {computed.map((m) => {
          if (!m.show) return null;

          return (
            <group key={m.id}>
              {/* ribbons from anchor stations to craft */}
              {anchors.map((a, i) => (
                <OrbitRibbon
                  key={i}
                  from={a}
                  to={m.posArr}
                  colorA={m.colorA}
                  colorB={m.colorB}
                  opacity={m.id === trackId ? 0.82 : 0.50}
                />
              ))}

              {/* trail + marker */}
              {m.id === trackId ? <OrbitTrail position={m.posArr} /> : null}
              <CraftMarker position={m.posArr} />

              {/* label only for tracked mission */}
              {m.id === trackId ? (
                <Html position={[m.posArr[0], m.posArr[1] + 0.45, m.posArr[2]]} center>
                  <div
                    style={{
                      color: "white",
                      background: "rgba(0,0,0,0.65)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      padding: "7px 11px",
                      borderRadius: 999,
                      fontSize: 12,
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      fontFamily:
                        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
                      letterSpacing: 0.2,
                    }}
                  >
                    <b style={{ fontWeight: 800 }}>{m.id}</b>
                    <span style={{ opacity: 0.85 }}> · {Math.round(m.tel.altKm)} km</span>
                  </div>
                </Html>
              ) : null}
            </group>
          );
        })}

        {/* TRACK CAMERA */}
        <TrackCamera target={trackTarget} enabled={!freeCam} />

        {/* BLOOM tuned for neon ribbons */}
        <EffectComposer>
          <Bloom intensity={1.05} mipmapBlur luminanceThreshold={0.18} luminanceSmoothing={0.92} />
        </EffectComposer>

        {/* FREE CAMERA only when toggled */}
        {freeCam ? (
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={EARTH_RADIUS_UNITS * 1.6}
            maxDistance={EARTH_RADIUS_UNITS * 24}
          />
        ) : null}
      </Canvas>

      {/* COMMAND CENTER HUD */}
      <div className="fixed left-4 top-4 z-20 flex flex-col gap-10">
        <div
          style={{
            display: "inline-flex",
            gap: 8,
            alignItems: "center",
            background: "rgba(0,0,0,0.55)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "10px 12px",
            color: "white",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <button
            onClick={() => setFreeCam((v) => !v)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {freeCam ? "Track Mode" : "Free Camera"}
          </button>

          <button
            onClick={() => setPlaying((v) => !v)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>

          <div style={{ opacity: 0.9, fontSize: 12, paddingLeft: 6 }}>
            Speed
          </div>

          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "white",
              padding: "8px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {[0.25, 0.5, 1, 2, 5, 10, 25, 50].map((s) => (
              <option key={s} value={s} style={{ color: "black" }}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        {/* Mission toggles */}
        <div
          style={{
            width: 260,
            background: "rgba(0,0,0,0.55)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "10px 12px",
            color: "white",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Missions</div>

          {missions.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={m.show}
                onChange={(e) =>
                  setMissions((prev) =>
                    prev.map((x) => (x.id === m.id ? { ...x, show: e.target.checked } : x))
                  )
                }
              />
              <button
                onClick={() => setTrackId(m.id)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  background: m.id === trackId ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "white",
                  padding: "7px 10px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                {m.id}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* TIME SCRUBBER */}
      <div
        className="fixed left-0 bottom-4 z-30 w-full pointer-events-auto"
        style={{
          padding: "14px 16px",
          background: "rgba(0,0,0,0.45), rgba(0,0,0,0.25), rgba(0,0,0,0))",
        }}
      >
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            background: "rgba(0,0,0,0.55)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 14,
            padding: "10px 12px",
            color: "white",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.9 }}>
            <div>Time Scrub</div>
            <div>{new Date(t).toLocaleTimeString()}</div>
          </div>
          <input
            type="range"
            min={minT}
            max={maxT}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
