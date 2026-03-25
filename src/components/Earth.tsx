"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Realistic Earth — designed to look like a real NASA photograph.

   Key insight: let the textures do the work. Don't over-process.
   The day texture is 4096x2048 — high quality. The cloud map is
   only 1024x512 indexed PNG, so we blur it heavily and keep it
   very transparent to avoid blocky artifacts.
   ------------------------------------------------------------------ */

const AXIAL_TILT = 23.44 * (Math.PI / 180);
const TWO_PI = Math.PI * 2;

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/* ======== EARTH SURFACE SHADER ======== */

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
  uniform sampler2D specTexture;
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
    float NdotV = max(dot(N, V), 0.0);
    float VdotH = max(dot(V, H), 0.0);

    /* --- Read textures --- */
    vec3 dayRaw = texture2D(dayTexture, vUv).rgb;
    vec3 nightRaw = texture2D(nightTexture, vUv).rgb;
    float specMask = texture2D(specTexture, vUv).r; // 1 = water, 0 = land

    /* --- Clouds: heavy blur to hide low-res artifacts --- */
    vec2 cUv = vUv;
    cUv.x = fract(cUv.x + cloudDrift);
    // 9-tap gaussian blur to smooth the 1024x512 indexed-color cloud map
    float texel = 1.0 / 1024.0;
    float cloud = 0.0;
    cloud += texture2D(cloudsTexture, cUv).r * 0.25;
    cloud += texture2D(cloudsTexture, cUv + vec2(texel, 0.0)).r * 0.125;
    cloud += texture2D(cloudsTexture, cUv - vec2(texel, 0.0)).r * 0.125;
    cloud += texture2D(cloudsTexture, cUv + vec2(0.0, texel)).r * 0.125;
    cloud += texture2D(cloudsTexture, cUv - vec2(0.0, texel)).r * 0.125;
    cloud += texture2D(cloudsTexture, cUv + vec2(texel, texel)).r * 0.0625;
    cloud += texture2D(cloudsTexture, cUv - vec2(texel, texel)).r * 0.0625;
    cloud += texture2D(cloudsTexture, cUv + vec2(texel, -texel)).r * 0.0625;
    cloud += texture2D(cloudsTexture, cUv + vec2(-texel, texel)).r * 0.0625;
    // Second pass blur (wider kernel)
    float cloud2 = 0.0;
    float texel2 = 3.0 / 1024.0;
    cloud2 += texture2D(cloudsTexture, cUv + vec2(texel2, 0.0)).r;
    cloud2 += texture2D(cloudsTexture, cUv - vec2(texel2, 0.0)).r;
    cloud2 += texture2D(cloudsTexture, cUv + vec2(0.0, texel2)).r;
    cloud2 += texture2D(cloudsTexture, cUv - vec2(0.0, texel2)).r;
    cloud2 *= 0.25;
    cloud = mix(cloud, cloud2, 0.3);
    // Soften edges with power curve — reduces harsh transitions
    cloud = smoothstep(0.15, 0.7, cloud);

    /* --- Simple, clean diffuse lighting --- */
    float diffuse = max(NdotL, 0.0);
    // Slight softening at terminator (atmospheric refraction)
    float softDiffuse = smoothstep(-0.05, 0.4, NdotL);

    /* --- Day surface: let the NASA texture speak for itself --- */
    vec3 dayCol = dayRaw * softDiffuse;

    /* --- Subtle ocean specular (only on water, only on day side) --- */
    float oceanSpec = pow(NdotH, 80.0) * diffuse * specMask;
    float oceanFresnel = 0.02 + 0.98 * pow(1.0 - VdotH, 5.0);
    dayCol += vec3(1.0, 0.97, 0.9) * oceanSpec * oceanFresnel * 0.4 * (1.0 - cloud);

    /* --- Clouds: thin, translucent, realistically lit --- */
    float cloudBrightness = softDiffuse * 0.95 + 0.05;
    vec3 cloudColor = vec3(cloudBrightness);
    // Thin cloud shadow on surface below
    dayCol *= (1.0 - cloud * 0.15 * softDiffuse);
    // Overlay clouds — keep them translucent (max ~40% opacity)
    dayCol = mix(dayCol, cloudColor, cloud * 0.4);

    /* --- Night: city lights (warm, gentle) --- */
    vec3 nightCol = nightRaw * vec3(1.1, 0.95, 0.75) * 1.8;
    nightCol *= (1.0 - cloud * 0.4); // Clouds dim city lights

    /* --- Day/night blend --- */
    float dayMix = smoothstep(-0.15, 0.2, NdotL);
    vec3 color = mix(nightCol, dayCol, dayMix);

    /* --- Terminator glow (very subtle warm band at sunrise/sunset) --- */
    float terminator = exp(-NdotL * NdotL / 0.005);
    float rim = 1.0 - NdotV;
    color += vec3(0.4, 0.12, 0.02) * terminator * rim * 0.2;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ======== ATMOSPHERE SHELL — very thin, subtle blue rim ======== */

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
    float sunFace = smoothstep(-0.2, 0.5, NdotL);

    // Thin blue atmosphere — like real NASA photos
    vec3 dayColor = vec3(0.35, 0.6, 1.0);
    vec3 nightColor = vec3(0.02, 0.04, 0.1);
    vec3 twilightColor = vec3(0.6, 0.25, 0.05);

    float twilight = exp(-NdotL * NdotL / 0.008);

    vec3 col = mix(nightColor, dayColor, sunFace);
    col = mix(col, twilightColor, twilight * 0.4);

    // Mie forward scattering (subtle bright spot toward sun)
    float mie = pow(VdotL, 16.0) * pow(rim, 2.0);
    col += vec3(1.0, 0.9, 0.75) * mie * 0.15;

    // Alpha: very thin line at the edge, not a thick haze
    // Key: use high power for rim to keep it TIGHT against the edge
    float alpha = pow(rim, 4.5) * mix(0.08, 0.45, sunFace)
                + pow(rim, 8.0) * 0.3
                + twilight * pow(rim, 3.0) * 0.15;

    gl_FragColor = vec4(col, alpha);
  }
