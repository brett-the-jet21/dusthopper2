export type Launch = {
  id: string;
  name: string;
  status: "Go" | "TBD" | "TBC" | "Success" | "Failure" | "In Flight" | "Hold" | string;
  net: string; // ISO datetime - No Earlier Than
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
  launchDesignator: string | null;
  orbitalDesignation: string | null;
  rocketConfigFullName: string | null;
  padLatitude: number | null;
  padLongitude: number | null;
};

const LL2_BASE = "https://lldev.thespacedevs.com/2.2.0";

export async function fetchUpcomingLaunches(): Promise<Launch[]> {
  const url = `${LL2_BASE}/launch/upcoming/?limit=15&mode=normal`;

  const res = await fetch(url, {
    next: { revalidate: 600 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    console.error(`LL2 fetch failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const json = await res.json();
  const results: any[] = json?.results ?? [];

  return results.map((l: any): Launch => ({
    id: String(l.id ?? ""),
    name: l.name ?? "Unknown Launch",
    status: l.status?.abbrev ?? l.status?.name ?? "TBD",
    net: l.net ?? new Date().toISOString(),
    windowStart: l.window_start ?? null,
    windowEnd: l.window_end ?? null,
    provider: l.launch_service_provider?.name ?? "Unknown",
    agency: l.launch_service_provider?.name ?? null,
    agencyAbbrev: l.launch_service_provider?.abbrev ?? null,
    vehicle: l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? null,
    pad: l.pad?.name ?? null,
    location: l.pad?.location?.name ?? null,
    country: l.pad?.location?.country_code ?? null,
    imageUrl: l.image?.image_url ?? l.image ?? null,
    missionDescription: l.mission?.description ?? null,
    missionType: l.mission?.type ?? null,
    webcastUrl: extractWebcast(l),
    slug: l.slug ?? null,
    launchDesignator: l.launch_designator ?? null,
    orbitalDesignation: l.mission?.orbit?.abbrev ?? null,
    rocketConfigFullName: l.rocket?.configuration?.full_name ?? null,
    padLatitude: l.pad?.latitude ? parseFloat(l.pad.latitude) : null,
    padLongitude: l.pad?.longitude ? parseFloat(l.pad.longitude) : null,
  }));
}

function extractWebcast(l: any): string | null {
  if (l.vidURLs && Array.isArray(l.vidURLs) && l.vidURLs.length > 0) {
    const first = l.vidURLs[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
  }
  if (l.vid_urls && Array.isArray(l.vid_urls) && l.vid_urls.length > 0) {
    const first = l.vid_urls[0];
    if (typeof first === "string") return first;
    if (first?.url) return first.url;
  }
  return null;
}

export async function fetchRecentLaunches(): Promise<Launch[]> {
  const url = `${LL2_BASE}/launch/previous/?limit=5&mode=normal`;

  const res = await fetch(url, {
    next: { revalidate: 900 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) return [];

  const json = await res.json();
  const results: any[] = json?.results ?? [];

  return results.map((l: any): Launch => ({
    id: String(l.id ?? ""),
    name: l.name ?? "Unknown Launch",
    status: l.status?.abbrev ?? l.status?.name ?? "Complete",
    net: l.net ?? new Date().toISOString(),
    windowStart: l.window_start ?? null,
    windowEnd: l.window_end ?? null,
    provider: l.launch_service_provider?.name ?? "Unknown",
    agency: l.launch_service_provider?.name ?? null,
    agencyAbbrev: l.launch_service_provider?.abbrev ?? null,
    vehicle: l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? null,
    pad: l.pad?.name ?? null,
    location: l.pad?.location?.name ?? null,
    country: l.pad?.location?.country_code ?? null,
    imageUrl: l.image?.image_url ?? l.image ?? null,
    missionDescription: l.mission?.description ?? null,
    missionType: l.mission?.type ?? null,
    webcastUrl: extractWebcast(l),
    slug: l.slug ?? null,
    launchDesignator: l.launch_designator ?? null,
    orbitalDesignation: l.mission?.orbit?.abbrev ?? null,
    rocketConfigFullName: l.rocket?.configuration?.full_name ?? null,
    padLatitude: l.pad?.latitude ? parseFloat(l.pad.latitude) : null,
    padLongitude: l.pad?.longitude ? parseFloat(l.pad.longitude) : null,
  }));
}
