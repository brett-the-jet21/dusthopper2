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

  /* Pseudo-bump: perturb normal from luminance gradient */
  vec3 perturbNormal(vec3 N, vec3 V, vec2 uv) {
    float eps = 0.0008;
    float hC = dot(texture2D(dayTexture, uv).rgb, vec3(0.299,0.587,0.114));
    float hR = dot(texture2D(dayTexture, uv + vec2(eps, 0.0)).rgb, vec3(0.299,0.587,0.114));
    float hU = dot(texture2D(dayTexture, uv + vec2(0.0, eps)).rgb, vec3(0.299,0.587,0.114));
    float dU = hR - hC;
    float dV = hU - hC;
    vec3 surfTangentU = normalize(cross(N, vec3(0.0, 1.0, 0.0)));
    vec3 surfTangentV = normalize(cross(N, surfTangentU));
    float bumpStrength = 1.8;
    vec3 perturbed = normalize(N + (surfTangentU * dU + surfTangentV * dV) * bumpStrength);
    return perturbed;
  }

  void main() {
    vec3 geoN = normalize(vWorldNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);

    /* --- Pseudo-bump normal --- */
    vec3 N = perturbNormal(geoN, V, vUv);

    vec3 H = normalize(L + V);
    float NdotL = dot(N, L);
    float gNdotL = dot(geoN, L); // geometric for terminator
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    float NdotV = max(dot(N, V), 0.0);

    /* --- Textures --- */
    vec3 day = texture2D(dayTexture, vUv).rgb;
    vec3 night = texture2D(nightTexture, vUv).rgb;

    /* --- Clouds with parallax offset --- */
    vec2 cUv = vUv;
    cUv.x = fract(cUv.x + cloudDrift);
    // Parallax: offset clouds slightly based on view angle (simulates altitude)
    vec3 tangent = normalize(cross(geoN, vec3(0.0, 1.0, 0.0001)));
    vec3 bitangent = cross(geoN, tangent);
    float parallaxH = 0.003; // cloud altitude offset
    cUv += vec2(dot(V, tangent), dot(V, bitangent)) * parallaxH;
    float cloud = texture2D(cloudsTexture, cUv).r;
    // Multi-sample for softer cloud edges
    float cloud2 = texture2D(cloudsTexture, cUv + vec2(0.001, 0.0)).r;
    float cloud3 = texture2D(cloudsTexture, cUv + vec2(0.0, 0.001)).r;
    cloud = (cloud + cloud2 + cloud3) / 3.0;

    /* --- Surface luminance & masks --- */
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    float waterMask = smoothstep(0.06, 0.20, 1.0 - lum) * (1.0 - cloud * 0.95);
    float landMask = 1.0 - waterMask;

    /* --- Diffuse (soft power curve) --- */
    float diffuse = pow(max(NdotL, 0.0), 0.85) * 1.18 + 0.02;

    /* --- Day surface with color enhancement --- */
    // Boost saturation on land, deepen ocean blues
    vec3 dayBoosted = mix(vec3(lum), day, 1.15 + landMask * 0.08);
    // Deepen ocean color
    vec3 oceanTint = vec3(0.04, 0.12, 0.28);
    dayBoosted = mix(dayBoosted, dayBoosted + oceanTint * 0.3, waterMask);
    vec3 dayCol = dayBoosted * diffuse;

    /* --- Clouds with self-shadow + volumetric approximation --- */
    vec3 cloudLit = vec3(0.96, 0.97, 0.99) * (diffuse + 0.015);
    // Cloud shadow: darken surface underneath clouds proportional to sun angle
    float cloudShadow = cloud * 0.18 * max(gNdotL, 0.0);
    dayCol *= (1.0 - cloudShadow);
    // Blend cloud on top
    dayCol = mix(dayCol, cloudLit, cloud * 0.62);
    // Cloud edge glow (forward scattering through clouds)
    float cloudEdge = cloud * (1.0 - cloud) * 4.0; // peaks at cloud = 0.5
    dayCol += vec3(1.0, 0.95, 0.85) * cloudEdge * max(gNdotL, 0.0) * 0.06;

    /* --- GGX ocean specular + Fresnel --- */
    float roughness = 0.08;
    float a2 = roughness * roughness;
    float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
    float dGGX = a2 / (3.14159 * d * d + 0.0001);
    float fresnel = 0.02 + 0.98 * pow(1.0 - VdotH, 5.0);
    float spec = dGGX * fresnel * max(NdotL, 0.0);
    dayCol += vec3(1.0, 0.98, 0.93) * spec * waterMask * 0.5;
    // Secondary broad specular for ocean sheen
    float broadSpec = pow(NdotH, 12.0) * max(NdotL, 0.0);
    dayCol += vec3(0.6, 0.75, 0.9) * broadSpec * waterMask * 0.08;

    /* --- Night city lights (warm, cloud-dimmed, with glow) --- */
    vec3 nightCol = night * vec3(1.2, 1.0, 0.82) * 2.5;
    nightCol *= (1.0 - cloud * 0.5);
    // Subtle city light bloom
    float nightLum = dot(night, vec3(0.299, 0.587, 0.114));
    nightCol += vec3(1.0, 0.85, 0.6) * pow(nightLum, 2.0) * 1.5;

    /* --- Day/night blend (atmospheric refraction widens terminator) --- */
    float dayMix = smoothstep(-0.18, 0.24, gNdotL);
    vec3 color = mix(nightCol, dayCol, dayMix);

    /* --- Terminator glow (red/orange sunrise/sunset band) --- */
    float rim = 1.0 - max(dot(geoN, V), 0.0);
    float terminator = exp(-gNdotL * gNdotL / 0.006);
    vec3 sunsetColor = mix(vec3(0.8, 0.2, 0.02), vec3(0.9, 0.5, 0.1), rim);
    color += sunsetColor * terminator * rim * 0.55;

    /* --- Atmosphere rim — multi-wavelength Rayleigh --- */
    float rimPow = pow(rim, 3.0);
    float sunFacing = smoothstep(-0.35, 0.55, gNdotL);
    // Wavelength-dependent scattering (blue > green > red)
    vec3 rayleighDay = vec3(0.28, 0.55, 1.0);
    vec3 rayleighNight = vec3(0.015, 0.035, 0.12);
    vec3 atmos = mix(rayleighNight, rayleighDay, sunFacing);
    color += atmos * rimPow * 0.6;

    /* --- Mie forward scattering (white halo when looking toward sun) --- */
    float VdotL = max(dot(V, L), 0.0);
    float mie = pow(VdotL, 12.0) * rimPow;
    color += vec3(1.0, 0.92, 0.7) * mie * 0.22;
    // Secondary wide mie
    float mieWide = pow(VdotL, 3.0) * rimPow;
    color += vec3(0.5, 0.6, 0.8) * mieWide * 0.04;

    /* --- ACES filmic tone mapping --- */
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
    float VdotL = max(dot(V, L), 0.0);

    float rim = 1.0 - NdotV;
    float innerRim = pow(rim, 2.0);
    float midRim = pow(rim, 3.5);
    float outerRim = pow(rim, 6.0);

    float sunFace = smoothstep(-0.3, 0.5, NdotL);

    /* Multi-wavelength Rayleigh (blue dominates) */
    vec3 rayleighDay = vec3(0.25, 0.52, 1.0);
    vec3 rayleighTwilight = vec3(0.4, 0.2, 0.05);
    vec3 rayleighNight = vec3(0.01, 0.025, 0.08);

    float twilight = exp(-NdotL * NdotL / 0.015); // narrow band at terminator
    vec3 rayleigh = mix(rayleighNight, rayleighDay, sunFace);
    rayleigh = mix(rayleigh, rayleighTwilight, twilight * 0.6);

    /* Mie forward-scatter (bright white/yellow halo) */
    float mieNarrow = pow(VdotL, 16.0);
    float mieWide = pow(VdotL, 4.0);
    vec3 mie = vec3(1.0, 0.93, 0.82) * mieNarrow * 0.4
             + vec3(0.6, 0.7, 0.85) * mieWide * 0.06;

    vec3 col = rayleigh + mie;

    /* Alpha: thicker on sun side, thin glow on night side */
    float alpha = innerRim * mix(0.06, 0.5, sunFace)
                + midRim * mix(0.02, 0.25, sunFace)
                + outerRim * 0.15;

    /* Sunset glow at terminator on atmosphere edge */
    alpha += twilight * rim * 0.3;

    gl_FragColor = vec4(col, alpha);
  }
