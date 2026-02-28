/* ====================================================================
   Launch trajectory profiles for Falcon 9 missions

   All data is approximate, derived from public SpaceX webcasts.
   ==================================================================== */

export interface TrajectoryPoint {
  t: number;        // seconds from T-0
  alt: number;      // km altitude
  vel: number;      // m/s velocity
  downrange: number; // km downrange distance
  pitch: number;    // degrees from vertical (0 = straight up, 90 = horizontal)
  throttle: number; // 0..1 engine throttle
}

export interface MissionEvent {
  t: number;
  label: string;
  type: "info" | "critical" | "separation";
}

export interface LaunchProfile {
  name: string;
  trajectory: TrajectoryPoint[];
  boosterReturn: TrajectoryPoint[];
  events: MissionEvent[];
  launchSiteLat: number;  // degrees
  launchSiteLon: number;  // degrees
  launchAzimuth: number;  // degrees clockwise from north
}

/* ---- Falcon 9 LEO (e.g. Crew Dragon / ISS) ---- */

export const FALCON9_LEO: LaunchProfile = {
  name: "Falcon 9 — LEO",
  launchSiteLat: 28.562,
  launchSiteLon: -80.577,
  launchAzimuth: 44, // NE for 51.6° inclination

  trajectory: [
    { t: 0,   alt: 0,    vel: 0,     downrange: 0,    pitch: 0,  throttle: 1.0 },
    { t: 5,   alt: 0.05, vel: 30,    downrange: 0,    pitch: 0,  throttle: 1.0 },
    { t: 15,  alt: 0.4,  vel: 100,   downrange: 0,    pitch: 2,  throttle: 1.0 },
    { t: 30,  alt: 2,    vel: 280,   downrange: 0.2,  pitch: 6,  throttle: 1.0 },
    { t: 45,  alt: 6,    vel: 460,   downrange: 1,    pitch: 14, throttle: 1.0 },
    { t: 60,  alt: 13,   vel: 680,   downrange: 3,    pitch: 24, throttle: 0.80 },
    { t: 75,  alt: 23,   vel: 950,   downrange: 8,    pitch: 32, throttle: 1.0 },
    { t: 90,  alt: 36,   vel: 1350,  downrange: 18,   pitch: 38, throttle: 1.0 },
    { t: 105, alt: 50,   vel: 1850,  downrange: 34,   pitch: 44, throttle: 1.0 },
    { t: 120, alt: 62,   vel: 2500,  downrange: 58,   pitch: 50, throttle: 1.0 },
    { t: 135, alt: 72,   vel: 3400,  downrange: 90,   pitch: 56, throttle: 1.0 },
    { t: 150, alt: 80,   vel: 5200,  downrange: 130,  pitch: 62, throttle: 1.0 },
    // MECO
    { t: 155, alt: 82,   vel: 5800,  downrange: 145,  pitch: 64, throttle: 0.0 },
    // Stage separation
    { t: 158, alt: 84,   vel: 5700,  downrange: 155,  pitch: 65, throttle: 0.0 },
    // SES-1
    { t: 163, alt: 87,   vel: 5650,  downrange: 170,  pitch: 66, throttle: 0.0 },
    { t: 168, alt: 92,   vel: 5700,  downrange: 190,  pitch: 68, throttle: 1.0 },
    { t: 200, alt: 120,  vel: 5900,  downrange: 300,  pitch: 74, throttle: 1.0 },
    { t: 250, alt: 155,  vel: 6400,  downrange: 550,  pitch: 78, throttle: 1.0 },
    { t: 300, alt: 180,  vel: 6800,  downrange: 850,  pitch: 82, throttle: 1.0 },
    { t: 360, alt: 200,  vel: 7200,  downrange: 1300, pitch: 85, throttle: 1.0 },
    { t: 420, alt: 210,  vel: 7500,  downrange: 1800, pitch: 87, throttle: 1.0 },
    { t: 480, alt: 220,  vel: 7680,  downrange: 2400, pitch: 89, throttle: 1.0 },
    // SECO-1
    { t: 510, alt: 220,  vel: 7700,  downrange: 2700, pitch: 90, throttle: 0.0 },
  ],

  boosterReturn: [
    { t: 158, alt: 84,   vel: 5700, downrange: 155, pitch: 65,   throttle: 0.0 },
    { t: 165, alt: 90,   vel: 5400, downrange: 150, pitch: 100,  throttle: 0.0 },
    { t: 175, alt: 100,  vel: 4800, downrange: 130, pitch: 150,  throttle: 0.0 },
    { t: 195, alt: 115,  vel: 3500, downrange: 100, pitch: 170,  throttle: 0.5 },
    { t: 215, alt: 120,  vel: 2000, downrange: 60,  pitch: 178,  throttle: 0.5 },
    { t: 240, alt: 115,  vel: 1200, downrange: 30,  pitch: 180,  throttle: 0.0 },
    { t: 280, alt: 95,   vel: 1000, downrange: 15,  pitch: 180,  throttle: 0.0 },
    { t: 320, alt: 70,   vel: 900,  downrange: 8,   pitch: 180,  throttle: 0.0 },
    { t: 360, alt: 45,   vel: 800,  downrange: 5,   pitch: 180,  throttle: 0.0 },
    // Entry burn
    { t: 380, alt: 35,   vel: 700,  downrange: 3,   pitch: 180,  throttle: 0.6 },
    { t: 400, alt: 22,   vel: 400,  downrange: 2,   pitch: 180,  throttle: 0.0 },
    { t: 440, alt: 8,    vel: 250,  downrange: 1,   pitch: 180,  throttle: 0.0 },
    { t: 470, alt: 3,    vel: 180,  downrange: 0.5, pitch: 180,  throttle: 0.0 },
    // Landing burn
    { t: 490, alt: 1,    vel: 80,   downrange: 0.1, pitch: 180,  throttle: 0.9 },
    { t: 500, alt: 0.3,  vel: 20,   downrange: 0,   pitch: 180,  throttle: 0.4 },
    // Touchdown
    { t: 508, alt: 0,    vel: 0,    downrange: 0,   pitch: 180,  throttle: 0.0 },
  ],

  events: [
    { t: 0,   label: "LIFTOFF",            type: "critical" },
    { t: 58,  label: "MAX-Q",              type: "info" },
    { t: 155, label: "MECO",               type: "critical" },
    { t: 158, label: "STAGE SEPARATION",   type: "separation" },
    { t: 163, label: "SES-1",              type: "critical" },
    { t: 195, label: "BOOSTBACK BURN",     type: "info" },
    { t: 380, label: "ENTRY BURN",         type: "info" },
    { t: 490, label: "LANDING BURN",       type: "critical" },
    { t: 508, label: "BOOSTER LANDING",    type: "critical" },
    { t: 510, label: "SECO-1",             type: "critical" },
  ],
};

