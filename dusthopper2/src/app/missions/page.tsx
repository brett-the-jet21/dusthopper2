type Mission = {
  id: string;
  provider: "spacex" | "nasa";
  name: string;
  status: string;
  startTime?: string | null;
  url?: string | null;
};

export default async function MissionsPage() {
  const res = await fetch("https://dusthopper2.space/api/missions", { cache: "no-store" });
  const data = await res.json();

  const missions: Mission[] = (data?.missions ?? []).slice().sort((a: Mission, b: Mission) => {
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

      <div className="mt-6 grid gap-4">
        {missions.map((m) => (
          <div key={m.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-neutral-500">{m.provider}</div>
                <div className="mt-1 text-xl font-semibold">{m.name}</div>
                <div className="mt-2 text-sm text-neutral-400">
                  Status: <span className="text-neutral-200">{m.status}</span>
                  {m.startTime ? (
                    <>
                      {" • "}
                      <span className="text-neutral-300">
                        {new Date(m.startTime).toLocaleString()}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {m.url ? (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
                >
                  Open
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-xs text-neutral-500">
        Sources: NASA={String(!!data?.sources?.nasa)} • SpaceX={String(!!data?.sources?.spacex)}
      </div>
    </main>
  );
}
