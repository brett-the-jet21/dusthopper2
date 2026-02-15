import { NextResponse } from "next/server";
import { fetchUpcomingLaunches, fetchRecentLaunches } from "@/lib/launches";

export const runtime = "nodejs";
export const revalidate = 120;

export async function GET() {
  try {
    const [upcoming, recent] = await Promise.all([
      fetchUpcomingLaunches(),
      fetchRecentLaunches(),
    ]);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      upcoming,
      recent,
    });
  } catch (err) {
    console.error("Missions API error:", err);
    return NextResponse.json(
      { updatedAt: new Date().toISOString(), upcoming: [], recent: [], error: "Failed to fetch" },
      { status: 500 }
    );
  }
}
