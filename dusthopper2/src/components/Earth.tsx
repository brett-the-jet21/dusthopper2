"use client";

import { useRef, useMemo, Suspense } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { TextureLoader } from "three";

/* ------------------------------------------------------------------
   Photorealistic Earth using NASA visible-earth textures.
   Uses Blue Marble color map + night lights + clouds.
   All textures are loaded from public NASA imagery servers.
   ------------------------------------------------------------------ */

const TEXTURES = {
  color:
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74393/world.topo.200412.3x5400x2700.jpg",
  night:
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg",
  clouds:
    "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg",
};

/* --- Custom GLSL shaders for day/night blending --- */

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
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vec3 day = texture2D(dayTexture, vUv).rgb;
    vec3 night = texture2D(nightTexture, vUv).rgb;
    float cosA = dot(vNormal, sunDirection);
    float dayF = smoothstep(-0.15, 0.25, cosA);
    // Specular glint on oceans
    float spec = pow(max(dot(reflect(-sunDirection, vNormal), normalize(-vPosition)), 0.0), 24.0) * 0.35;
    vec3 color = mix(night * 2.5, day + spec, dayF);
    // Rim light
    float rim = 1.0 - max(dot(vNormal, normalize(-vPosition)), 0.0);
    color += vec3(0.35, 0.55, 1.0) * pow(rim, 3.0) * 0.35 * dayF;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const cloudVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFrag = /* glsl */ `
  uniform sampler2D cloudTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    float c = texture2D(cloudTexture, vUv).r;
    float dayF = smoothstep(-0.1, 0.3, dot(vNormal, sunDirection));
    gl_FragColor = vec4(vec3(1.0), c * 0.50 * dayF);
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
    float cosA = dot(vNormal, sunDirection);
    float dayF = smoothstep(-0.5, 0.5, cosA);
    float rim = 1.0 - max(dot(vNormal, normalize(-vPosition)), 0.0);
    rim = pow(rim, 4.0);
    vec3 dayAtmo = vec3(0.3, 0.6, 1.0);
    vec3 sunsetAtmo = vec3(1.0, 0.4, 0.15);
    float term = pow(1.0 - abs(cosA), 3.0) * 2.0;
    vec3 ac = mix(dayAtmo, sunsetAtmo, clamp(term, 0.0, 1.0));
    gl_FragColor = vec4(ac, rim * (0.6 * dayF + 0.08));
  }
`;

/* --- Inner component that loads textures --- */

function EarthInner({ radius }: { radius: number }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const [dayTex, nightTex, cloudTex] = useLoader(TextureLoader, [
    TEXTURES.color,
    TEXTURES.night,
    TEXTURES.clouds,
  ]);

  useMemo(() => {
    [dayTex, nightTex, cloudTex].forEach((t) => {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 16;
        t.minFilter = THREE.LinearMipMapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = true;
      }
    });
  }, [dayTex, nightTex, cloudTex]);

  const sunDir = useMemo(() => new THREE.Vector3(5, 3, 5).normalize(), []);

  const earthUniforms = useMemo(
    () => ({
      dayTexture: { value: dayTex },
      nightTexture: { value: nightTex },
      sunDirection: { value: sunDir },
    }),
    [dayTex, nightTex, sunDir]
  );

  const cloudUniforms = useMemo(
    () => ({
      cloudTexture: { value: cloudTex },
      sunDirection: { value: sunDir },
    }),
    [cloudTex, sunDir]
  );

  const atmoUniforms = useMemo(
    () => ({ sunDirection: { value: sunDir } }),
    [sunDir]
  );

  useFrame((_, dt) => {
    const speed = 0.04;
    if (earthRef.current) earthRef.current.rotation.y += dt * speed;
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * speed * 1.15;
  });

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[radius, 128, 128]} />
        <shaderMaterial
          vertexShader={earthVert}
          fragmentShader={earthFrag}
          uniforms={earthUniforms}
        />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius * 1.008, 128, 128]} />
        <shaderMaterial
          vertexShader={cloudVert}
          fragmentShader={cloudFrag}
          uniforms={cloudUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.04, 128, 128]} />
        <shaderMaterial
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          uniforms={atmoUniforms}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/* --- Fallback while textures load --- */
function EarthFallback({ radius }: { radius: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial color="#0b3d91" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.04, 64, 64]} />
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

/* --- Public export wraps in Suspense --- */
export default function Earth({ radius = 1.55 }: { radius?: number }) {
  return (
    <Suspense fallback={<EarthFallback radius={radius} />}>
      <EarthInner radius={radius} />
    </Suspense>
  );
}
