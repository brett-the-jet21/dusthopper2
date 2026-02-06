type Mission = {
  id: string;
  provider: "spacex" | "nasa" | "launchlibrary";
  name: string;
  status: string;
  startTime?: string | null;
  url?: string | null;
  agency?: string | null;
};

function isUpcoming(m: Mission) {
  if (!m.startTime) return false;
  return Date.parse(m.startTime) > Date.now();
}

export default async function MissionsPage() {
  const res = await fetch("https://dusthopper2.space/api/missions", { cache: "no-store" });
  const data = await res.json();

  const missions: Mission[] = data?.missions ?? [];

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

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex items-baseline justify-between gap-6">
        <h1 className="text-3xl font-bold">Live Missions</h1>
        <p className="text-sm text-neutral-500">
          Updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"}
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
        <div>
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            {m.provider}{m.agency ? ` • ${m.agency}` : ""}
          </div>
          <div className="mt-1 text-xl font-semibold">{m.name}</div>
          <div className="mt-2 text-sm text-neutral-400">
            Status: <span className="text-neutral-200">{m.status}</span>
            {m.startTime && (
              <>
                {" • "}
                <span className="text-neutral-300">
                  {new Date(m.startTime).toLocaleString()}
                </span>
              </>
            )}
            {tMinus !== null && (
              <>
                {" • "}
                <span className="font-semibold text-white">
                  T–{tMinus} min
                </span>
              </>
            )}
          </div>
        </div>

        {m.url && (
          <a
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Open
          </a>
        )}
      </div>
    </div>
  );
}
