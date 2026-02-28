"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Procedural HD Moon — visible at a dramatic but navigable distance.
   Scaled for visual impact while keeping orbital mechanics correct.

   Earth radius = 6 scene units.
   Moon radius  = 1.64 (real proportional scale).
   Moon distance = 80 units (compressed from 362 for visibility —
   still far enough to feel like a journey when you fly there).
   ------------------------------------------------------------------ */

const MOON_RADIUS = 1.64;
const MOON_DISTANCE = 80;
const MOON_INCLINATION = 5.14 * (Math.PI / 180);

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

  float crater(vec2 p, vec2 center, float radius) {
    float d = length(p - center) / radius;
    if (d > 1.5) return 0.0;
    float bowl = smoothstep(0.0, 0.8, d) - 1.0;
    float rim = exp(-pow((d - 1.0) * 4.0, 2.0)) * 0.3;
    float floor_flat = smoothstep(0.0, 0.3, d);
    return bowl * 0.4 * floor_flat + rim;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float NdotL = dot(N, L);
    float NdotV = max(dot(N, V), 0.0);

    vec2 uv = vUv * 20.0;
    float maria = fbm(vUv * 4.0 + 0.5);
    maria = smoothstep(0.35, 0.55, maria);
    float detail = fbm(uv * 1.5) * 0.3 + fbm(uv * 3.0) * 0.15;

    float craterVal = 0.0;
    craterVal += crater(vUv, vec2(0.35, 0.45), 0.06);
    craterVal += crater(vUv, vec2(0.55, 0.30), 0.08);
    craterVal += crater(vUv, vec2(0.70, 0.55), 0.05);
    craterVal += crater(vUv, vec2(0.20, 0.65), 0.07);
    craterVal += crater(vUv, vec2(0.45, 0.75), 0.04);
    craterVal += crater(vUv, vec2(0.80, 0.35), 0.03);
    craterVal += crater(vUv, vec2(0.15, 0.30), 0.05);
    craterVal += crater(vUv, vec2(0.60, 0.70), 0.06);

    for (int i = 0; i < 8; i++) {
      vec2 pos = vec2(hash(vec2(float(i), 0.0)), hash(vec2(0.0, float(i))));
      float r = 0.015 + hash(vec2(float(i), float(i))) * 0.025;
      craterVal += crater(vUv, pos, r);
    }

    vec3 highlandColor = vec3(0.62, 0.60, 0.57);
    vec3 mariaColor = vec3(0.28, 0.27, 0.25);
    vec3 baseColor = mix(highlandColor, mariaColor, maria);
    baseColor *= (1.0 + detail * 0.4 + craterVal * 0.5);

    float diffuse = max(NdotL, 0.0);
    float dayMix = smoothstep(-0.02, 0.05, NdotL);
    vec3 dayCol = baseColor * (diffuse * 1.1 + 0.008);

    float phase = acos(clamp(dot(L, V), -1.0, 1.0));
    float surge = exp(-phase * phase / 0.15) * 0.15;
    dayCol += baseColor * surge;

    float limbDark = pow(NdotV, 0.15);
    dayCol *= limbDark;

    vec3 color = dayCol * dayMix;
    vec3 earthshine = baseColor * 0.012 * (1.0 - dayMix);
    color += earthshine;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Export for camera tracking
export function getMoonPosition(): THREE.Vector3 {
  const now = new Date();
  const JD = now.getTime() / 86400000 + 2440587.5;
  const d = JD - 2451545.0;
  const moonLongDeg = (218.316 + 13.176396 * d) % 360;
  const moonLongRad = (moonLongDeg * Math.PI) / 180;
  return new THREE.Vector3(
    MOON_DISTANCE * Math.cos(moonLongRad),
    MOON_DISTANCE * Math.sin(MOON_INCLINATION) * Math.sin(moonLongRad),
    MOON_DISTANCE * Math.sin(moonLongRad),
  );
}

type MoonProps = {
  sunDirection: THREE.Vector3;
  onClick?: () => void;
  positionRef?: React.MutableRefObject<THREE.Vector3>;
};

export default function Moon({ sunDirection, onClick, positionRef }: MoonProps) {
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

    const now = new Date();
    const JD = now.getTime() / 86400000 + 2440587.5;
    const d = JD - 2451545.0;
    const moonLongDeg = (218.316 + 13.176396 * d) % 360;
    const moonLongRad = (moonLongDeg * Math.PI) / 180;

    const x = MOON_DISTANCE * Math.cos(moonLongRad);
    const y = MOON_DISTANCE * Math.sin(MOON_INCLINATION) * Math.sin(moonLongRad);
    const z = MOON_DISTANCE * Math.sin(moonLongRad);

    groupRef.current.position.set(x, y, z);

    // Report position for camera tracking
    if (positionRef) {
      positionRef.current.set(x, y, z);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh onClick={onClick}>
        <sphereGeometry args={[MOON_RADIUS, 96, 96]} />
        <primitive attach="material" object={moonMat} />
      </mesh>
    </group>
  );
}
