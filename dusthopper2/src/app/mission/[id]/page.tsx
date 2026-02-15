"use client";

import { useEffect, useState, use } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Launch } from "@/lib/launches";

const MissionScene = dynamic(() => import("@/components/MissionScene"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-black flex items-center justify-center">
      <div className="text-white/30 text-sm animate-pulse">Loading 3D...</div>
    </div>
  ),
});

type ApiData = {
  updatedAt: string;
  upcoming: Launch[];
  recent: Launch[];
};

export default function MissionView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/missions", { cache: "no-store" });
        if (!res.ok) return;
        const json: ApiData = await res.json();
        const all = [...json.upcoming, ...json.recent];
        const found = all.find((l) => l.id === id || l.slug === id);
        if (found) setLaunch(found);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [id]);

  const isUpcoming = launch ? Date.parse(launch.net) > Date.now() : false;
  const countdown = launch && isUpcoming ? calcCountdown(launch.net) : null;

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
      {/* 3D background */}
      <div className="absolute inset-0 z-0">
        <MissionScene />
      </div>

      {/* Overlay gradients */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />

      {/* Back button */}
      <div className="relative z-20 p-4 sm:p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Mission Control
        </Link>
      </div>

      {/* Mission details panel */}
      <div className="absolute left-0 top-16 bottom-0 w-full sm:w-[480px] z-20 overflow-y-auto px-4 sm:px-6 pb-8">
        {loading && !launch && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <p className="text-white/30 text-xs mt-4">Loading mission data...</p>
          </div>
        )}

        {!loading && !launch && (
          <div className="py-20 text-center">
            <p className="text-white/40 text-sm">Mission not found</p>
            <p className="text-white/20 text-xs mt-2">ID: {id}</p>
          </div>
        )}

        {launch && (
          <div className="space-y-4">
            {/* Status header */}
            <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Mission Details
                </span>
                <StatusPill status={launch.status} />
              </div>
              <h1 className="text-2xl font-bold leading-tight">{launch.name}</h1>
              <div className="mt-3 text-sm text-white/50">{launch.provider}</div>

              {/* Countdown */}
              {countdown && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-2">
                    Time to Launch
                  </div>
                  <div className="flex gap-3 font-mono">
                    <CountdownUnit value={countdown.days} label="DAYS" />
                    <CountdownUnit value={countdown.hours} label="HRS" />
                    <CountdownUnit value={countdown.minutes} label="MIN" />
                    <CountdownUnit value={countdown.seconds} label="SEC" />
                  </div>
                </div>
              )}

              {!isUpcoming && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-sm text-white/40">
                    Launched: {new Date(launch.net).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Vehicle info */}
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

            {/* Webcast */}
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
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/30">{label}</div>
      <div className="text-sm text-white/70 mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  let color = "bg-white/10 text-white/50";
  if (s === "go" || s === "go for launch") color = "bg-green-500/20 text-green-300";
  else if (s === "tbd" || s === "tbc") color = "bg-yellow-500/20 text-yellow-300";
  else if (s === "success") color = "bg-green-500/20 text-green-300";
  else if (s === "failure") color = "bg-red-500/20 text-red-300";
  else if (s === "in flight") color = "bg-orange-500/20 text-orange-300";

  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${color}`}>
      {status}
    </span>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums">{String(value).padStart(2, "0")}</div>
      <div className="text-[9px] text-white/30 tracking-wider">{label}</div>
    </div>
  );
}

function calcCountdown(target: string) {
  const diff = Math.max(0, Date.parse(target) - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}
