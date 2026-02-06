type Mission = {
  id: string;
  provider: string;
  name: string;
  status: string;
  startTime?: string | null;
  agency?: string | null;
  vehicle?: string | null;
  pad?: string | null;
  location?: string | null;
  externalUrl?: string | null;
};

export default async function MissionPage({ params }: { params: { id: string } }) {
  const res = await fetch("https://dusthopper2.space/api/missions", { cache: "no-store" });
  const data = await res.json();

  const missions: Mission[] = data?.missions ?? [];
  const mission = missions.find((m) => m.id === params.id);

  if (!mission) {
    return (
      <main className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">Mission not found</h1>
        <p className="mt-3 text-neutral-500">This mission may have expired from the feed.</p>
        <a className="mt-6 inline-block underline" href="/missions">Back to Live Missions</a>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <a className="text-sm underline text-neutral-400" href="/missions">← Back</a>

      <h1 className="mt-4 text-4xl font-bold">{mission.name}</h1>
      <div className="mt-2 text-neutral-400">
        {mission.provider.toUpperCase()} • {mission.agency ?? "—"}
      </div>

      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="grid gap-2 text-sm">
          <Row k="Status" v={mission.status} />
          <Row k="NET" v={mission.startTime ? new Date(mission.startTime).toLocaleString() : "—"} />
          <Row k="Vehicle" v={mission.vehicle ?? "—"} />
          <Row k="Pad" v={mission.pad ?? "—"} />
          <Row k="Location" v={mission.location ?? "—"} />
        </div>
      </div>

      {/* Optional external link, de-emphasized */}
      {mission.externalUrl ? (
        <div className="mt-6 text-sm text-neutral-500">
          Source link:{" "}
          <a className="underline" href={mission.externalUrl} target="_blank" rel="noreferrer">
            view
          </a>
        </div>
      ) : null}
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <div className="text-neutral-500">{k}</div>
      <div className="text-neutral-200 text-right">{v}</div>
    </div>
  );
}
