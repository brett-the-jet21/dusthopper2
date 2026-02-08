export type Vec3 = [number, number, number];

const EARTH_RADIUS_KM = 6371;

// World scale: 1 unit = 1000 km
export const KM_PER_UNIT = 1000;
export const EARTH_RADIUS_UNITS = EARTH_RADIUS_KM / KM_PER_UNIT;

export function latLonAltToXYZ(latDeg: number, lonDeg: number, altKm: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;

  const r = (EARTH_RADIUS_KM + altKm) / KM_PER_UNIT;

  const x = r * Math.cos(lat) * Math.cos(lon);
  const z = r * Math.cos(lat) * Math.sin(lon);
  const y = r * Math.sin(lat);

  return [x, y, z];
}

// Pretty arc (visual, not physically perfect orbital mechanics)
export function arcPoints(a: Vec3, b: Vec3, segments = 160, lift = 0.55): Vec3[] {
  const [ax, ay, az] = a;
  const [bx, by, bz] = b;
  const points: Vec3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const z = az + (bz - az) * t;

    const len = Math.sqrt(x*x + y*y + z*z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;

    // lift strongest in the middle
    const midBoost = 1 - Math.abs(0.5 - t) * 2; // 0 at ends, 1 at middle
    const liftedR = len + lift * midBoost;

    points.push([nx * liftedR, ny * liftedR, nz * liftedR]);
  }

  return points;
}
