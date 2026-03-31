"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Photo-realistic Moon — procedural surface with:
   • Multi-scale crater system (large basins, medium, micro)
   • Maria (dark basalt plains) vs highland terrain
   • Regolith texture detail (fine grain noise)
   • Proper lunar phase lighting from sun direction
   • Opposition surge (Heiligenschein effect)
   • Subtle color variation (warm highlands, cool maria)
   • Visible glow halo for distance identification
   ------------------------------------------------------------------ */

const MOON_RADIUS = 0.55;
const MOON_DISTANCE = 16.7;
const MOON_INCLINATION = 5.14 * (Math.PI / 180);

const moonVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  void main() {
    vUv = uv;
    vLocalPosition = position;
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
  varying vec3 vLocalPosition;

  // Noise functions
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float hash3(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
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
    for (int i = 0; i < 7; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.47;
    }
    return v;
  }
  // Voronoi for crater centers
  float voronoiDist(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = vec2(hash(i + neighbor), hash((i + neighbor) * 2.37));
        float dist = length(neighbor + point - f);
        minDist = min(minDist, dist);
      }
    }
    return minDist;
  }

  // Crater function with bowl, rim, and ejecta blanket
  float crater(vec2 p, vec2 center, float radius) {
    float d = length(p - center) / radius;
    if (d > 2.5) return 0.0;
    // Bowl depression
    float bowl = smoothstep(0.0, 0.85, d) - 1.0;
    // Flat floor
    float flatFloor = smoothstep(0.0, 0.25, d);
    // Sharp rim
    float rim = exp(-pow((d - 1.0) * 3.5, 2.0)) * 0.35;
    // Ejecta blanket (radial roughness)
    float ejecta = exp(-pow((d - 1.3) * 2.0, 2.0)) * 0.08;
    // Central peak (for larger craters)
    float peak = exp(-d * d * 20.0) * 0.15 * step(0.04, radius);
    return bowl * 0.45 * flatFloor + rim + ejecta + peak;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float NdotL = dot(N, L);
    float NdotV = max(dot(N, V), 0.0);

    vec2 uv = vUv;

    // === Maria (dark basalt plains) ===
    float maria = fbm(uv * 4.0 + 0.5);
    maria = smoothstep(0.33, 0.56, maria);

    // === Multi-scale surface detail ===
    float detail1 = fbm(uv * 25.0) * 0.22;        // Fine regolith
    float detail2 = fbm(uv * 12.0 + 3.0) * 0.15;  // Medium terrain
    float detail3 = fbm(uv * 50.0) * 0.08;         // Micro texture
    float detail = detail1 + detail2 + detail3;

    // === Multi-scale craters ===
    float craterVal = 0.0;

    // Large impact basins (named craters scale)
    craterVal += crater(uv, vec2(0.35, 0.45), 0.08);
    craterVal += crater(uv, vec2(0.58, 0.28), 0.10);
    craterVal += crater(uv, vec2(0.72, 0.58), 0.065);
    craterVal += crater(uv, vec2(0.18, 0.62), 0.085);
    craterVal += crater(uv, vec2(0.45, 0.78), 0.055);
    craterVal += crater(uv, vec2(0.82, 0.38), 0.045);
    craterVal += crater(uv, vec2(0.15, 0.28), 0.065);
    craterVal += crater(uv, vec2(0.62, 0.72), 0.075);
    craterVal += crater(uv, vec2(0.90, 0.15), 0.05);
    craterVal += crater(uv, vec2(0.28, 0.88), 0.06);

    // Medium craters (procedural)
    for (int i = 0; i < 16; i++) {
      vec2 pos = vec2(hash(vec2(float(i), 0.0)), hash(vec2(0.0, float(i))));
      float r = 0.018 + hash(vec2(float(i), float(i))) * 0.03;
      craterVal += crater(uv, pos, r);
    }

    // Small craters (high frequency)
    float smallCraters = voronoiDist(uv * 40.0);
    smallCraters = 1.0 - smoothstep(0.0, 0.12, smallCraters);
    craterVal -= smallCraters * 0.08;

    // Micro craters (finest detail)
    float microCraters = voronoiDist(uv * 80.0);
    microCraters = 1.0 - smoothstep(0.0, 0.08, microCraters);
    craterVal -= microCraters * 0.03;

    // === Color palette ===
    // Highland: warm grey-tan (anorthosite)
    vec3 highlandColor = vec3(0.58, 0.56, 0.52);
    vec3 highlandWarm = vec3(0.64, 0.60, 0.54);
    float colorVar = fbm(uv * 6.0 + 7.3);
    vec3 highland = mix(highlandColor, highlandWarm, colorVar);

    // Maria: dark grey-blue (basalt)
    vec3 mariaColor = vec3(0.22, 0.21, 0.20);
    vec3 mariaCool = vec3(0.18, 0.19, 0.22);
    vec3 mariaFinal = mix(mariaColor, mariaCool, fbm(uv * 5.0 + 2.1));

    vec3 baseColor = mix(highland, mariaFinal, maria);

    // Apply surface detail and craters
    baseColor *= (1.0 + detail * 0.5 + craterVal * 0.55);

    // === Lighting ===
    // Oren-Nayar style diffuse for rough surface
    float roughness2 = 0.8;
    float A = 1.0 - 0.5 * roughness2 / (roughness2 + 0.33);
    float B = 0.45 * roughness2 / (roughness2 + 0.09);
    float thetaI = acos(max(NdotL, 0.0));
    float thetaR = acos(NdotV);
    float alpha = max(thetaI, thetaR);
    float beta = min(thetaI, thetaR);
    float diffuse = max(NdotL, 0.0) * (A + B * max(0.0, cos(thetaI - thetaR)) * sin(alpha) * tan(beta));
    diffuse = diffuse * 1.15 + 0.005;

    // Day/night boundary
    float dayMix = smoothstep(-0.02, 0.06, NdotL);
    vec3 dayCol = baseColor * diffuse;

    // === Opposition surge (Heiligenschein / shadow-hiding) ===
    float VdotL = dot(V, L);
    float phase = acos(clamp(VdotL, -1.0, 1.0));
    float surge = exp(-phase * phase / 0.12) * 0.18;
    dayCol += baseColor * surge;

    // === Subtle limb darkening ===
    float limbDark = pow(NdotV, 0.12);
    dayCol *= limbDark;

    vec3 color = dayCol * dayMix;

    // === Earthshine (faint illumination on night side) ===
    vec3 earthshine = baseColor * 0.015 * (1.0 - dayMix);
    color += earthshine;

    // === Very subtle terminator reddening ===
    float terminator = exp(-NdotL * NdotL / 0.003);
    color += vec3(0.02, 0.008, 0.003) * terminator;

    gl_FragColor = vec4(color, 1.0);
  }
`;

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
    if (positionRef) positionRef.current.set(x, y, z);
  });

  return (
    <group ref={groupRef}>
      <mesh onClick={onClick}>
        <sphereGeometry args={[MOON_RADIUS, 128, 128]} />
        <primitive attach="material" object={moonMat} />
      </mesh>
      {/* Subtle glow for visibility at distance */}
      <mesh>
        <sphereGeometry args={[MOON_RADIUS * 1.8, 32, 32]} />
        <meshBasicMaterial
          color="#aabbcc"
          transparent
          opacity={0.035}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
