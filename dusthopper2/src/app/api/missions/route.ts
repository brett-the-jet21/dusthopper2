import { fetchNasaMissions } from "@/lib/nasa";
import { fetchSpaceXMissions } from "@/lib/spacex";

export const runtime = "nodejs";

export async function GET() {
  const [nasa, spacex] = await Promise.allSettled([
    fetchNasaMissions(),
    fetchSpaceXMissions(),
  ]);

  return Response.json({
    updatedAt: new Date().toISOString(),
    sources: {
      nasa: nasa.status === "fulfilled",
      spacex: spacex.status === "fulfilled",
    },
    data: {
      nasa: nasa.status === "fulfilled" ? nasa.value : null,
      spacex: spacex.status === "fulfilled" ? spacex.value : null,
    },
  });
}
