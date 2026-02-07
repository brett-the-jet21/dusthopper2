import Link from "next/link";

const missions = [
  { id: "starship-flight-7", name: "Starship Flight 7", provider: "SpaceX", status: "LIVE" },
  { id: "crew-9", name: "Crew-9 ISS Mission", provider: "NASA", status: "UPCOMING" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-3xl font-bold mb-6">🚀 DustHopper2 — Mission Control</h1>

      <div className="grid gap-4">
        {missions.map((m) => (
          <Link
            key={m.id}
            href={`/mission/${m.id}`}
            className="border border-zinc-700 rounded p-4 hover:bg-zinc-900 transition"
          >
            <div className="flex justify-between">
              <span className="font-semibold">{m.name}</span>
              <span className={`text-sm ${m.status === "LIVE" ? "text-green-400" : "text-yellow-400"}`}>
                {m.status}
              </span>
            </div>
            <div className="text-zinc-400 text-sm">{m.provider}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
