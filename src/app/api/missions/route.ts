import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const missions = [
    {
      id: "starship-flight-7",
      name: "Starship Flight 7",
      provider: "SpaceX",
      status: "LIVE",
      launch_time: new Date().toISOString(),
      description: "Simulated mission feed. Real providers plug in next.",
      telemetry: { altitude_km: 128, velocity_kms: 7.2, stage: "Booster Separation" },
    },
    {
      id: "crew-9",
      name: "Crew-9 ISS Mission",
      provider: "NASA",
      status: "UPCOMING",
      launch_time: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      description: "Simulated mission feed. Real providers plug in next.",
      telemetry: { altitude_km: null, velocity_kms: null, stage: "Pre-launch" },
    },
  ];

  return NextResponse.json({ missions });
}
