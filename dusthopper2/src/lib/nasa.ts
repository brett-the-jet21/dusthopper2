export async function fetchNasaMissions() {
  const res = await fetch("https://api.nasa.gov/techtransfer/patent/?engine&api_key=DEMO_KEY", {
    next: { revalidate: 300 }
  })
  if (!res.ok) throw new Error("NASA fetch failed")
  return res.json()
}
