export type NormalizedMission = {
  id: string;
  provider: "spacex" | "nasa";
  name: string;
  status: string;
  startTime?: string | null;
  url?: string | null;
};

export function normalizeMissions(payload: any): NormalizedMission[] {
  const out: NormalizedMission[] = [];

  // SpaceX v5 launches/latest
  const sx = payload?.data?.spacex;
  if (sx && typeof sx === "object") {
    out.push({
      id: sx.id ?? "spacex-latest",
      provider: "spacex",
      name: sx.name ?? "SpaceX Launch",
      status: sx.success === true ? "success" : sx.success === false ? "failed" : (sx.upcoming ? "upcoming" : "unknown"),
      startTime: sx.date_utc ?? null,
      url: sx.links?.webcast ?? sx.links?.article ?? sx.links?.wikipedia ?? null,
    });
  }

  // NASA placeholder (we used techtransfer demo endpoint for MVP)
  const nasa = payload?.data?.nasa;
  if (nasa) {
    out.push({
      id: "nasa-demo",
      provider: "nasa",
      name: "NASA Feed (MVP)",
      status: "ok",
      startTime: payload?.updatedAt ?? null,
      url: "https://api.nasa.gov/",
    });
  }

  return out;
}
