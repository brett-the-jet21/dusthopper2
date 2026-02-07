interface Props {
  params: { id: string };
}

export default function MissionView({ params }: Props) {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-2">Mission: {params.id}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="border border-zinc-700 p-4 rounded">
          <h2 className="font-semibold mb-2">Telemetry</h2>
          <ul className="text-sm text-zinc-300 space-y-1">
            <li>Altitude: 128 km</li>
            <li>Velocity: 7.2 km/s</li>
            <li>Stage: Booster Separation</li>
          </ul>
        </div>

        <div className="md:col-span-2 border border-zinc-700 p-4 rounded">
          <h2 className="font-semibold mb-2">Visualization</h2>
          <div className="h-64 bg-zinc-900 rounded flex items-center justify-center text-zinc-500">
            3D View Placeholder
          </div>
        </div>
      </div>
    </main>
  );
}
