"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Procedural HD Moon — real proportional distance from Earth.

   Scale (Earth radius = 6 scene units):
     Moon radius  = 0.273 × 6 ≈ 1.64
     Moon distance = 60.3 × 6 ≈ 362

   Orbital period: 27.322 days (sidereal).
   Inclination: ~5.14° to ecliptic.
   ------------------------------------------------------------------ */

const MOON_RADIUS = 1.64;
const MOON_DISTANCE = 362;
const MOON_INCLINATION = 5.14 * (Math.PI / 180);
const SIDEREAL_PERIOD = 27.322; // days

const moonVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const moonFrag = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  /* --- Noise functions for procedural surface --- */
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.48;
    }
    return v;
  }

  /* Crater: returns depth (negative = depression, positive = rim) */
  float crater(vec2 p, vec2 center, float radius) {
    float d = length(p - center) / radius;
    if (d > 1.5) return 0.0;
    // Bowl shape with raised rim
    float bowl = smoothstep(0.0, 0.8, d) - 1.0; // -1 at center, 0 at edge
    float rim = exp(-pow((d - 1.0) * 4.0, 2.0)) * 0.3;
    float floor_flat = smoothstep(0.0, 0.3, d); // flat floor
    return bowl * 0.4 * floor_flat + rim;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float NdotL = dot(N, L);
    float NdotV = max(dot(N, V), 0.0);

    /* --- Procedural lunar surface --- */
    vec2 uv = vUv * 20.0;

    // Large-scale maria (dark basaltic plains)
    float maria = fbm(vUv * 4.0 + 0.5);
    maria = smoothstep(0.35, 0.55, maria);

    // Fine detail noise
    float detail = fbm(uv * 1.5) * 0.3 + fbm(uv * 3.0) * 0.15;

    // Major craters
    float craterVal = 0.0;
    craterVal += crater(vUv, vec2(0.35, 0.45), 0.06);  // Tycho-like
    craterVal += crater(vUv, vec2(0.55, 0.30), 0.08);  // Copernicus-like
    craterVal += crater(vUv, vec2(0.70, 0.55), 0.05);
    craterVal += crater(vUv, vec2(0.20, 0.65), 0.07);
    craterVal += crater(vUv, vec2(0.45, 0.75), 0.04);
    craterVal += crater(vUv, vec2(0.80, 0.35), 0.03);
    craterVal += crater(vUv, vec2(0.15, 0.30), 0.05);
    craterVal += crater(vUv, vec2(0.60, 0.70), 0.06);

    // Smaller craters from noise
    for (int i = 0; i < 8; i++) {
      vec2 pos = vec2(hash(vec2(float(i), 0.0)), hash(vec2(0.0, float(i))));
      float r = 0.015 + hash(vec2(float(i), float(i))) * 0.025;
      craterVal += crater(vUv, pos, r);
    }

    // Base albedo: highlands (light gray) vs maria (dark gray)
    vec3 highlandColor = vec3(0.62, 0.60, 0.57);
    vec3 mariaColor = vec3(0.28, 0.27, 0.25);
    vec3 baseColor = mix(highlandColor, mariaColor, maria);

    // Apply detail and craters
    baseColor *= (1.0 + detail * 0.4 + craterVal * 0.5);

    /* --- Lighting --- */
    float diffuse = max(NdotL, 0.0);
    // Lunar surface has no atmosphere — sharp terminator
    float dayMix = smoothstep(-0.02, 0.05, NdotL);

    vec3 dayCol = baseColor * (diffuse * 1.1 + 0.008);

    // Opposition surge (brightness increase at full moon geometry)
    float phase = acos(clamp(dot(L, V), -1.0, 1.0));
    float surge = exp(-phase * phase / 0.15) * 0.15;
    dayCol += baseColor * surge;

    // Limb darkening
    float limbDark = pow(NdotV, 0.15);
    dayCol *= limbDark;

    vec3 color = dayCol * dayMix;

    /* --- Subtle earthshine on night side --- */
    vec3 earthshine = baseColor * 0.008 * (1.0 - dayMix);
    color += earthshine;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function Moon({ sunDirection }: { sunDirection: THREE.Vector3 }) {
  const groupRef = useRef<THREE.Group>(null);

  const moonMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { sunDirection: { value: sunDirection } },
        vertexShader: moonVert,
        fragmentShader: moonFrag,
      }),
    [sunDirection],
  );

  useFrame(() => {
    if (!groupRef.current) return;

    // Compute Moon orbital position from current date
    const now = new Date();
    const JD = now.getTime() / 86400000 + 2440587.5;
    const d = JD - 2451545.0; // days from J2000.0
    const moonLongDeg = (218.316 + 13.176396 * d) % 360;
    const moonLongRad = (moonLongDeg * Math.PI) / 180;

    groupRef.current.position.set(
      MOON_DISTANCE * Math.cos(moonLongRad),
      MOON_DISTANCE * Math.sin(MOON_INCLINATION) * Math.sin(moonLongRad),
      MOON_DISTANCE * Math.sin(moonLongRad),
    );
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[MOON_RADIUS, 96, 96]} />
        <primitive attach="material" object={moonMat} />
      </mesh>
    </group>
  );
}
