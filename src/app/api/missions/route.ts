import { NextResponse } from "next/server";
import { fetchUpcomingLaunches, fetchRecentLaunches } from "@/lib/launches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always fetch fresh — never serve stale build-time data

export async function GET() {
  try {
    const [upcoming, recent] = await Promise.all([
      fetchUpcomingLaunches(),
      fetchRecentLaunches(),
    ]);

    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        upcoming,
        recent,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    console.error("Missions API error:", err);
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        upcoming: [],
        recent: [],
        error: "Failed to fetch launch data",
      },
      { status: 500 }
    );
  }
}