/* ====================================================================
   Trajectory interpolation
   ==================================================================== */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function interpolateTrajectory(
  points: TrajectoryPoint[],
  time: number,
): TrajectoryPoint | null {
  if (time < points[0].t) return null;
  if (time >= points[points.length - 1].t) return points[points.length - 1];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (time >= a.t && time < b.t) {
      const f = (time - a.t) / (b.t - a.t);
      return {
        t: time,
        alt: lerp(a.alt, b.alt, f),
        vel: lerp(a.vel, b.vel, f),
        downrange: lerp(a.downrange, b.downrange, f),
        pitch: lerp(a.pitch, b.pitch, f),
        throttle: lerp(a.throttle, b.throttle, f),
      };
    }
  }
  return points[points.length - 1];
}

/* ====================================================================
   Coordinate conversion  –  trajectory → 3D world position

   The scene uses:
     Earth at origin, radius 6.371 units (1 unit = 1000 km)
     Sun at +X
   ==================================================================== */

import * as THREE from "three";

const EARTH_R = 6.371;

export function launchSiteFrame(latDeg: number, lonDeg: number, azimuthDeg: number) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;

  // Surface position
  const pos = new THREE.Vector3(
    EARTH_R * Math.cos(lat) * Math.cos(lon),
    EARTH_R * Math.sin(lat),
    -EARTH_R * Math.cos(lat) * Math.sin(lon),
  );

  // Local up (radial outward)
  const up = pos.clone().normalize();

  // Local north  (∂pos/∂lat normalised)
  const north = new THREE.Vector3(
    -Math.sin(lat) * Math.cos(lon),
    Math.cos(lat),
    Math.sin(lat) * Math.sin(lon),
  ).normalize();

  // Local east  (∂pos/∂lon normalised)
  const east = new THREE.Vector3(
    -Math.sin(lon),
    0,
    -Math.cos(lon),
  ).normalize();

  // Downrange direction (along launch azimuth on the surface)
  const downrange = north
    .clone()
    .multiplyScalar(Math.cos(az))
    .addScaledVector(east, Math.sin(az))
    .normalize();

  return { pos, up, north, east, downrange };
}

