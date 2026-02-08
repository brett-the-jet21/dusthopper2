'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Sphere, useTexture } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { EARTH_RADIUS_UNITS } from '@/lib/orbitMath';

export function EarthPro() {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const [dayMap, nightMap, cloudsMap] = useTexture([
    '/textures/earth_day.jpg',
    '/textures/earth_night.jpg',
    '/textures/earth_clouds.png',
  ]);

  // Make textures look correct
  dayMap.colorSpace = THREE.SRGBColorSpace;
  nightMap.colorSpace = THREE.SRGBColorSpace;
  cloudsMap.colorSpace = THREE.SRGBColorSpace;

  const earthMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: dayMap,
      emissiveMap: nightMap,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 0.55,
      roughness: 1.0,
      metalness: 0.0,
    });
  }, [dayMap, nightMap]);

  const cloudsMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: cloudsMap,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      roughness: 1.0,
      metalness: 0.0,
    });
  }, [cloudsMap]);

  const atmosphereMat = useMemo(() => {
    // Fresnel-ish rim glow shader
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        glowColor: { value: new THREE.Color('#49a7ff') },
        intensity: { value: 0.85 },
        power: { value: 2.2 },
      },
      vertexShader: `
        varying vec3 vNormalW;
        varying vec3 vViewDirW;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDirW = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float power;
        varying vec3 vNormalW;
        varying vec3 vViewDirW;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormalW, vViewDirW), 0.0), power);
          float a = fresnel * intensity;
          gl_FragColor = vec4(glowColor, a);
        }
      `,
    });
  }, []);

  useFrame((_, dt) => {
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.06;
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.09;
  });

  return (
    <group>
      <Sphere args={[EARTH_RADIUS_UNITS, 128, 128]} ref={earthRef}>
        <primitive attach="material" object={earthMat} />
      </Sphere>

      <Sphere args={[EARTH_RADIUS_UNITS * 1.01, 128, 128]} ref={cloudsRef}>
        <primitive attach="material" object={cloudsMat} />
      </Sphere>

      {/* atmosphere rim */}
      <Sphere args={[EARTH_RADIUS_UNITS * 1.045, 128, 128]}>
        <primitive attach="material" object={atmosphereMat} />
      </Sphere>
    </group>
  );
}
