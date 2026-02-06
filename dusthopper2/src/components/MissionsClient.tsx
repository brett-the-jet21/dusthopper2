"use client";

import { useEffect, useMemo, useState } from "react";

type Mission = {
  id: string;
  provider: "spacex" | "nasa";
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

function isUpcoming(m: Mission) {
  if (!m.startTime) return false;
  return Date.parse(m.startTime) > Date.now();
}

export default function MissionsClient({ initial }: { initial: Api }) {
  const [data, setData] = useState<Api>(initial);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const res = await fetch("/api/missions", { cache: "no-store" });
        const next = await res.json();
        if (alive) setData(next);
      } catch {}
    }

    const id = setInterval(tick, 30_000);
    // also refresh once after mount to ensure it's hot
    tick();

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const { upcoming, completed } = useMemo(() => {
    const missions = (data?.missions ?? []) as Mission[];

    const upcoming = missions
      .filter(isUpcoming)
      .sort((a, b) => Date.parse(a.startTime!) - Date.parse(b.startTime!));

    const completed = missions
      .filter((m) => !isUpcoming(m))
      .sort((a, b) => {
        const ta = a.startTime ? Date.parse(a.startTime) : 0;
        const tb = b.startTime ? Date.parse(b.startTime) : 0;
        return tb - ta;
      });

    return { upcoming, completed };
  }, [data]);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex items-baseline justify-between gap-6">
        <h1 className="text-3xl font-bold">Live Missions</h1>
        <p className="text-sm text-neutral-500">
          Updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"} • auto-refresh 30s
        </p>
      </div>

      {upcoming.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold">🚀 Upcoming</h2>
          <div className="grid gap-4">
            {upcoming.map((m) => (
              <MissionCard key={m.id} m={m} highlight />
            ))}
          </div>
        </>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-lg font-semibold">✅ Completed</h2>
          <div className="grid gap-4">
            {completed.map((m) => (
              <MissionCard key={m.id} m={m} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function MissionCard({ m, highlight = false }: { m: Mission; highlight?: boolean }) {
  const tMinus =
    m.startTime && Date.parse(m.startTime) > Date.now()
      ? Math.round((Date.parse(m.startTime) - Date.now()) / 60000)
      : null;

  return (
    <div
      className={[
        "rounded-xl border p-5",
        highlight ? "border-white bg-neutral-900" : "border-neutral-800 bg-neutral-950",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            {m.provider} • {m.agency ?? "—"}
          </div>

          <div className="mt-1 text-xl font-semibold truncate">{m.name}</div>

          <div className="mt-2 text-sm text-neutral-400">
            <span className="text-neutral-200">{m.status}</span>
            {m.startTime ? (
              <>
                {" • "}
                <span className="text-neutral-300">{new Date(m.startTime).toLocaleString()}</span>
              </>
            ) : null}
            {tMinus !== null ? (
              <>
                {" • "}
                <span className="font-semibold text-white">T–{tMinus} min</span>
              </>
            ) : null}
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            {m.vehicle ? `Vehicle: ${m.vehicle}` : null}
            {m.pad ? ` • Pad: ${m.pad}` : null}
            {m.location ? ` • ${m.location}` : null}
          </div>
        </div>

        <a
          href={`/mission/${encodeURIComponent(m.id)}`}
          className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          Details
        </a>
      </div>
    </div>
  );
}