/**
 * Convert a trajectory point (altitude & downrange in km) to a
 * world-space THREE.Vector3 on/above the globe.
 */
export function trajectoryToWorld(
  frame: ReturnType<typeof launchSiteFrame>,
  alt_km: number,
  downrange_km: number,
): THREE.Vector3 {
  const alt = alt_km / 1000; // scene units
  const dr = downrange_km / 1000;

  // Angle subtended along the surface great-circle
  const theta = dr / EARTH_R;

  // Point on the surface along the great-circle
  const surfaceDir = frame.pos
    .clone()
    .normalize()
    .multiplyScalar(Math.cos(theta))
    .addScaledVector(frame.downrange, Math.sin(theta))
    .normalize();

  return surfaceDir.multiplyScalar(EARTH_R + alt);
}

/**
 * Compute the quaternion for the rocket orientation.
 * The rocket's local +Y axis should point "up" relative to launch,
 * tilted by `pitchDeg` toward the downrange direction.
 */
export function rocketOrientation(
  frame: ReturnType<typeof launchSiteFrame>,
  pitchDeg: number,
  downrange_km: number,
): THREE.Quaternion {
  const theta = (downrange_km / 1000) / EARTH_R;

  // Local up at the rocket's current ground position
  const localUp = frame.pos
    .clone()
    .normalize()
    .multiplyScalar(Math.cos(theta))
    .addScaledVector(frame.downrange, Math.sin(theta))
    .normalize();

  // Downrange tangent at this position
  const localDR = frame.pos
    .clone()
    .normalize()
    .multiplyScalar(-Math.sin(theta))
    .addScaledVector(frame.downrange, Math.cos(theta))
    .normalize();

  // Rocket body direction: pitched from localUp toward localDR
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const bodyDir = localUp
    .clone()
    .multiplyScalar(Math.cos(pitchRad))
    .addScaledVector(localDR, Math.sin(pitchRad))
    .normalize();

  // Build a rotation matrix where +Y = bodyDir
  const crossDir = new THREE.Vector3().crossVectors(localDR, localUp).normalize();
  const sideDir = new THREE.Vector3().crossVectors(bodyDir, crossDir).normalize();

  const mat = new THREE.Matrix4().makeBasis(crossDir, bodyDir, sideDir);
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}

/* ====================================================================
   Upcoming launches (fallback data if API is unavailable)
   ==================================================================== */

export interface UpcomingLaunch {
  id: string;
  name: string;
  date_utc: string;
  rocket: string;
  launchpad: string;
  details: string | null;
  profile: LaunchProfile;
}

export const FALLBACK_LAUNCHES: UpcomingLaunch[] = [
  {
    id: "demo-crew-9",
    name: "Crew-10 · ISS Rotation",
    date_utc: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    rocket: "Falcon 9",
    launchpad: "KSC LC-39A",
    details: "Crew rotation mission to the International Space Station",
    profile: FALCON9_LEO,
  },
  {
    id: "starlink-12-8",
    name: "Starlink Group 12-8",
    date_utc: new Date(Date.now() + 86400000 * 3).toISOString(),
    rocket: "Falcon 9",
    launchpad: "CCSFS SLC-40",
    details: "Batch deployment of Starlink v2 Mini satellites",
    profile: FALCON9_LEO,
  },
  {
    id: "transporter-14",
    name: "Transporter-14 Rideshare",
    date_utc: new Date(Date.now() + 86400000 * 7).toISOString(),
    rocket: "Falcon 9",
    launchpad: "VAFB SLC-4E",
    details: "Dedicated rideshare mission carrying small satellites",
    profile: { ...FALCON9_LEO, name: "Falcon 9 — SSO", launchSiteLat: 34.632, launchSiteLon: -120.611, launchAzimuth: 196 },
  },
];
