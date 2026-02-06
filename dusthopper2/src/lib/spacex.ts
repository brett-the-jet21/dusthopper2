export async function fetchSpaceXMissions() {
  const res = await fetch("https://api.spacexdata.com/v5/launches/latest", {
    next: { revalidate: 60 }
  })
  if (!res.ok) throw new Error("SpaceX fetch failed")
  return res.json()
}
