"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Ultra-HD Earth — real-time UTC rotation, 23.44° axial tilt,
   seasonal variation, world-space GLSL shaders with Rayleigh
   atmosphere, GGX ocean specular, Fresnel, cloud self-shadowing.
   ------------------------------------------------------------------ */

const AXIAL_TILT = 23.44 * (Math.PI / 180);
const TWO_PI = Math.PI * 2;

/** Day of year (1-based) */
function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/* ======== EARTH SHADERS (world-space) ======== */

const earthVert = /* glsl */ `
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

const earthFrag = /* glsl */ `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform sampler2D cloudsTexture;
  uniform vec3 sunDirection;
  uniform float cloudDrift;

  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 H = normalize(L + V);
    float NdotL = dot(N, L);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    float NdotV = max(dot(N, V), 0.0);

    /* --- Textures --- */
    vec3 day = texture2D(dayTexture, vUv).rgb;
    vec3 night = texture2D(nightTexture, vUv).rgb;

    vec2 cUv = vUv;
    cUv.x = fract(cUv.x + cloudDrift);
    float cloud = texture2D(cloudsTexture, cUv).r;

    /* --- Diffuse (soft power curve) --- */
    float diffuse = pow(max(NdotL, 0.0), 0.88) * 1.15 + 0.025;

    /* --- Day surface --- */
    // Slight saturation boost on land
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    vec3 dayBoosted = mix(vec3(lum), day, 1.12);
    vec3 dayCol = dayBoosted * diffuse;

    /* --- Clouds with self-shadow --- */
    vec3 cloudLit = vec3(0.95, 0.96, 0.98) * (diffuse + 0.01);
    dayCol = mix(dayCol, cloudLit, cloud * 0.6);
    dayCol *= 1.0 - cloud * 0.12 * max(NdotL, 0.0); // subtle shadow under clouds

    /* --- GGX ocean specular + Fresnel --- */
    float roughness = 0.12;
    float a2 = roughness * roughness;
    float dGGX = a2 / (3.14159 * pow(NdotH * NdotH * (a2 - 1.0) + 1.0, 2.0) + 0.0001);
    float fresnel = 0.02 + 0.98 * pow(1.0 - VdotH, 5.0);
    float waterMask = smoothstep(0.06, 0.22, 1.0 - lum) * (1.0 - cloud * 0.95);
    float specular = dGGX * fresnel * max(NdotL, 0.0);
    dayCol += vec3(1.0, 0.98, 0.94) * specular * waterMask * 0.45;

    /* --- Night city lights (warm, cloud-dimmed) --- */
    vec3 nightCol = night * vec3(1.15, 1.0, 0.88) * 2.2;
    nightCol *= (1.0 - cloud * 0.45);

    /* --- Day/night blend (wide terminator with atmo refraction sim) --- */
    float dayMix = smoothstep(-0.15, 0.22, NdotL);
    vec3 color = mix(nightCol, dayCol, dayMix);

    /* --- Terminator warm glow (atmospheric forward-scatter) --- */
    float rim = 1.0 - NdotV;
    float terminator = exp(-NdotL * NdotL / 0.007);
    color += vec3(0.72, 0.24, 0.04) * terminator * rim * 0.5;

    /* --- Atmosphere rim — Rayleigh approximation --- */
    float rimPow = pow(rim, 3.2);
    float sunFacing = smoothstep(-0.35, 0.55, NdotL);
    vec3 rayleighDay  = vec3(0.32, 0.58, 1.0);
    vec3 rayleighNight = vec3(0.02, 0.04, 0.14);
    vec3 atmos = mix(rayleighNight, rayleighDay, sunFacing);
    color += atmos * rimPow * 0.55;

    /* --- Mie-like forward scattering (bright halo toward sun) --- */
    float mie = pow(max(dot(V, L), 0.0), 10.0) * rimPow;
    color += vec3(1.0, 0.92, 0.72) * mie * 0.18;

    /* --- Tone mapping (ACES filmic) --- */
    color = color * (2.51 * color + 0.03) / (color * (2.43 * color + 0.59) + 0.14);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ======== ATMOSPHERE SHADERS (world-space) ======== */

