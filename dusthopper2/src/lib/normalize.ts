export type NormalizedMission = {
  id: string;
  provider: "spacex" | "nasa";
  name: string;
  status: string;
  startTime?: string | null; // NET
  agency?: string | null;
  vehicle?: string | null;
  pad?: string | null;
  location?: string | null;

  // Optional: keep for later, but UI won’t emphasize it
  externalUrl?: string | null;
};

function pickFirstUrl(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj) && obj.length) {
    const first = obj[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      if (typeof first.url === "string") return first.url;
      if (typeof first.href === "string") return first.href;
    }
    return null;
  }
  if (obj && typeof obj === "object") {
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj.href === "string") return obj.href;
  }
  return null;
}

export function normalizeMissions(payload: any): NormalizedMission[] {
  const out: NormalizedMission[] = [];

  // SpaceX v5 launches/latest
  const sx = payload?.data?.spacex;
  if (sx && typeof sx === "object") {
    out.push({
      id: String(sx.id ?? "spacex-latest"),
      provider: "spacex",
      name: sx.name ?? "SpaceX Launch",
      status:
        sx.success === true
          ? "success"
          : sx.success === false
          ? "failed"
          : sx.upcoming
          ? "upcoming"
          : "unknown",
      startTime: sx.date_utc ?? null,
      agency: "SpaceX",
      vehicle: sx?.rocket ?? null,
      pad: sx?.launchpad ?? null,
      location: null,
      externalUrl: sx.links?.webcast ?? sx.links?.article ?? sx.links?.wikipedia ?? null,
    });
  }

  // Launch Library 2 upcoming launches (we previously stored this in payload.data.nasa)
  const ll2 = payload?.data?.nasa;
  const launches = ll2?.results;
  if (Array.isArray(launches)) {
    for (const l of launches) {
      const agency = l?.launch_service_provider?.name ?? null;

      // keep “NASA-ish” filter (your call). Leaving as-is for now.
      const missionName = l?.mission?.name ?? "";
      const missionDesc = l?.mission?.description ?? "";
      const isNasaish =
        /nasa/i.test(String(agency ?? "")) ||
        /nasa/i.test(missionName) ||
        /nasa/i.test(missionDesc);

      if (!isNasaish) continue;

      out.push({
        id: `ll2-${String(l.id)}`,
        provider: "nasa",
        name: l?.name ?? "NASA Launch",
        status: l?.status?.name ?? "upcoming",
        startTime: l?.net ?? l?.window_start ?? null,
        agency,
        vehicle: l?.rocket?.configuration?.name ?? null,
        pad: l?.pad?.name ?? null,
        location: l?.pad?.location?.name ?? null,
        externalUrl: pickFirstUrl(l?.vidURLs) ?? l?.url ?? null,
      });
    }
  }

  return out;
}
