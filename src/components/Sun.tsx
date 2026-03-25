"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Photo-realistic Sun — positioned close enough to be visible from
   the default camera, with:
   • Animated photosphere with granulation, sunspots, faculae
   • Limb darkening (Wilson depression effect)
   • Multi-layer corona (K-corona, F-corona, wide ambient)
   • Chromosphere rim (thin red/pink edge)
   • Point light for scene illumination
   ------------------------------------------------------------------ */

const SUN_RADIUS = 10;
export const SUN_POSITION = new THREE.Vector3(120, 15, -30);

/* ---- Photosphere shader ---- */
const sunVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const sunFrag = /* glsl */ `
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  // Noise functions for solar surface detail
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
      p *= 2.15;
      a *= 0.48;
    }
    return v;
  }
  // Voronoi for granulation cells
  float voronoi(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float minDist = 1.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec2 point = vec2(hash(i + neighbor), hash((i + neighbor) * 1.73));
        float dist = length(neighbor + point - f);
        minDist = min(minDist, dist);
      }
    }
    return minDist;
  }

  void main() {
    vec2 uv = vUv * 8.0;

    // Solar granulation — convection cells (Voronoi pattern)
    float gran = voronoi(uv * 3.0 + time * 0.008);
    gran = smoothstep(0.0, 0.25, gran); // bright centers, dark edges

    // Large-scale convection (supergranulation)
    float supergran = fbm(vUv * 3.0 + time * 0.003);

    // Animated surface turbulence
    float turb1 = fbm(uv + time * 0.025);
    float turb2 = fbm(uv * 1.3 - time * 0.018 + 4.2);
    float surface = turb1 * 0.45 + turb2 * 0.3 + supergran * 0.25;

    // Sunspots — dark cool regions
    float spotNoise = fbm(vUv * 2.5 + time * 0.002);
    float spots = smoothstep(0.58, 0.7, spotNoise);
    float penumbra = smoothstep(0.52, 0.65, spotNoise) * 0.15;

    // Faculae — bright regions near spots (Wilson depression)
    float faculae = smoothstep(0.48, 0.55, spotNoise) * (1.0 - spots);

    // Solar color palette (physically-based blackbody ~5778K)
    vec3 core = vec3(1.0, 0.98, 0.92);       // Center (hottest)
    vec3 mid = vec3(1.0, 0.82, 0.45);        // Mid
    vec3 edge = vec3(0.95, 0.45, 0.12);      // Limb (cooler)

    // Limb darkening — physics-based (mu = cos(theta))
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float mu = max(dot(normalize(vNormal), V), 0.0);
    // Quadratic limb darkening coefficients for the Sun
    float limbDark = 0.3 + 0.93 * mu - 0.23 * mu * mu;

    vec3 color = mix(edge, mix(mid, core, pow(mu, 0.35)), pow(mu, 0.5));

    // Apply surface details
    color *= (0.82 + surface * 0.28 + gran * 0.12);
    color -= vec3(0.6, 0.5, 0.2) * spots * 0.5;      // Dark umbra
    color -= vec3(0.3, 0.25, 0.1) * penumbra;          // Penumbra
    color += vec3(1.0, 0.95, 0.7) * faculae * 0.15;    // Bright faculae

    // Apply limb darkening
    color *= limbDark;

    // Active regions — bright plage
    float active = fbm(uv * 2.5 + time * 0.035);
    active = smoothstep(0.62, 0.82, active) * 0.3;
    color += vec3(1.0, 0.92, 0.6) * active;

    // Final brightness (emissive)
    color *= 2.8;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ---- Chromosphere rim shader ---- */
const chromVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const chromFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - max(dot(normalize(vNormal), V), 0.0);
    // H-alpha red/pink chromosphere color
    vec3 col = mix(vec3(0.9, 0.2, 0.08), vec3(1.0, 0.4, 0.2), rim);
    float alpha = pow(rim, 3.0) * 0.6;
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Sun({ onClick }: { onClick?: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const sunMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: sunVert,
        fragmentShader: sunFrag,
      }),
    [],
  );

  const chromMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        vertexShader: chromVert,
        fragmentShader: chromFrag,
      }),
    [],
  );

  useFrame((_, dt) => {
    timeRef.current += dt;
    sunMat.uniforms.time.value = timeRef.current;
  });

  return (
    <group position={SUN_POSITION.toArray()}>
      {/* Photosphere */}
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[SUN_RADIUS, 96, 96]} />
        <primitive attach="material" object={sunMat} />
      </mesh>

      {/* Chromosphere (thin red rim) */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 1.003, 64, 64]} />
        <primitive attach="material" object={chromMat} />
      </mesh>

      {/* Inner K-corona (electron scattering — white) */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 1.12, 48, 48]} />
        <meshBasicMaterial
          color="#ffe8cc"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Mid corona */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 1.4, 48, 48]} />
        <meshBasicMaterial
          color="#ffaa55"
          transparent
          opacity={0.07}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* F-corona (dust scattering — wider, dimmer) */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 2.2, 48, 48]} />
        <meshBasicMaterial
          color="#ff8833"
          transparent
          opacity={0.025}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Wide zodiacal-light glow */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 4, 32, 32]} />
        <meshBasicMaterial
          color="#ffcc88"
          transparent
          opacity={0.008}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Scene illumination */}
      <pointLight color="#fff5e0" intensity={10} distance={1000} decay={1.5} />
    </group>
  );
}
