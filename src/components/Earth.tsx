"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Photorealistic Earth — loads LOCAL textures from /public/textures/
   Custom GLSL shaders for day/night blending, clouds, atmosphere.
   ------------------------------------------------------------------ */

const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
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
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(-vPosition);
    float NdotL = dot(N, L);

    vec3 day = texture2D(dayTexture, vUv).rgb;
    vec3 night = texture2D(nightTexture, vUv).rgb;

    vec2 cUv = vUv;
    cUv.x = fract(cUv.x + cloudDrift);
    float cloud = texture2D(cloudsTexture, cUv).r;

    // Day side: diffuse + clouds
    float diffuse = max(NdotL, 0.0);
    vec3 dayCol = day * (diffuse * 1.1 + 0.03);
    dayCol = mix(dayCol, vec3(0.92, 0.93, 0.96) * (diffuse * 1.1 + 0.03), cloud * 0.55);

    // Specular on oceans
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 96.0);
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    float waterMask = smoothstep(0.12, 0.30, 1.0 - lum) * (1.0 - cloud * 0.9);
    dayCol += vec3(1.0, 0.97, 0.93) * spec * waterMask * 0.55 * diffuse;

    // Night: city lights
    vec3 nightCol = night * 1.8 * (1.0 - cloud * 0.35);

    // Day/night blend at terminator
    float dayMix = smoothstep(-0.12, 0.20, NdotL);
    vec3 color = mix(nightCol, dayCol, dayMix);

    // Atmosphere rim — NEON TRACER glow
    float rim = 1.0 - max(dot(N, V), 0.0);
    float rimPow = pow(rim, 3.8);
    float sunRim = smoothstep(-0.4, 0.6, NdotL);
    vec3 atmos = mix(vec3(0.03, 0.06, 0.18), vec3(0.35, 0.62, 1.0), sunRim);
    color += atmos * rimPow * 0.6;

    // Warm terminator glow
    float terminator = exp(-NdotL * NdotL / 0.010);
    color += vec3(0.65, 0.22, 0.04) * terminator * rim * 0.55;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmoFrag = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(-vPosition);
    vec3 L = normalize(sunDirection);
    float NdotL = dot(N, L);
    float rim = 1.0 - max(dot(N, V), 0.0);
    rim = pow(rim, 2.8);
    float sunFace = smoothstep(-0.3, 0.5, NdotL);
    vec3 col = mix(vec3(0.015, 0.04, 0.12), vec3(0.28, 0.56, 1.0), sunFace);
    float alpha = rim * mix(0.12, 0.7, sunFace);
    gl_FragColor = vec4(col, alpha);
  }
`;

function EarthInner({ radius }: { radius: number }) {
  const driftRef = useRef(0);
  const earthRef = useRef<THREE.Mesh>(null);

  const [dayMap, nightMap, cloudsMap] = useTexture([
    "/textures/earth_day.jpg",
    "/textures/earth_night.jpg",
    "/textures/earth_clouds.png",
  ]);

  [dayMap, nightMap, cloudsMap].forEach((t) => {
    t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
  });
  cloudsMap.wrapS = THREE.RepeatWrapping;

  const sunDir = useMemo(() => new THREE.Vector3(5, 3, 5).normalize(), []);

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
    [dayMap, nightMap, cloudsMap, sunDir]
  );

  const atmosMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { sunDirection: { value: sunDir } },
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
      }),
    [sunDir]
  );

  useFrame((_, dt) => {
    driftRef.current += dt;
    earthMat.uniforms.cloudDrift.value = driftRef.current * 0.000035;
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.02;
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[radius, 128, 128]} />
        <primitive attach="material" object={earthMat} />
      </mesh>
      {/* Atmosphere shell — neon glow */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[radius * 1.025, 128, 128]} />
        <primitive attach="material" object={atmosMat} />
      </mesh>
    </group>
  );
}

function EarthFallback({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial color="#0b3d91" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.025, 64, 64]} />
        <meshBasicMaterial
          color="#5ab0ff"
          transparent
          opacity={0.15}
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
