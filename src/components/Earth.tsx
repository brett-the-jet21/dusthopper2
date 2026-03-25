"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Photo-realistic Earth — NASA-grade rendering with:
   • Real specular map for ocean/land distinction
   • Multi-layer Rayleigh + Mie atmospheric scattering
   • Cloud parallax, self-shadowing, and forward scattering
   • Sub-surface scattering at terminator (red/orange glow)
   • GGX ocean BRDF with Fresnel
   • Pseudo-bump mapping from albedo luminance
   • ACES filmic tonemapping
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
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vPosition = position;
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
  varying vec3 vPosition;

  /* Pseudo-bump normal from albedo gradient */
  vec3 perturbNormal(vec3 N, vec3 V, vec2 uv) {
    float eps = 0.0006;
    float hC = dot(texture2D(dayTexture, uv).rgb, vec3(0.299, 0.587, 0.114));
    float hR = dot(texture2D(dayTexture, uv + vec2(eps, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
    float hU = dot(texture2D(dayTexture, uv + vec2(0.0, eps)).rgb, vec3(0.299, 0.587, 0.114));
    float dU = hR - hC;
    float dV = hU - hC;
    vec3 surfTangentU = normalize(cross(N, vec3(0.0, 1.0, 0.0)));
    vec3 surfTangentV = normalize(cross(N, surfTangentU));
    return normalize(N + (surfTangentU * dU + surfTangentV * dV) * 2.2);
  }

  void main() {
    vec3 geoN = normalize(vWorldNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 N = perturbNormal(geoN, V, vUv);
    vec3 H = normalize(L + V);

    float NdotL = dot(N, L);
    float gNdotL = dot(geoN, L);
    float NdotH = max(dot(N, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float VdotL = max(dot(V, L), 0.0);

    /* --- Textures --- */
    vec3 day = texture2D(dayTexture, vUv).rgb;
    vec3 night = texture2D(nightTexture, vUv).rgb;
    float spec = texture2D(specTexture, vUv).r;

    /* --- Water/land mask from specular map --- */
    float waterMask = spec;
    float landMask = 1.0 - waterMask;

    /* --- Clouds with parallax and multi-sample soft edges --- */
    vec2 cUv = vUv;
    cUv.x = fract(cUv.x + cloudDrift);
    vec3 tangent = normalize(cross(geoN, vec3(0.0, 1.0, 0.0001)));
    vec3 bitangent = cross(geoN, tangent);
    float parallaxH = 0.004;
    cUv += vec2(dot(V, tangent), dot(V, bitangent)) * parallaxH;
    float cloud = texture2D(cloudsTexture, cUv).r;
    cloud = (cloud
      + texture2D(cloudsTexture, cUv + vec2(0.0008, 0.0)).r
      + texture2D(cloudsTexture, cUv + vec2(0.0, 0.0008)).r
      + texture2D(cloudsTexture, cUv - vec2(0.0008, 0.0)).r
    ) * 0.25;

    /* --- Enhanced diffuse with energy conservation --- */
    float diffuse = pow(max(NdotL, 0.0), 0.82) * 1.2 + 0.015;

    /* --- Day surface color with saturation boost --- */
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    vec3 dayBoosted = mix(vec3(lum), day, 1.2 + landMask * 0.1);
    // Deep ocean enhancement
    vec3 oceanDeep = vec3(0.01, 0.04, 0.14);
    vec3 oceanShallow = vec3(0.02, 0.1, 0.22);
    vec3 oceanColor = mix(oceanDeep, oceanShallow, smoothstep(0.0, 0.3, lum));
    dayBoosted = mix(dayBoosted, dayBoosted + oceanColor * 0.4, waterMask);
    vec3 dayCol = dayBoosted * diffuse;

    /* --- Cloud rendering: self-shadow + forward scattering --- */
    vec3 cloudLit = vec3(0.98, 0.98, 1.0) * (diffuse + 0.01);
    float cloudShadow = cloud * 0.22 * max(gNdotL, 0.0);
    dayCol *= (1.0 - cloudShadow);
    dayCol = mix(dayCol, cloudLit, cloud * 0.65);

    // Cloud edge forward scattering (silver lining)
    float cloudEdge = cloud * (1.0 - cloud) * 4.0;
    float cloudForward = pow(VdotL, 4.0);
    dayCol += vec3(1.0, 0.96, 0.88) * cloudEdge * max(gNdotL, 0.0) * 0.08;
    dayCol += vec3(1.0, 0.95, 0.85) * cloudEdge * cloudForward * 0.06;

    /* --- GGX ocean specular with proper Fresnel --- */
    float roughness = mix(0.06, 0.35, 1.0 - waterMask); // Water is smoother
    float a2 = roughness * roughness;
    float d = NdotH * NdotH * (a2 - 1.0) + 1.0;
    float dGGX = a2 / (3.14159 * d * d + 0.0001);
    float F0 = 0.02;
    float fresnel = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);
    float Gv = NdotV + sqrt(a2 + (1.0 - a2) * NdotV * NdotV);
    float Gl = max(NdotL, 0.0) + sqrt(a2 + (1.0 - a2) * max(NdotL, 0.0) * max(NdotL, 0.0));
    float G = 1.0 / (Gv * Gl + 0.0001);
    float specular = dGGX * fresnel * G * max(NdotL, 0.0) * 3.14159;
    dayCol += vec3(1.0, 0.98, 0.93) * specular * waterMask * 0.6 * (1.0 - cloud * 0.8);
    // Broad secondary ocean sheen
    float broadSpec = pow(NdotH, 16.0) * max(NdotL, 0.0);
    dayCol += vec3(0.5, 0.65, 0.85) * broadSpec * waterMask * 0.06 * (1.0 - cloud * 0.8);

    /* --- Night city lights --- */
    vec3 nightCol = night * vec3(1.3, 1.05, 0.8) * 3.0;
    nightCol *= (1.0 - cloud * 0.55);
    float nightLum = dot(night, vec3(0.299, 0.587, 0.114));
    nightCol += vec3(1.0, 0.8, 0.5) * pow(nightLum, 2.5) * 2.0;

    /* --- Day/night blend with wide atmospheric refraction terminator --- */
    float dayMix = smoothstep(-0.2, 0.26, gNdotL);
    vec3 color = mix(nightCol, dayCol, dayMix);

    /* --- Terminator glow (sub-surface scattering through atmosphere) --- */
    float rim = 1.0 - max(dot(geoN, V), 0.0);
    float terminator = exp(-gNdotL * gNdotL / 0.008);
    vec3 sunsetDeep = vec3(0.7, 0.12, 0.01);
    vec3 sunsetBright = vec3(1.0, 0.55, 0.12);
    vec3 sunsetColor = mix(sunsetDeep, sunsetBright, rim);
    color += sunsetColor * terminator * rim * 0.65;
    // Blue backscatter at high terminator angles
    color += vec3(0.05, 0.1, 0.25) * terminator * (1.0 - rim) * 0.3;

    /* --- Atmosphere rim: multi-wavelength Rayleigh --- */
    float rimPow = pow(rim, 3.2);
    float sunFacing = smoothstep(-0.35, 0.55, gNdotL);
    vec3 rayleighDay = vec3(0.3, 0.58, 1.0);
    vec3 rayleighNight = vec3(0.012, 0.03, 0.1);
    vec3 atmos = mix(rayleighNight, rayleighDay, sunFacing);
    color += atmos * rimPow * 0.65;

    /* --- Mie forward scattering (bright halo toward sun) --- */
    float mie = pow(VdotL, 14.0) * rimPow;
    color += vec3(1.0, 0.92, 0.7) * mie * 0.25;
    float mieWide = pow(VdotL, 3.0) * rimPow;
    color += vec3(0.5, 0.6, 0.8) * mieWide * 0.04;

    /* --- ACES filmic tonemapping --- */
    color = color * (2.51 * color + 0.03) / (color * (2.43 * color + 0.59) + 0.14);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* ======== ATMOSPHERE SHELL SHADER ======== */

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
    float midRim = pow(rim, 3.8);
    float outerRim = pow(rim, 7.0);

    float sunFace = smoothstep(-0.3, 0.5, NdotL);

    /* Multi-layer Rayleigh (wavelength-dependent) */
    vec3 rayleighDay = vec3(0.22, 0.50, 1.0);
    vec3 rayleighTwilight = vec3(0.5, 0.22, 0.04);
    vec3 rayleighNight = vec3(0.008, 0.02, 0.07);

    float twilight = exp(-NdotL * NdotL / 0.012);
    vec3 rayleigh = mix(rayleighNight, rayleighDay, sunFace);
    rayleigh = mix(rayleigh, rayleighTwilight, twilight * 0.65);

    /* Mie forward-scatter */
    float mieNarrow = pow(VdotL, 20.0);
    float mieMid = pow(VdotL, 6.0);
    float mieWide = pow(VdotL, 2.5);
    vec3 mie = vec3(1.0, 0.93, 0.82) * mieNarrow * 0.5
             + vec3(0.8, 0.85, 0.9) * mieMid * 0.08
             + vec3(0.5, 0.6, 0.7) * mieWide * 0.02;

    vec3 col = rayleigh + mie;

    /* Ozone absorption (subtle blue-violet at high angles) */
    float ozone = pow(rim, 4.0) * sunFace;
    col += vec3(0.1, 0.05, 0.2) * ozone * 0.08;

    /* Alpha compositing */
    float alpha = innerRim * mix(0.05, 0.55, sunFace)
                + midRim * mix(0.02, 0.3, sunFace)
                + outerRim * 0.2;
    alpha += twilight * rim * 0.35;

    gl_FragColor = vec4(col, alpha);
  }
`;

/* ======== OUTER GLOW (visible from far away) ======== */

const glowVert = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFrag = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 L = normalize(sunDirection);
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = dot(N, L);
    float sunFace = smoothstep(-0.2, 0.6, NdotL);
    float rim = 1.0 - NdotV;
    float glow = pow(rim, 5.0);
    vec3 col = mix(vec3(0.02, 0.05, 0.15), vec3(0.15, 0.35, 0.9), sunFace);
    float alpha = glow * mix(0.03, 0.15, sunFace);
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

  [dayMap, nightMap, cloudsMap, specMap].forEach((t) => {
    t.anisotropy = 16;
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
  });
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

  const outerGlowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { sunDirection: { value: sunDir } },
        vertexShader: glowVert,
        fragmentShader: glowFrag,
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
      {/* Seasonal orbit rotation → axial tilt → UTC spin */}
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          <mesh ref={earthRef} onClick={onClick}>
            <sphereGeometry args={[radius, 192, 192]} />
            <primitive attach="material" object={earthMat} />
          </mesh>
        </group>
      </group>

      {/* Inner atmosphere shell */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius * 1.015, 128, 128]} />
        <primitive attach="material" object={atmosMat} />
      </mesh>

      {/* Outer atmospheric glow (visible from distance) */}
      <mesh renderOrder={0}>
        <sphereGeometry args={[radius * 1.08, 64, 64]} />
        <primitive attach="material" object={outerGlowMat} />
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
        <sphereGeometry args={[radius * 1.015, 64, 64]} />
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
