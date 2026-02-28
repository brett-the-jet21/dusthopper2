'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { EARTH_RADIUS_UNITS } from '@/lib/orbitMath';

/* ------------------------------------------------------------------ */
/*  GLSL – Earth surface                                              */
/* ------------------------------------------------------------------ */

const EARTH_VERT = /* glsl */ `
varying vec2  vUv;
varying vec3  vNormalW;
varying vec3  vPosW;

void main() {
  vUv = uv;
  vec4 wp  = modelMatrix * vec4(position, 1.0);
  vPosW    = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D cloudsMap;
uniform vec3      sunDir;      // normalised, world-space
uniform float     cloudDrift;  // slow horizontal offset

varying vec2  vUv;
varying vec3  vNormalW;
varying vec3  vPosW;

void main() {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(sunDir);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 H = normalize(L + V);

  float NdotL = dot(N, L);

  /* ---- sample textures ---- */
  vec3  day   = texture2D(dayMap,   vUv).rgb;
  vec3  night = texture2D(nightMap, vUv).rgb;

  vec2  cUv   = vUv;
  cUv.x       = fract(cUv.x + cloudDrift);
  float cloud = texture2D(cloudsMap, cUv).r;

  /* ---- day side: diffuse + clouds ---- */
  float diffuse = max(NdotL, 0.0);
  float ambient = 0.032;
  vec3  dayCol  = day * (diffuse * 1.1 + ambient);

  // white-ish clouds, lit by the sun
  dayCol = mix(dayCol,
               vec3(0.92, 0.93, 0.96) * (diffuse * 1.1 + ambient),
               cloud * 0.55);

  /* ---- specular on oceans ---- */
  float spec      = pow(max(dot(N, H), 0.0), 96.0);
  float lum       = dot(day, vec3(0.299, 0.587, 0.114));
  float waterMask = smoothstep(0.12, 0.30, 1.0 - lum) * (1.0 - cloud * 0.9);
  dayCol += vec3(1.0, 0.97, 0.93) * spec * waterMask * 0.55 * diffuse;

  /* ---- night side: city lights ---- */
  vec3 nightCol = night * 1.8;
  nightCol *= (1.0 - cloud * 0.35);   // dim under clouds

  /* ---- day / night blend at terminator ---- */
  float dayMix = smoothstep(-0.12, 0.20, NdotL);
  vec3  color  = mix(nightCol, dayCol, dayMix);

  /* ---- atmosphere rim glow ---- */
  float rim    = 1.0 - max(dot(N, V), 0.0);
  float rimPow = pow(rim, 3.8);

  float sunRim = smoothstep(-0.4, 0.6, NdotL);
  vec3  atmos  = mix(vec3(0.03, 0.06, 0.18),   // dark-side rim
                     vec3(0.35, 0.62, 1.0),     // sun-side rim
                     sunRim);
  color += atmos * rimPow * 0.6;

  /* ---- warm terminator glow (sunrise / sunset ring) ---- */
  float terminator = exp(-NdotL * NdotL / 0.010);
  color += vec3(0.65, 0.22, 0.04) * terminator * rim * 0.55;

  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------------------------------------------ */
/*  GLSL – outer atmosphere halo                                      */
/* ------------------------------------------------------------------ */

const ATMO_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec4 wp  = modelMatrix * vec4(position, 1.0);
  vPosW    = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 sunDir;

varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3  N    = normalize(vNormalW);
  vec3  V    = normalize(cameraPosition - vPosW);
  vec3  L    = normalize(sunDir);

  float NdotL = dot(N, L);

  // fresnel rim
  float rim    = 1.0 - max(dot(N, V), 0.0);
  float rimPow = pow(rim, 2.8);

  float sunFace = smoothstep(-0.3, 0.5, NdotL);
  vec3  col     = mix(vec3(0.015, 0.04, 0.12),
                      vec3(0.28, 0.56, 1.0),
                      sunFace);
  float alpha   = rimPow * mix(0.12, 0.7, sunFace);

  gl_FragColor = vec4(col, alpha);
}
`;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function EarthPro() {
  const driftRef = useRef(0);

  const [dayMap, nightMap, cloudsMap] = useTexture([
    '/textures/earth_day.jpg',
    '/textures/earth_night.jpg',
    '/textures/earth_clouds.png',
  ]);

  // Anisotropic filtering – sharper at grazing angles
  [dayMap, nightMap, cloudsMap].forEach((t) => {
    t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
  });

  // Cloud layer needs wrapping for the drift animation
  cloudsMap.wrapS = THREE.RepeatWrapping;

  /* ---- materials ---- */

  const earthMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          dayMap:     { value: dayMap },
          nightMap:   { value: nightMap },
          cloudsMap:  { value: cloudsMap },
          sunDir:     { value: new THREE.Vector3(1, 0, 0) },
          cloudDrift: { value: 0 },
        },
        vertexShader:   EARTH_VERT,
        fragmentShader: EARTH_FRAG,
      }),
    [dayMap, nightMap, cloudsMap],
  );

  const atmosMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite:  false,
        uniforms: {
          sunDir: { value: new THREE.Vector3(1, 0, 0) },
        },
        vertexShader:   ATMO_VERT,
        fragmentShader: ATMO_FRAG,
      }),
    [],
  );

  /* ---- per-frame update ---- */

  useFrame((_, dt) => {
    driftRef.current += dt;
    earthMat.uniforms.cloudDrift.value = driftRef.current * 0.000035;
  });

  /* ---- render ---- */

  return (
    <group>
      {/* Earth surface */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS_UNITS, 128, 128]} />
        <primitive attach="material" object={earthMat} />
      </mesh>

      {/* Outer atmosphere halo */}
      <mesh renderOrder={1}>
        <sphereGeometry args={[EARTH_RADIUS_UNITS * 1.04, 128, 128]} />
        <primitive attach="material" object={atmosMat} />
      </mesh>
    </group>
  );
}
