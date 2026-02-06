export type NormalizedMission = {
  id: string;
  provider: "spacex" | "nasa" | "launchlibrary";
  name: string;
  status: string;
  startTime?: string | null;
  url?: string | null;
};

function pickFirstUrl(obj: any): string | null {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj) && obj.length) return String(obj[0]);
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
      url: sx.links?.webcast ?? sx.links?.article ?? sx.links?.wikipedia ?? null,
    });
  }

  // Launch Library 2 upcoming launches (treat as NASA/Agency mission feed)
  const ll2 = payload?.data?.nasa;
  const launches = ll2?.results;
  if (Array.isArray(launches)) {
    for (const l of launches) {
      // Simple NASA relevance: provider name contains "NASA" or mission mentions NASA.
      const providerName = l?.launch_service_provider?.name ?? "";
      const missionName = l?.mission?.name ?? "";
      const missionDesc = l?.mission?.description ?? "";
      const isNasaish =
        /nasa/i.test(providerName) || /nasa/i.test(missionName) || /nasa/i.test(missionDesc);

      if (!isNasaish) continue;

      out.push({
        id: `ll2-${String(l.id)}`,
        provider: "nasa",
        name: l.name ?? "NASA Launch",
        status: l?.status?.name ?? "upcoming",
        startTime: l.net ?? l.window_start ?? null,
        url: pickFirstUrl(l?.vidURLs) ?? l?.url ?? null,
      });
    }
  }

  return out;
}
