interface Props {
  params: { id: string };
}

export default function MissionView({ params }: Props) {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-2">Mission: {params.id}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="border border-zinc-700 p-4 rounded">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Telemetry</h2>
            <span className="text-green-400 text-xs">● LIVE</span>
          </div>
          <ul className="text-sm text-zinc-300 space-y-2">
            <li className="flex justify-between"><span>Altitude</span><span className="text-white font-semibold">128 km</span></li>
            <li className="flex justify-between"><span>Velocity</span><span className="text-white font-semibold">7.2 km/s</span></li>
            <li className="flex justify-between"><span>Stage</span><span className="text-white font-semibold">Booster Separation</span></li>
          </ul>
          <div className="mt-4 text-xs text-zinc-500">(Simulated — real feeds next.)</div>
        </div>

        <div className="md:col-span-2 border border-zinc-700 p-4 rounded">
          <h2 className="font-semibold mb-2">Visualization</h2>
          <div className="h-64 bg-zinc-900 rounded flex items-center justify-center text-zinc-500">
            ORBIT view next
          </div>
        </div>
      </div>
    </main>
  );
}