`;

/* ======== COMPONENTS ======== */

function EarthInner({ radius, onClick }: { radius: number; onClick?: () => void }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const driftRef = useRef(0);

  const [dayMap, nightMap, cloudsMap, specMap] = useTexture([
    "/textures/earth_day.jpg",
    "/textures/earth_night.jpg",
    "/textures/earth_clouds.png",
    "/textures/earth_specular.jpg",
  ]);

  // Day + night + spec are color textures → SRGB
  [dayMap, nightMap, specMap].forEach((t) => {
    t.anisotropy = 16;
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
  });

  // Cloud map is a grayscale mask from a low-res indexed PNG
  // Use LinearColorSpace (don't gamma-correct it) and LINEAR filtering
  cloudsMap.colorSpace = THREE.LinearSRGBColorSpace;
  cloudsMap.minFilter = THREE.LinearMipmapLinearFilter;
  cloudsMap.magFilter = THREE.LinearFilter;
  cloudsMap.generateMipmaps = true;
  cloudsMap.anisotropy = 16;
  cloudsMap.wrapS = THREE.RepeatWrapping;

  const sunDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayMap },
          nightTexture: { value: nightMap },
          cloudsTexture: { value: cloudsMap },
          specTexture: { value: specMap },
          sunDirection: { value: sunDir },
          cloudDrift: { value: 0 },
        },
        vertexShader: earthVert,
        fragmentShader: earthFrag,
      }),
    [dayMap, nightMap, cloudsMap, specMap, sunDir],
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
    driftRef.current += dt;
    earthMat.uniforms.cloudDrift.value = driftRef.current * 0.000035;

    const now = new Date();
    const hoursUTC =
      now.getUTCHours() +
      now.getUTCMinutes() / 60 +
      now.getUTCSeconds() / 3600 +
      now.getUTCMilliseconds() / 3600000;
    const dayOfYear = getDayOfYear(now);

    const seasonAngle = ((dayOfYear - 172) / 365.25) * TWO_PI;
    if (outerGroupRef.current) {
      outerGroupRef.current.rotation.y = seasonAngle;
    }

    const utcRotation = ((hoursUTC - 12) / 24) * TWO_PI - seasonAngle;
    if (earthRef.current) {
      earthRef.current.rotation.y = utcRotation;
    }
  });

  return (
    <group>
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          <mesh ref={earthRef} onClick={onClick}>
            <sphereGeometry args={[radius, 192, 192]} />
            <primitive attach="material" object={earthMat} />
          </mesh>
        </group>
      </group>

      {/* Atmosphere — very thin shell, tight to surface */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius * 1.012, 128, 128]} />
        <primitive attach="material" object={atmosMat} />
      </mesh>
    </group>
  );
}

function EarthFallback({ radius }: { radius: number }) {
  return (
    <mesh>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshStandardMaterial color="#0b3d91" roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

export default function Earth({ radius = 6, onClick }: { radius?: number; onClick?: () => void }) {
  return (
    <Suspense fallback={<EarthFallback radius={radius} />}>
      <EarthInner radius={radius} onClick={onClick} />
    </Suspense>
  );
}