const atmoVert = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmoFrag = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(sunDirection);
    float NdotL = dot(N, L);
    float NdotV = max(dot(N, V), 0.0);

    float rim = 1.0 - NdotV;
    float innerRim = pow(rim, 2.2);
    float outerRim = pow(rim, 5.0);

    float sunFace = smoothstep(-0.3, 0.5, NdotL);

    /* Rayleigh blue + Mie forward-scatter white */
    vec3 rayleigh = mix(vec3(0.012, 0.035, 0.11), vec3(0.30, 0.55, 1.0), sunFace);
    float mie = pow(max(dot(V, L), 0.0), 14.0);
    vec3 col = rayleigh + vec3(1.0, 0.95, 0.85) * mie * 0.35;

    float alpha = innerRim * mix(0.08, 0.55, sunFace) + outerRim * 0.25;

    gl_FragColor = vec4(col, alpha);
  }
`;

/* ======== COMPONENTS ======== */

function EarthInner({ radius }: { radius: number }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const driftRef = useRef(0);

  const [dayMap, nightMap, cloudsMap] = useTexture([
    "/textures/earth_day.jpg",
    "/textures/earth_night.jpg",
    "/textures/earth_clouds.png",
  ]);

  [dayMap, nightMap, cloudsMap].forEach((t) => {
    t.anisotropy = 16;
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
  });
  cloudsMap.wrapS = THREE.RepeatWrapping;

  // Sun direction in world space — fixed at +X (the lit hemisphere)
  const sunDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayMap },
          nightTexture: { value: nightMap },
          cloudsTexture: { value: cloudsMap },
          sunDirection: { value: sunDir },
          cloudDrift: { value: 0 },
        },
        vertexShader: earthVert,
        fragmentShader: earthFrag,
      }),
    [dayMap, nightMap, cloudsMap, sunDir],
  );

  const atmosMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        uniforms: { sunDirection: { value: sunDir } },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
      }),
    [sunDir],
  );

  useFrame((_, dt) => {
    // Cloud drift
    driftRef.current += dt;
    earthMat.uniforms.cloudDrift.value = driftRef.current * 0.000035;

    /* ---- Real-time UTC rotation ---- */
    const now = new Date();
    const hoursUTC =
      now.getUTCHours() +
      now.getUTCMinutes() / 60 +
      now.getUTCSeconds() / 3600 +
      now.getUTCMilliseconds() / 3600000;
    const dayOfYear = getDayOfYear(now);

    // Earth rotation: at 12:00 UTC, Prime Meridian faces sun (+X).
    // Three.js SphereGeometry maps u=0.5 to +X at rotation.y = 0.
    const utcRotation = ((hoursUTC - 12) / 24) * TWO_PI;
    if (earthRef.current) {
      earthRef.current.rotation.y = utcRotation;
    }

    // Season: outer group rotates tilt direction relative to sun.
    // June 21 ≈ day 172: north pole toward sun (+X).
    const seasonAngle = ((dayOfYear - 172) / 365.25) * TWO_PI;
    if (outerGroupRef.current) {
      outerGroupRef.current.rotation.y = seasonAngle;
    }
  });

  return (
    <group>
      {/* Seasonal orbit rotation → axial tilt → UTC spin */}
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          <mesh ref={earthRef}>
            <sphereGeometry args={[radius, 192, 192]} />
            <primitive attach="material" object={earthMat} />
          </mesh>
        </group>
      </group>

      {/* Atmosphere shell — stays axis-aligned, no rotation */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius * 1.018, 128, 128]} />
        <primitive attach="material" object={atmosMat} />
      </mesh>
    </group>
  );
}

function EarthFallback({ radius }: { radius: number }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial color="#0b3d91" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.018, 64, 64]} />
        <meshBasicMaterial
          color="#5ab0ff"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function Earth({ radius = 6 }: { radius?: number }) {
  return (
    <Suspense fallback={<EarthFallback radius={radius} />}>
      <EarthInner radius={radius} />
    </Suspense>
  );
}
