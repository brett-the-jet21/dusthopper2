export type Launch = {
  id: string;
  name: string;
  status: "Go" | "TBD" | "TBC" | "Success" | "Failure" | "In Flight" | "Hold" | string;
  net: string;
  windowStart: string | null;
  windowEnd: string | null;
  provider: string;
  agency: string | null;
  agencyAbbrev: string | null;
  vehicle: string | null;
  pad: string | null;
  location: string | null;
  country: string | null;
  imageUrl: string | null;
  missionDescription: string | null;
  missionType: string | null;
  webcastUrl: string | null;
  slug: string | null;
  orbitalDesignation: string | null;
  rocketConfigFullName: string | null;
  padLatitude: number | null;
  padLongitude: number | null;
};

// Use the dev endpoint — less restrictive rate limits for free access
const LL2_BASE = "https://lldev.thespacedevs.com/2.2.0";

export async function fetchUpcomingLaunches(): Promise<Launch[]> {
  try {
    const url = `${LL2_BASE}/launch/upcoming/?limit=15&mode=normal`;
    const res = await fetch(url, {
      next: { revalidate: 600 }, // 10 min cache — stay under rate limits
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.error(`LL2 upcoming fetch failed: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const results: any[] = json?.results ?? [];
    if (results.length === 0) return [];

    return results.map(mapLaunch);
  } catch (err) {
    console.error("fetchUpcomingLaunches error:", err);
    return [];
  }
}

export async function fetchRecentLaunches(): Promise<Launch[]> {
  try {
    const url = `${LL2_BASE}/launch/previous/?limit=5&mode=normal`;
    const res = await fetch(url, {
      next: { revalidate: 900 }, // 15 min cache
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return [];

    const json = await res.json();
    const results: any[] = json?.results ?? [];
    if (results.length === 0) return [];

    return results.map(mapLaunch);
  } catch (err) {
    console.error("fetchRecentLaunches error:", err);
    return [];
  }
}

function mapLaunch(l: any): Launch {
  return {
    id: String(l.id ?? ""),
    name: l.name ?? "Unknown Launch",
    status: l.status?.abbrev ?? l.status?.name ?? "TBD",
    net: l.net ?? new Date().toISOString(),
    windowStart: l.window_start ?? null,
    windowEnd: l.window_end ?? null,
    provider: l.launch_service_provider?.name ?? "Unknown",
    agency: l.launch_service_provider?.name ?? null,
    agencyAbbrev: l.launch_service_provider?.abbrev ?? null,
    vehicle:
      l.rocket?.configuration?.full_name ??
      l.rocket?.configuration?.name ??
      null,
    pad: l.pad?.name ?? null,
    location: l.pad?.location?.name ?? null,
    country: l.pad?.location?.country_code ?? null,
    imageUrl: l.image?.image_url ?? l.image ?? null,
    missionDescription: l.mission?.description ?? null,
    missionType: l.mission?.type ?? null,
    webcastUrl: extractWebcast(l),
    slug: l.slug ?? null,
    orbitalDesignation: l.mission?.orbit?.abbrev ?? null,
    rocketConfigFullName: l.rocket?.configuration?.full_name ?? null,
    padLatitude: l.pad?.latitude ? parseFloat(l.pad.latitude) : null,
    padLongitude: l.pad?.longitude ? parseFloat(l.pad.longitude) : null,
  };
}

function extractWebcast(l: any): string | null {
  for (const key of ["vidURLs", "vid_urls"]) {
    const arr = l[key];
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      if (typeof first === "string") return first;
      if (first?.url) return first.url;
    }
  }
  return null;
}
