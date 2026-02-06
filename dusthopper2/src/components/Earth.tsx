"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// super simple value-noise
function makeNoise2D(seed: number) {
  const rand = mulberry32(seed);
  const gridSize = 256;
  const grid = new Float32Array((gridSize + 1) * (gridSize + 1));
  for (let y = 0; y <= gridSize; y++) {
    for (let x = 0; x <= gridSize; x++) {
      grid[y * (gridSize + 1) + x] = rand();
    }
  }
  function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }
  function smooth(t: number) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x: number, y: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % gridSize) + gridSize) % gridSize;
    const y0 = ((yi % gridSize) + gridSize) % gridSize;
    const x1 = (x0 + 1) % gridSize;
    const y1 = (y0 + 1) % gridSize;

    const v00 = grid[y0 * (gridSize + 1) + x0];
    const v10 = grid[y0 * (gridSize + 1) + x1];
    const v01 = grid[y1 * (gridSize + 1) + x0];
    const v11 = grid[y1 * (gridSize + 1) + x1];

    const u = smooth(xf);
    const v = smooth(yf);

    const a = lerp(v00, v10, u);
    const b = lerp(v01, v11, u);
    return lerp(a, b, v);
  };
}

function makeEarthTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  const n1 = makeNoise2D(1337);
  const n2 = makeNoise2D(4242);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // equirectangular -> fake lat weighting
      const lat = (v - 0.5) * Math.PI;
      const latW = Math.cos(lat);

      // continents mask
      let c =
        0.65 * n1(u * 6.0 * 256, v * 3.2 * 256) +
        0.35 * n2(u * 14.0 * 256, v * 7.0 * 256);
      c = (c - 0.45) * 1.8; // shift/contrast
      c *= latW * 1.05;

      const isLand = c > 0.12;

      // ocean shading + subtle waves
      const wave = n2(u * 28 * 256, v * 14 * 256) * 0.08;

      let r = 0, g = 0, b = 0;

      if (!isLand) {
        // deep ocean -> lighter near equator
        const depth = 0.18 + 0.25 * (latW);
        r = 10 + depth * 20;
        g = 25 + depth * 55;
        b = 55 + depth * 140;
        b += wave * 40;
        g += wave * 20;
      } else {
        // land: deserts + greens + snow caps
        const elev = clamp01((c - 0.12) * 1.6);
        const desert = clamp01(0.55 - latW) * (0.5 + 0.5 * n1(u * 9 * 256, v * 5 * 256));
        const green = clamp01(latW * 1.1 - desert * 0.8);

        r = 40 + elev * 70 + desert * 80;
        g = 55 + elev * 85 + green * 95;
        b = 30 + elev * 35;

        // snow
        const snow = clamp01((Math.abs(lat) - 1.05) * 2.2) + clamp01((elev - 0.72) * 2.0);
        r = lerp(r, 235, snow);
        g = lerp(g, 240, snow);
        b = lerp(b, 245, snow);
      }

      // vignette-ish to add depth
      const vv = 0.92 + 0.08 * latW;
      r *= vv; g *= vv; b *= vv;

      const i = (y * size + x) * 4;
      img.data[i + 0] = clamp255(r);
      img.data[i + 1] = clamp255(g);
      img.data[i + 2] = clamp255(b);
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeCloudTexture(size = 1024) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  const n1 = makeNoise2D(777);
  const n2 = makeNoise2D(999);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      const lat = (v - 0.5) * Math.PI;
      const latW = Math.cos(lat);

      let c =
        0.7 * n1(u * 10 * 256, v * 6 * 256) +
        0.3 * n2(u * 22 * 256, v * 12 * 256);

      c = (c - 0.55) * 2.4;
      c *= latW;

      const a = clamp01(c);

      const i = (y * size + x) * 4;
      img.data[i + 0] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = clamp255(a * 180);
    }
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function clamp255(x: number) {
  return Math.max(0, Math.min(255, Math.round(x)));
}
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function Earth({ radius = 1.55 }: { radius?: number }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const atmoRef = useRef<THREE.Mesh>(null);

  const earthTex = useMemo(() => (typeof window === "undefined" ? null : makeEarthTexture(1024)), []);
  const cloudTex = useMemo(() => (typeof window === "undefined" ? null : makeCloudTexture(1024)), []);

  useFrame((_, dt) => {
    if (earthRef.current) earthRef.current.rotation.y += dt * 0.10;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.15;
    if (atmoRef.current) atmoRef.current.rotation.y += dt * 0.03;
  });

  return (
    <group>
      {/* Earth */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshStandardMaterial
          map={earthTex ?? undefined}
          roughness={0.85}
          metalness={0.02}
        />
      </mesh>

      {/* Clouds */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[radius * 1.012, 96, 96]} />
        <meshStandardMaterial
          map={cloudTex ?? undefined}
          transparent
          opacity={0.65}
          depthWrite={false}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={atmoRef}>
        <sphereGeometry args={[radius * 1.06, 96, 96]} />
        <meshBasicMaterial
          color={"#5ab0ff"}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
