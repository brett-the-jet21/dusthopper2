export default async function MissionsPage() {
  const res = await fetch("/api/missions", { cache: "no-store" })
  const data = await res.json()

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Live Missions</h1>
      <pre className="mt-6 text-xs bg-black text-green-400 p-4 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  )
}
