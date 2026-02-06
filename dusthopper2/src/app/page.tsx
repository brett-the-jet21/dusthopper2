export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center text-center p-8">
      <h1 className="text-5xl font-bold tracking-tight">
        DustHopper<span className="text-neutral-400">2</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-neutral-400">
        Live mission data, orbital tracking, and real-time space activity.
      </p>
      <a
        href="/missions"
        className="mt-8 rounded bg-white text-black px-6 py-3 font-semibold"
      >
        View Live Missions
      </a>
    </main>
  )
}
