"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Countdown from "@/components/Countdown";
import type { Launch } from "@/lib/launches";

const MissionScene = dynamic(() => import("@/components/MissionScene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <div className="text-white/40 text-sm animate-pulse">Loading 3D scene...</div>
    </div>
  ),
});

type ApiData = {
  updatedAt: string;
  upcoming: Launch[];
  recent: Launch[];
};

/* ==================================================================
   Single-page Mission Control — no separate routes.
   When a mission is selected, its detail expands inline.
   ================================================================== */

export default function Home() {
  const [data, setData] = useState<ApiData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (!res.ok) return;
      const json: ApiData = await res.json();
      setData(json);
    } catch {
      /* silent — retry next cycle */
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const selectedLaunch = useMemo(() => {
    if (!selectedId || !data) return null;
    const all = [...data.upcoming, ...data.recent];
    return all.find((l) => l.id === selectedId) ?? null;
  }, [selectedId, data]);

  const triggerLaunch = useCallback(() => {
    if (!isLaunching) setIsLaunching(true);
  }, [isLaunching]);

  const upcoming = data?.upcoming ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
      {/* ===== 3D Scene (full background) ===== */}
      <div className="absolute inset-0 z-0">
        <MissionScene isLaunching={isLaunching} />
      </div>

      {/* Gradient overlays for readability */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none" />

      {/* ===== Header ===== */}
      <header className="relative z-20 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            DustHopper Mission Control
          </h1>
        </div>
        {data && (
          <p className="text-xs text-white/40 mt-1 ml-6">
            Live data &middot; Updated{" "}
            {new Date(data.updatedAt).toLocaleTimeString()} &middot; Auto-refresh
            30s
          </p>
        )}
      </header>

      {/* ===== Sidebar — all content in one panel ===== */}
      <div className="absolute left-0 top-20 bottom-0 w-full sm:w-[420px] z-20 overflow-y-auto px-4 sm:px-6 pb-8">
        {selectedLaunch ? (
          /* ---------- DETAIL VIEW ---------- */
          <MissionDetail
            launch={selectedLaunch}
            onBack={() => setSelectedId(null)}
            onLaunch={triggerLaunch}
          />
        ) : (
          /* ---------- LIST VIEW ---------- */
          <>
            {/* Featured next launch */}
            {upcoming.length > 0 && (
              <FeaturedCard
                launch={upcoming[0]}
                onSelect={() => setSelectedId(upcoming[0].id)}
                onLaunch={triggerLaunch}
              />
            )}

            {/* Upcoming list */}
            {upcoming.length > 1 && (
              <section className="mb-6">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3 px-1">
                  Upcoming Launches
                </h3>
                <div className="space-y-2">
                  {upcoming.slice(1).map((l) => (
                    <MissionCard key={l.id} launch={l} onSelect={() => setSelectedId(l.id)} />
                  ))}
                </div>
              </section>
            )}

            {/* Recent launches */}
            {recent.length > 0 && (
              <section className="mb-6">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3 px-1">
                  Recent Launches
                </h3>
                <div className="space-y-2">
                  {recent.map((l) => (
                    <MissionCard key={l.id} launch={l} onSelect={() => setSelectedId(l.id)} dimmed />
                  ))}
                </div>
              </section>
            )}

            {/* Loading state */}
            {!data && (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                <p className="text-white/30 text-xs mt-4">Fetching live mission data...</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Launch status indicator (bottom-right) ===== */}
      {isLaunching && <LaunchIndicator />}
    </div>
  );
}

/* ------------------------------------------------------------------
   Featured card — the next upcoming launch prominently displayed
   ------------------------------------------------------------------ */
function FeaturedCard({
  launch,
  onSelect,
  onLaunch,
}: {
  launch: Launch;
  onSelect: () => void;
  onLaunch: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left mb-6 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 hover:border-white/20 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
          Next Launch
        </span>
        <StatusBadge status={launch.status} />
      </div>
      <h2 className="text-lg font-bold leading-tight">{launch.name}</h2>
      <div className="mt-2 text-xs text-white/50">
        {launch.provider} &middot; {launch.vehicle ?? "Vehicle TBD"}
      </div>
      <div className="mt-1 text-xs text-white/50">
        {launch.pad ?? ""}
        {launch.location ? ` — ${launch.location}` : ""}
      </div>
      {launch.missionDescription && (
        <p className="mt-3 text-xs text-white/40 leading-relaxed line-clamp-3">
          {launch.missionDescription}
        </p>
      )}
      <div className="mt-4 pt-3 border-t border-white/10">
        <Countdown targetDate={launch.net} onLaunch={onLaunch} />
      </div>
      <div className="mt-2 text-[10px] text-white/30 font-mono">
        NET: {new Date(launch.net).toLocaleString()}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------
   Compact mission card for lists
   ------------------------------------------------------------------ */
function MissionCard({
  launch,
  onSelect,
  dimmed = false,
}: {
  launch: Launch;
  onSelect: () => void;
  dimmed?: boolean;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
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
   Mission detail — expanded inline (replaces the separate page)
   ------------------------------------------------------------------ */
function MissionDetail({
  launch,
  onBack,
  onLaunch,
}: {
  launch: Launch;
  onBack: () => void;
  onLaunch: () => void;
}) {
  const isUpcoming = Date.parse(launch.net) > Date.now();

  return (
    <div className="space-y-4 animate-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors mb-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to missions
      </button>

      {/* Status header */}
      <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            Mission Details
          </span>
          <StatusBadge status={launch.status} />
        </div>
        <h2 className="text-2xl font-bold leading-tight">{launch.name}</h2>
        <div className="mt-3 text-sm text-white/50">{launch.provider}</div>

        {/* Countdown or past date */}
        {isUpcoming ? (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">
              Time to Launch
            </div>
            <Countdown targetDate={launch.net} onLaunch={onLaunch} />
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-white/10 text-sm text-white/40">
            Launched: {new Date(launch.net).toLocaleString()}
          </div>
        )}
      </div>

      {/* Vehicle & pad info */}
      <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
          Vehicle & Pad
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <InfoItem label="Vehicle" value={launch.vehicle} />
          <InfoItem label="Orbit" value={launch.orbitalDesignation} />
          <InfoItem label="Pad" value={launch.pad} />
          <InfoItem label="Location" value={launch.location} />
          <InfoItem label="Country" value={launch.country} />
          <InfoItem label="Agency" value={launch.agency} />
        </div>
      </div>

      {/* Mission description */}
      {launch.missionDescription && (
        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
            Mission Overview
          </h3>
          <p className="text-sm text-white/60 leading-relaxed">
            {launch.missionDescription}
          </p>
          {launch.missionType && (
            <div className="mt-3 text-xs text-white/30">Type: {launch.missionType}</div>
          )}
        </div>
      )}

      {/* Webcast link */}
      {launch.webcastUrl && (
        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-3">
            Watch Live
          </h3>
          <a
            href={launch.webcastUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-red-600/80 hover:bg-red-600 px-4 py-2 text-sm font-semibold transition-colors"
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
   Small helper components
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
    <div className="absolute bottom-6 right-6 z-20 rounded-xl border border-orange-500/30 bg-black/70 backdrop-blur-xl px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
          Launch in Progress
        </span>
      </div>
      <div className="mt-2 w-48 bg-white/10 rounded-full h-1.5 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-yellow-400 h-1.5 rounded-full launch-progress-bar" />
      </div>
    </div>
  );
}