`;

/* ======== COMPONENTS ======== */

function EarthInner({ radius, onClick }: { radius: number; onClick?: () => void }) {
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

    // Season: outer group rotates tilt direction relative to sun.
    // June 21 ≈ day 172: north pole tilts toward sun (+X).
    const seasonAngle = ((dayOfYear - 172) / 365.25) * TWO_PI;
    if (outerGroupRef.current) {
      outerGroupRef.current.rotation.y = seasonAngle;
    }

    // Earth rotation: at 12:00 UTC, Prime Meridian faces sun (+X).
    // Three.js SphereGeometry maps u=0.5 to +X at rotation.y = 0.
    // Subtract seasonAngle to compensate — the outer group's Y rotation
    // would otherwise shift the surface longitude away from the sun.
    const utcRotation = ((hoursUTC - 12) / 24) * TWO_PI - seasonAngle;
    if (earthRef.current) {
      earthRef.current.rotation.y = utcRotation;
    }
  });

  return (
    <group>
      {/* Seasonal orbit rotation → axial tilt → UTC spin */}
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          <mesh ref={earthRef} onClick={onClick}>
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

export default function Earth({ radius = 6, onClick }: { radius?: number; onClick?: () => void }) {
  return (
    <Suspense fallback={<EarthFallback radius={radius} />}>
      <EarthInner radius={radius} onClick={onClick} />
    </Suspense>
  );
}
