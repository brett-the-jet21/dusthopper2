"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Countdown from "@/components/Countdown";
import type { Launch } from "@/lib/launches";

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
  }
);

type ApiData = {
  updatedAt: string;
  upcoming: Launch[];
  recent: Launch[];
};

export default function Home() {
  const [data, setData] = useState<ApiData | null>(null);
  const [selected, setSelected] = useState<Launch | null>(null);
  const [launchProgress, setLaunchProgress] = useState(-1);
  const animFrameRef = useRef<number>(0);
  const launchStartRef = useRef<number>(0);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/missions", { cache: "no-store" });
      if (!res.ok) return;
      const json: ApiData = await res.json();
      setData(json);
      if (!selected && json.upcoming.length > 0) {
        setSelected(json.upcoming[0]);
      }
    } catch {
      // silent retry next cycle
    }
  }, [selected]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const triggerLaunch = useCallback(() => {
    if (launchProgress >= 0) return;
    setLaunchProgress(0);
    launchStartRef.current = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - launchStartRef.current) / 1000;
      const progress = Math.min(elapsed / 30, 1);
      setLaunchProgress(progress);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, [launchProgress]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const upcoming = data?.upcoming ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
      {/* 3D Scene (full background) */}
      <div className="absolute inset-0 z-0">
        <MissionControlScene launchProgress={launchProgress} />
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent z-10 pointer-events-none" />

      {/* Header */}
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
            {new Date(data.updatedAt).toLocaleTimeString()} &middot;
            Auto-refresh 30s
          </p>
        )}
      </header>

      {/* Sidebar — Missions */}
      <div className="absolute left-0 top-20 bottom-0 w-full sm:w-96 z-20 overflow-y-auto px-4 sm:px-6 pb-8">
        {/* Featured Mission */}
        {selected && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">
                Next Launch
              </span>
              <StatusBadge status={selected.status} />
            </div>
            <h2 className="text-lg font-bold leading-tight">{selected.name}</h2>
            <div className="mt-2 text-xs text-white/50">
              {selected.provider} &middot;{" "}
              {selected.vehicle ?? "Vehicle TBD"}
            </div>
            <div className="mt-1 text-xs text-white/50">
              {selected.pad ?? ""}
              {selected.location ? ` — ${selected.location}` : ""}
            </div>
            {selected.missionDescription && (
              <p className="mt-3 text-xs text-white/40 leading-relaxed line-clamp-3">
                {selected.missionDescription}
              </p>
            )}
            <div className="mt-4 pt-3 border-t border-white/10">
              <Countdown
                targetDate={selected.net}
                onLaunch={triggerLaunch}
              />
            </div>
            <div className="mt-2 text-[10px] text-white/30 font-mono">
              NET: {new Date(selected.net).toLocaleString()}
            </div>
            <Link
              href={`/mission/${encodeURIComponent(selected.id)}/view`}
              className="mt-3 inline-block rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold transition-colors"
            >
              3D Orbit View
            </Link>
          </div>
        )}

        {/* Upcoming list */}
        {upcoming.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3 px-1">
              Upcoming Launches
            </h3>
            <div className="space-y-2">
              {upcoming.map((launch) => (
                <button
                  key={launch.id}
                  onClick={() => {
                    setSelected(launch);
                    setLaunchProgress(-1);
                  }}
                  className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
                    selected?.id === launch.id
                      ? "border-blue-500/50 bg-blue-500/10 backdrop-blur-xl"
                      : "border-white/5 bg-black/40 backdrop-blur-sm hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {launch.name}
                      </div>
                      <div className="text-[11px] text-white/40 mt-0.5">
                        {launch.provider} &middot;{" "}
                        {launch.vehicle ?? "TBD"}
                      </div>
                    </div>
                    <StatusBadge status={launch.status} small />
                  </div>
                  <div className="mt-2">
                    <Countdown targetDate={launch.net} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent launches */}
        {recent.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-semibold mb-3 px-1">
              Recent Launches
            </h3>
            <div className="space-y-2">
              {recent.map((launch) => (
                <div
                  key={launch.id}
                  className="rounded-xl border border-white/5 bg-black/30 backdrop-blur-sm p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate text-white/70">
                        {launch.name}
                      </div>
                      <div className="text-[11px] text-white/30 mt-0.5">
                        {launch.provider} &middot;{" "}
                        {launch.vehicle ?? ""}
                      </div>
                    </div>
                    <StatusBadge status={launch.status} small />
                  </div>
                  <div className="mt-1 text-[10px] text-white/20 font-mono">
                    {new Date(launch.net).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {!data && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-white/30 text-xs mt-4">
              Fetching live mission data...
            </p>
          </div>
        )}
      </div>

      {/* Launch progress */}
      {launchProgress >= 0 && launchProgress < 1 && (
        <div className="absolute bottom-6 right-6 z-20 rounded-xl border border-orange-500/30 bg-black/70 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
              Launch in Progress
            </span>
          </div>
          <div className="mt-1 text-xs text-white/50 font-mono">
            Altitude: {(launchProgress * 400).toFixed(0)} km &middot;
            Velocity: {(launchProgress * 7.8).toFixed(1)} km/s
          </div>
          <div className="mt-2 w-full bg-white/10 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-orange-500 to-yellow-400 h-1.5 rounded-full transition-all"
              style={{ width: `${launchProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {launchProgress >= 1 && (
        <div className="absolute bottom-6 right-6 z-20 rounded-xl border border-green-500/30 bg-black/70 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs font-semibold text-green-300 uppercase tracking-wider">
              Orbit Achieved
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  small = false,
}: {
  status: string;
  small?: boolean;
}) {
  const s = status.toLowerCase();
  let color = "bg-white/10 text-white/50";
  if (s === "go" || s === "go for launch")
    color = "bg-green-500/20 text-green-300";
  else if (s === "tbd" || s === "tbc")
    color = "bg-yellow-500/20 text-yellow-300";
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
