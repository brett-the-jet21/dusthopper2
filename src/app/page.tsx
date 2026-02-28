"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Countdown from "@/components/Countdown";
import type { Launch } from "@/lib/launches";
import type { LaunchTelemetry } from "@/components/Rocket";
import type { TrackTarget } from "@/components/MissionControlScene";

const MissionControlScene = dynamic(
  () => import("@/components/MissionControlScene"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="text-white/40 text-sm animate-pulse">
          Loading 3D scene...
        </div>
      </div>
    ),
  },
);

type ApiData = {
  updatedAt: string;
  upcoming: Launch[];
  recent: Launch[];
};

/* ==================================================================
   DustHopper Mission Control — the coolest live space mission site
   ================================================================== */

export default function Home() {
  const [data, setData] = useState<ApiData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<LaunchTelemetry | null>(null);
  const [trackTarget, setTrackTarget] = useState<TrackTarget>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const telemetryRef = useRef<LaunchTelemetry | null>(null);

  // Throttle telemetry updates
  const onTelemetry = useCallback((t: LaunchTelemetry) => {
    telemetryRef.current = t;
  }, []);

  useEffect(() => {
    if (!isLaunching) return;
    const id = setInterval(() => {
      if (telemetryRef.current) setTelemetry({ ...telemetryRef.current });
    }, 250);
    return () => clearInterval(id);
  }, [isLaunching]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case "1": setTrackTarget("overview"); break;
        case "2": setTrackTarget("earth"); break;
        case "3": setTrackTarget("moon"); break;
        case "4": setTrackTarget("sun"); break;
        case "5": setTrackTarget("iss"); break;
        case "6": if (isLaunching) setTrackTarget("rocket"); break;
        case "escape": setTrackTarget("overview"); setSelectedId(null); setDrawerOpen(false); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLaunching]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (!res.ok) return;
      const json: ApiData = await res.json();
      setData(json);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const selectedLaunch = useMemo(() => {
    if (!selectedId || !data) return null;
    return [...data.upcoming, ...data.recent].find((l) => l.id === selectedId) ?? null;
  }, [selectedId, data]);

  const triggerLaunch = useCallback(() => {
    if (!isLaunching) {
      setIsLaunching(true);
      setTrackTarget("rocket");
    }
  }, [isLaunching]);

  const upcoming = data?.upcoming ?? [];
  const recent = data?.recent ?? [];
  const nextLaunch = upcoming[0] ?? null;

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
      {/* 3D Scene */}
      <div className="absolute inset-0 z-0">
        <MissionControlScene
          isLaunching={isLaunching}
          onTelemetry={onTelemetry}
          trackTarget={trackTarget}
          onTargetChange={setTrackTarget}
        />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-24 sm:h-32 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-32 sm:h-48 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 p-3 sm:p-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400 animate-pulse" />
          <h1 className="text-base sm:text-2xl font-bold tracking-tight">
            DustHopper Mission Control
          </h1>
        </div>
        {data && (
          <p className="text-[10px] sm:text-xs text-white/40 mt-0.5 sm:mt-1 ml-5 sm:ml-6">
            Live &middot; Updated{" "}
            {new Date(data.updatedAt).toLocaleTimeString()} &middot; 30s refresh
          </p>
        )}
      </header>

      {/* ===== Target selector — floating nav ===== */}
      <TargetSelector
        current={trackTarget}
        onChange={setTrackTarget}
        isLaunching={isLaunching}
      />

      {/* ===== DESKTOP: collapsible sidebar (sm+) ===== */}
      <div
        className={`hidden sm:flex absolute left-0 top-20 bottom-0 z-20 transition-all duration-300 ease-out ${
          sidebarOpen ? "w-[420px]" : "w-0"
        }`}
      >
        {/* Sidebar content */}
        <div
          className={`w-[420px] h-full overflow-y-auto px-6 pb-8 transition-opacity duration-200 ${
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {selectedLaunch ? (
            <MissionDetail
              launch={selectedLaunch}
              onBack={() => setSelectedId(null)}
              onLaunch={triggerLaunch}
            />
          ) : (
            <MissionList
              upcoming={upcoming}
              recent={recent}
              data={data}
              onSelect={(id) => setSelectedId(id)}
              onLaunch={triggerLaunch}
            />
          )}
        </div>

        {/* Collapse / expand toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="shrink-0 self-start mt-2 w-7 h-14 flex items-center justify-center rounded-r-lg bg-black/60 backdrop-blur-xl border border-l-0 border-white/10 hover:bg-white/10 transition-colors"
          title={sidebarOpen ? "Collapse panel" : "Expand panel"}
        >
          <svg
            className={`w-4 h-4 text-white/50 transition-transform duration-300 ${sidebarOpen ? "" : "rotate-180"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* ===== MOBILE: bottom drawer (<sm) ===== */}
      <div
        className={`sm:hidden fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-5rem)]"
        }`}
      >
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/40 -z-10"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <div className="bg-black/90 backdrop-blur-2xl border-t border-white/10 rounded-t-2xl max-h-[80vh] flex flex-col">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="w-full flex flex-col items-center pt-2 pb-3 px-4"
          >
            <div className="w-10 h-1 rounded-full bg-white/30 mb-2" />
            {!drawerOpen && nextLaunch && (
              <div className="w-full flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{nextLaunch.name}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{nextLaunch.provider}</div>
                </div>
                <div className="ml-3 shrink-0">
                  <Countdown targetDate={nextLaunch.net} onLaunch={triggerLaunch} />
                </div>
              </div>
            )}
            {!drawerOpen && !nextLaunch && !data && (
              <div className="text-xs text-white/30 animate-pulse">Loading missions...</div>
            )}
          </button>
          {drawerOpen && (
            <div className="overflow-y-auto flex-1 px-4 pb-6">
              {selectedLaunch ? (
                <MissionDetail
                  launch={selectedLaunch}
                  onBack={() => setSelectedId(null)}
                  onLaunch={triggerLaunch}
                />
              ) : (
                <MissionList
                  upcoming={upcoming}
                  recent={recent}
                  data={data}
                  onSelect={(id) => setSelectedId(id)}
                  onLaunch={triggerLaunch}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Launch telemetry overlay */}
      {isLaunching && telemetry && <TelemetryOverlay t={telemetry} />}
      {isLaunching && !telemetry && <LaunchIndicator />}
    </div>
  );
}

/* ------------------------------------------------------------------
   Target selector — floating pill nav for object tracking
   ------------------------------------------------------------------ */
const targets: { id: TrackTarget; label: string; icon: string; key: string; color: string }[] = [
  { id: "overview", label: "Overview", icon: "🌌", key: "1", color: "#ffffff" },
  { id: "earth", label: "Earth", icon: "🌍", key: "2", color: "#44aaff" },
  { id: "moon", label: "Moon", icon: "🌙", key: "3", color: "#aaaacc" },
  { id: "sun", label: "Sun", icon: "☀️", key: "4", color: "#ffaa33" },
  { id: "iss", label: "ISS", icon: "🛰️", key: "5", color: "#66ffaa" },
];

function TargetSelector({
  current,
  onChange,
  isLaunching,
}: {
  current: TrackTarget;
  onChange: (t: TrackTarget) => void;
  isLaunching: boolean;
}) {
  const allTargets = isLaunching
    ? [...targets, { id: "rocket" as TrackTarget, label: "Rocket", icon: "🚀", key: "6", color: "#ff6644" }]
    : targets;

  return (
    <div className="absolute top-3 sm:top-6 right-3 sm:right-6 z-30 flex gap-1 sm:gap-1.5">
      {allTargets.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(current === t.id && t.id !== "overview" ? "overview" : t.id)}
          className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-semibold transition-all duration-200 backdrop-blur-xl border min-h-[36px] sm:min-h-[40px] ${
            current === t.id
              ? "bg-white/15 border-white/30 text-white scale-105"
              : "bg-black/40 border-white/8 text-white/50 hover:text-white/80 hover:border-white/15 hover:bg-white/8"
          }`}
          title={`${t.label} (${t.key})`}
        >
          <span className="text-sm sm:text-base">{t.icon}</span>
          <span className="hidden sm:inline">{t.label}</span>
          {current === t.id && (
            <div
              className="absolute inset-0 rounded-full opacity-20 animate-pulse"
              style={{ boxShadow: `0 0 12px ${t.color}, inset 0 0 8px ${t.color}40` }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------
   Mission list
   ------------------------------------------------------------------ */
function MissionList({
  upcoming, recent, data, onSelect, onLaunch,
}: {
  upcoming: Launch[];
  recent: Launch[];
  data: ApiData | null;
  onSelect: (id: string) => void;
  onLaunch: () => void;
}) {
  return (
    <>
      {upcoming.length > 0 && (
        <FeaturedCard launch={upcoming[0]} onSelect={() => onSelect(upcoming[0].id)} onLaunch={onLaunch} />
      )}
      {upcoming.length > 1 && (
        <section className="mb-6">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3 px-1">
            Upcoming Launches
          </h3>
          <div className="space-y-2">
            {upcoming.slice(1).map((l) => (
              <MissionCard key={l.id} launch={l} onSelect={() => onSelect(l.id)} />
            ))}
          </div>
        </section>
      )}
      {recent.length > 0 && (
        <section className="mb-6">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3 px-1">
            Recent Launches
          </h3>
          <div className="space-y-2">
            {recent.map((l) => (
              <MissionCard key={l.id} launch={l} onSelect={() => onSelect(l.id)} dimmed />
            ))}
          </div>
        </section>
      )}
      {!data && (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          <p className="text-white/30 text-xs mt-4">Fetching live mission data...</p>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------
   Featured card
   ------------------------------------------------------------------ */
function FeaturedCard({
  launch, onSelect, onLaunch,
}: {
  launch: Launch;
  onSelect: () => void;
  onLaunch: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left mb-4 sm:mb-6 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-4 sm:p-5 hover:border-white/20 transition-all active:scale-[0.98]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
          Next Launch
        </span>
        <StatusBadge status={launch.status} />
      </div>
      <h2 className="text-base sm:text-lg font-bold leading-tight">{launch.name}</h2>
      <div className="mt-1.5 sm:mt-2 text-xs text-white/50">
        {launch.provider} &middot; {launch.vehicle ?? "Vehicle TBD"}
      </div>
      <div className="mt-1 text-xs text-white/50">
        {launch.pad ?? ""}
        {launch.location ? ` — ${launch.location}` : ""}
      </div>
      {launch.missionDescription && (
        <p className="mt-2 sm:mt-3 text-xs text-white/40 leading-relaxed line-clamp-2 sm:line-clamp-3">
          {launch.missionDescription}
        </p>
      )}
      <div className="mt-3 sm:mt-4 pt-3 border-t border-white/10">
        <Countdown targetDate={launch.net} onLaunch={onLaunch} />
      </div>
      <div className="mt-1.5 sm:mt-2 text-[10px] text-white/30 font-mono">
        NET: {new Date(launch.net).toLocaleString()}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------
   Compact mission card
   ------------------------------------------------------------------ */
function MissionCard({
  launch, onSelect, dimmed = false,
}: {
  launch: Launch;
  onSelect: () => void;
  dimmed?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 active:scale-[0.98] ${
        dimmed
          ? "border-white/5 bg-black/30 backdrop-blur-sm hover:bg-white/5 hover:border-white/10"
          : "border-white/5 bg-black/40 backdrop-blur-sm hover:bg-white/5 hover:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold truncate ${dimmed ? "text-white/70" : ""}`}>
            {launch.name}
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {launch.provider} &middot; {launch.vehicle ?? "TBD"}
          </div>
        </div>
        <StatusBadge status={launch.status} small />
      </div>
      <div className="mt-2">
        {Date.parse(launch.net) > Date.now() ? (
          <Countdown targetDate={launch.net} />
        ) : (
          <span className="text-[10px] text-white/20 font-mono">
            {new Date(launch.net).toLocaleDateString()}
          </span>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------
   Mission detail
   ------------------------------------------------------------------ */
function MissionDetail({
  launch, onBack, onLaunch,
}: {
  launch: Launch;
  onBack: () => void;
  onLaunch: () => void;
}) {
  const isUpcoming = Date.parse(launch.net) > Date.now();

  return (
    <div className="space-y-3 sm:space-y-4 animate-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors mb-1 sm:mb-2 min-h-[44px]"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to missions
      </button>

      <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Mission Details</span>
          <StatusBadge status={launch.status} />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold leading-tight">{launch.name}</h2>
        <div className="mt-2 sm:mt-3 text-sm text-white/50">{launch.provider}</div>
        {isUpcoming ? (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">Time to Launch</div>
            <Countdown targetDate={launch.net} onLaunch={onLaunch} />
          </div>
        ) : (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 text-sm text-white/40">
            Launched: {new Date(launch.net).toLocaleString()}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-4 sm:p-5">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">Vehicle & Pad</h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <InfoItem label="Vehicle" value={launch.vehicle} />
          <InfoItem label="Orbit" value={launch.orbitalDesignation} />
          <InfoItem label="Pad" value={launch.pad} />
          <InfoItem label="Location" value={launch.location} />
          <InfoItem label="Country" value={launch.country} />
          <InfoItem label="Agency" value={launch.agency} />
        </div>
      </div>

      {launch.missionDescription && (
        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-4 sm:p-5">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">Mission Overview</h3>
          <p className="text-sm text-white/60 leading-relaxed">{launch.missionDescription}</p>
          {launch.missionType && (
            <div className="mt-3 text-xs text-white/30">Type: {launch.missionType}</div>
          )}
        </div>
      )}

      {launch.webcastUrl && (
        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-4 sm:p-5">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">Watch Live</h3>
          <a
            href={launch.webcastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600/80 hover:bg-red-600 px-4 py-2.5 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch Webcast
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Telemetry overlay
   ------------------------------------------------------------------ */
function TelemetryOverlay({ t }: { t: LaunchTelemetry }) {
  const metMin = Math.floor(t.met / 60);
  const metSec = Math.floor(t.met % 60);
  const metStr = `T+${String(metMin).padStart(2, "0")}:${String(metSec).padStart(2, "0")}`;

  return (
    <div className="absolute top-14 sm:top-20 right-3 sm:right-6 z-20 rounded-xl border border-cyan-500/20 bg-black/70 backdrop-blur-xl p-3 sm:p-4 font-mono text-xs sm:text-sm min-w-[160px] sm:min-w-[200px] mt-12 sm:mt-14">
      <div className="text-cyan-400 font-bold text-sm sm:text-base mb-2 sm:mb-3">{metStr}</div>
      <div className="space-y-1.5 sm:space-y-2">
        <TelemetryRow label="ALT" value={`${t.altitude.toLocaleString()} km`} />
        <TelemetryRow label="VEL" value={`${t.speed.toLocaleString()} km/h`} />
      </div>
      <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-white/30">Phase</div>
        <div className="text-white/80 font-semibold mt-0.5">{t.phase}</div>
      </div>
      {t.phase === "Stage Separation" && (
        <div className="mt-2 py-1 px-2 rounded bg-orange-500/20 text-orange-300 text-center text-[10px] uppercase tracking-wider font-bold animate-pulse">
          Stage Sep
        </div>
      )}
    </div>
  );
}

function TelemetryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/30">{label}</span>
      <span className="text-white/80 tabular-nums">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/30">{label}</div>
      <div className="text-sm text-white/70 mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function StatusBadge({ status, small = false }: { status: string; small?: boolean }) {
  const s = status.toLowerCase();
  let color = "bg-white/10 text-white/50";
  if (s === "go" || s === "go for launch") color = "bg-green-500/20 text-green-300";
  else if (s === "tbd" || s === "tbc") color = "bg-yellow-500/20 text-yellow-300";
  else if (s === "success") color = "bg-green-500/20 text-green-300";
  else if (s === "failure") color = "bg-red-500/20 text-red-300";
  else if (s === "in flight") color = "bg-orange-500/20 text-orange-300";
  else if (s === "hold") color = "bg-yellow-500/20 text-yellow-300";

  return (
    <span
      className={`shrink-0 rounded-full font-semibold uppercase tracking-wider ${color} ${
        small ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]"
      }`}
    >
      {status}
    </span>
  );
}

function LaunchIndicator() {
  return (
    <div className="absolute bottom-20 sm:bottom-6 right-3 sm:right-6 z-20 rounded-xl border border-orange-500/30 bg-black/70 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        <span className="text-[10px] sm:text-xs font-semibold text-orange-300 uppercase tracking-wider">
          Launch in Progress
        </span>
      </div>
      <div className="mt-2 w-36 sm:w-48 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-yellow-400 h-1.5 rounded-full launch-progress-bar" />
      </div>
    </div>
  );
}
