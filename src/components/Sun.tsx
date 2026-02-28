"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Visible Sun — glowing sphere with animated corona and lens flare.
   Position matches the scene's sunDirection (+X axis).
   ------------------------------------------------------------------ */

const SUN_RADIUS = 18;
export const SUN_POSITION = new THREE.Vector3(300, 0, 0);

/* ---- Corona / surface shader ---- */
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

  // Simple noise for animated surface
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
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.2;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv * 6.0;

    // Animated solar surface granulation
    float n1 = fbm(uv + time * 0.03);
    float n2 = fbm(uv * 1.5 - time * 0.02 + 3.7);
    float n3 = fbm(uv * 0.8 + time * 0.015 + 7.1);
    float surface = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

    // Sunspot-like dark patches
    float spots = fbm(uv * 0.4 + time * 0.005);
    spots = smoothstep(0.55, 0.65, spots) * 0.3;

    // Base solar color
    vec3 core = vec3(1.0, 0.95, 0.8);
    vec3 mid = vec3(1.0, 0.7, 0.2);
    vec3 edge = vec3(0.9, 0.3, 0.05);

    // Limb darkening
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float NdotV = max(dot(normalize(vNormal), V), 0.0);
    float limb = pow(NdotV, 0.4);

    vec3 color = mix(edge, mix(mid, core, limb), limb);
    color *= (0.85 + surface * 0.35);
    color -= spots;

    // Bright active regions
    float active = fbm(uv * 2.0 + time * 0.04);
    active = smoothstep(0.6, 0.8, active) * 0.4;
    color += vec3(1.0, 0.9, 0.5) * active;

    // Emissive — always bright
    color *= 2.5;

    gl_FragColor = vec4(color, 1.0);
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

  useFrame((_, dt) => {
    timeRef.current += dt;
    sunMat.uniforms.time.value = timeRef.current;
  });

  return (
    <group position={SUN_POSITION.toArray()}>
      {/* Core sphere */}
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <primitive attach="material" object={sunMat} />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 1.15, 48, 48]} />
        <meshBasicMaterial
          color="#ffaa33"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Mid glow */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 1.5, 48, 48]} />
        <meshBasicMaterial
          color="#ff8800"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Outer corona */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 2.5, 48, 48]} />
        <meshBasicMaterial
          color="#ff6600"
          transparent
          opacity={0.025}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Wide ambient glow */}
      <mesh>
        <sphereGeometry args={[SUN_RADIUS * 5, 32, 32]} />
        <meshBasicMaterial
          color="#ffcc66"
          transparent
          opacity={0.008}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light from sun */}
      <pointLight color="#fff5e0" intensity={8} distance={800} decay={1.5} />
    </group>
  );
}
