export type Telemetry = {
  lat: number;   // degrees
  lon: number;   // degrees
  altKm: number; // km above surface
  t: number;     // epoch ms
};

function hashSeed(s: string) {
  // tiny deterministic hash for stable per-mission variation
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295; // 0..1
}

// Smooth fake orbit; deterministic per id, driven by "nowMs"
export function mockTelemetry(nowMs: number, missionId = "test"): Telemetry {
  const seed = hashSeed(missionId);
  const t = nowMs / 1000;

  const baseSpeed = 0.014 + seed * 0.01; // visual speed
  const phase = seed * Math.PI * 2;

  const lon = (((t * baseSpeed * 360) + (seed * 360)) % 360) - 180;

  // inclination-ish: different missions get different inclinations
  const incl = 15 + seed * 70; // 15..85 degrees
  const lat = Math.sin(t * baseSpeed * Math.PI * 2 + phase) * incl;

  // altitude varies slightly
  const altKm = 380 + seed * 420 + Math.sin(t * 0.12 + phase) * (8 + seed * 18);

  return { lat, lon, altKm, t: nowMs };
}
