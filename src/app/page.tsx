"use client";

import { useState, useEffect } from "react";
import { useMissionStore } from "@/lib/store/missionStore";
import dynamic from "next/dynamic";
import type { TrackTarget } from "@/components/MissionControlScene";
import { MissionSelector } from "@/components/hud/MissionSelector";
import { TelemetryPanel } from "@/components/hud/TelemetryPanel";
import { CommandCenterHUD } from "@/components/hud/CommandCenterHUD";

const MissionControlScene = dynamic(
  () => import("@/components/MissionControlScene"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="text-white/40 text-sm animate-pulse tracking-widest uppercase text-xs">
          Initialising orbital scene…
        </div>
      </div>
    ),
  },
);

/* ==================================================================
   DustHopper Mission Control
   ================================================================== */

export default function Home() {
  const [trackTarget, setTrackTarget] = useState<TrackTarget>("overview");
  const { setLaunchActive, launchSequenceActive } = useMissionStore();

  // Auto-trigger 3D launch sequence exactly at T-0
  useEffect(() => {
    if (launchSequenceActive) return;
    const check = () => { if (Date.now() >= ARTEMIS_II_LAUNCH) setLaunchActive(true); };
    check();
    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, [launchSequenceActive, setLaunchActive]);

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">

      {/* ── 3D Scene ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <MissionControlScene
          trackTarget={trackTarget}
          onTargetChange={setTrackTarget}
        />
      </div>

      {/* ── Top vignette ───────────────────────────────────────────── */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />
      {/* ── Bottom vignette ─────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />

      {/* ── Header (top-left) ──────────────────────────────────────── */}
      <header className="relative z-20 p-4 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-400 animate-pulse" />
          <h1 className="text-sm sm:text-xl font-bold tracking-widest uppercase text-white/90">
            Mission Control
          </h1>
          <LiveBadge />
        </div>
        <TminusCountdown />
      </header>

      {/* ── Command Center HUD (top-center) ────────────────────────── */}
      <CommandCenterHUD />

      {/* ── Telemetry Panel (top-right) ──────────────────────────── */}
      <TelemetryPanel />

      {/* ── Object target nav (below header, right side) ─────────── */}
      <TargetSelector current={trackTarget} onChange={setTrackTarget} />

      {/* ── Launch control (artemis only) ───────────────────────────── */}
      <LaunchButton />

      {/* ── Mission selector (bottom-center) ─────────────────────── */}
      <MissionSelector />
    </div>
  );
}

/* ------------------------------------------------------------------
   Artemis II Launch Control Button
   ------------------------------------------------------------------ */
function LaunchButton() {
  const { activeMissionId, launchSequenceActive, setLaunchActive } = useMissionStore();
  const [confirming, setConfirming] = useState(false);

  if (activeMissionId !== "artemis") return null;

  if (launchSequenceActive) {
    return (
      <div
        className="fixed bottom-28 left-1/2 z-40"
        style={{ transform: "translateX(-50%)" }}
      >
        <button
          onClick={() => { setLaunchActive(false); setConfirming(false); }}
          style={{
            background: "rgba(0,0,0,0.7)",
            border: "1px solid rgba(255,68,68,0.4)",
            color: "rgba(255,100,100,0.7)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: 2,
            padding: "6px 16px",
            cursor: "pointer",
          }}
        >
          RESET LAUNCH
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-28 left-1/2 z-40"
      style={{ transform: "translateX(-50%)" }}
    >
      {confirming ? (
        <div className="flex items-center gap-2">
          <span style={{ color: "#ff4444", fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>
            CONFIRM?
          </span>
          <button
            onClick={() => { setLaunchActive(true); setConfirming(false); }}
            style={{
              background: "linear-gradient(135deg, #cc0000, #880000)",
              border: "2px solid #ff4444",
              color: "#fff",
              fontFamily: "monospace",
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 2,
              padding: "8px 18px",
              boxShadow: "0 0 20px #ff000066",
              cursor: "pointer",
            }}
          >
            LAUNCH
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.5)",
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: 1,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            ABORT
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          style={{
            background: "linear-gradient(135deg, #cc0000, #880000)",
            border: "2px solid #ff4444",
            color: "#fff",
            fontFamily: "monospace",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 2,
            padding: "10px 22px",
            boxShadow: "0 0 20px #ff000066",
            cursor: "pointer",
          }}
        >
          🔴 INITIATE LAUNCH SEQUENCE
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Artemis II countdown — hero display
   ------------------------------------------------------------------ */
const ARTEMIS_II_LAUNCH = new Date("2026-04-01T22:24:00Z").getTime();

function getCountdownState() {
  const now  = Date.now();
  const diff = ARTEMIS_II_LAUNCH - now;
  const launched = diff <= 0;
  const abs = Math.abs(diff);
  return {
    launched,
    d: Math.floor(abs / 86400000),
    h: Math.floor((abs % 86400000) / 3600000),
    m: Math.floor((abs % 3600000) / 60000),
    s: Math.floor((abs % 60000) / 1000),
  };
}

function TminusCountdown() {
  const [cs, setCs] = useState(getCountdownState);
  useEffect(() => {
    const id = setInterval(() => setCs(getCountdownState()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad  = (n: number) => String(n).padStart(2, "0");
  const urgent = !cs.launched && cs.d === 0;                 // < 1 day remaining
  const finalMin = !cs.launched && cs.d === 0 && cs.h === 0; // < 1 hour remaining
  const mainColor = cs.launched ? "#ff8800" : (urgent ? "#ff4400" : "#00ff88");
  const secColor  = finalMin ? "#ff4400" : (cs.launched ? "#ff8800" : "#ffffff");
  const glow = `0 0 18px ${mainColor}99, 0 0 36px ${mainColor}44`;

  return (
    <div className="mt-1 ml-5 sm:ml-6 flex items-center gap-1">
      {/* T− / T+ label */}
      <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 1 }}>
        {cs.launched ? "T+" : "T−"}
      </span>

      {/* Digit blocks */}
      <div style={{ display: "flex", alignItems: "center", gap: 1, fontFamily: "monospace", fontWeight: 900 }}>
        {cs.d > 0 && (
          <>
            <span style={{ fontSize: 15, color: mainColor, textShadow: glow }}>{pad(cs.d)}</span>
            <span style={{ fontSize: 9, color: mainColor, opacity: 0.55, marginRight: 2 }}>D</span>
          </>
        )}
        <span style={{ fontSize: cs.d === 0 ? 20 : 15, color: mainColor, textShadow: glow }}>{pad(cs.h)}</span>
        <span style={{ fontSize: 9, color: mainColor, opacity: 0.5 }}>H</span>
        <span style={{ fontSize: cs.d === 0 ? 20 : 15, color: mainColor, textShadow: glow, marginLeft: 1 }}>{pad(cs.m)}</span>
        <span style={{ fontSize: 9, color: mainColor, opacity: 0.5 }}>M</span>
        {/* Seconds — white and larger when < 1 hour */}
        <span style={{
          fontSize: finalMin ? 24 : (cs.d === 0 ? 20 : 15),
          color: secColor,
          textShadow: finalMin ? `0 0 14px ${secColor}cc` : `0 0 10px ${secColor}88`,
          minWidth: "2ch",
          display: "inline-block",
          marginLeft: 1,
          transition: "font-size 0.15s ease",
        }}>{pad(cs.s)}</span>
        <span style={{ fontSize: 9, color: mainColor, opacity: 0.5 }}>S</span>
      </div>

      {/* Mission label */}
      <span style={{
        fontFamily: "monospace",
        fontSize: 9,
        letterSpacing: 1,
        color: cs.launched ? "#ff8800" : "rgba(255,255,255,0.28)",
        marginLeft: 4,
        textTransform: "uppercase",
      }}>
        {cs.launched ? "ARTEMIS II — IN FLIGHT 🚀" : "ARTEMIS II"}
      </span>
    </div>
  );
}

/* Live badge — pulsing red in header */
function LiveBadge() {
  return (
    <span
      className="animate-pulse"
      style={{
        background: "#cc2200",
        color: "#fff",
        padding: "2px 6px",
        borderRadius: 3,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1,
        boxShadow: "0 0 8px #ff440099",
        marginLeft: 2,
        fontFamily: "monospace",
      }}
    >
      LIVE
    </span>
  );
}

/* ------------------------------------------------------------------
   Target selector — camera object quick-nav pills
   ------------------------------------------------------------------ */
const NAV_TARGETS: { id: TrackTarget; label: string; icon: string; key: string }[] = [
  { id: "overview", label: "Overview", icon: "🌌", key: "1" },
  { id: "earth",    label: "Earth",    icon: "🌍", key: "2" },
  { id: "moon",     label: "Moon",     icon: "🌙", key: "3" },
  { id: "sun",      label: "Sun",      icon: "☀️", key: "4" },
  { id: "iss",      label: "ISS",      icon: "🛰️", key: "5" },
];

function TargetSelector({
  current,
  onChange,
}: {
  current: TrackTarget;
  onChange: (t: TrackTarget) => void;
}) {
  return (
    <div className="absolute top-14 sm:top-16 right-3 sm:right-6 z-30 flex gap-1 sm:gap-1.5">
      {NAV_TARGETS.map((t) => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(active && t.id !== "overview" ? "overview" : t.id)}
            title={`${t.label} (${t.key})`}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-200 backdrop-blur-xl border min-h-[34px]"
            style={{
              background: active ? 'rgba(0,204,255,0.15)' : 'rgba(0,0,0,0.45)',
              borderColor: active ? 'rgba(0,204,255,0.4)' : 'rgba(255,255,255,0.08)',
              color: active ? '#00ccff' : 'rgba(255,255,255,0.45)',
            }}
          >
            <span className="text-sm">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {active && (
              <span
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: '0 0 10px rgba(0,204,255,0.3), inset 0 0 6px rgba(0,204,255,0.1)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
