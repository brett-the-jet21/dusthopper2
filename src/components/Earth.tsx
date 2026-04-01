"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ===================================================================
   Procedural Earth — pure GLSL, no CDN textures, always renders
   ● Surface: fbm continents + ocean + ice caps + city lights
   ● Clouds:  animated fbm cloud layer
   ● Atmosphere: BackSide rim glow
   =================================================================== */

const AXIAL_TILT = 23.44 * (Math.PI / 180);

function getDayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

/* KSC: 28.5729°N, 80.6490°W */
const KSC_LAT = 28.5729 * (Math.PI / 180);
const KSC_LON = -80.649 * (Math.PI / 180);

function KSCMarker({ radius }: { radius: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const r = radius * 1.008;
  const baseX = r * Math.cos(KSC_LAT) * Math.sin(KSC_LON);
  const baseY = r * Math.sin(KSC_LAT);
  const baseZ = r * Math.cos(KSC_LAT) * Math.cos(KSC_LON);

  useFrame((state) => {
    if (!meshRef.current) return;
    const now = new Date();
    const hoursUTC = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const doy = getDayOfYear(now);
    const seasonAngle = ((doy - 172) / 365.25) * Math.PI * 2;
    const utcRot = ((hoursUTC - 12) / 24) * Math.PI * 2 - seasonAngle;
    const cosU = Math.cos(utcRot), sinU = Math.sin(utcRot);
    meshRef.current.position.set(
      baseX * cosU + baseZ * sinU,
      baseY,
      -baseX * sinU + baseZ * cosU,
    );
    meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.35);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.022, 8, 8]} />
      <meshBasicMaterial color="#FF8800" />
    </mesh>
  );
}

/* ── Shared vertex shader ───────────────────────────────────────── */
const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vWorldNormal   = normalize(mat3(modelMatrix) * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position    = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ── Earth surface fragment shader ─────────────────────────────── */
const earthFrag = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5;
    for(int i=0;i<6;i++){v+=a*noise(p);p*=2.1;a*=0.5;}
    return v;
  }

  void main(){
    // Sun direction matches scene directionalLight at [80,10,0]
    vec3 SUN = normalize(vec3(0.992, 0.124, 0.0));
    vec3 N   = normalize(vWorldNormal);
    float NdotL  = dot(N, SUN);
    float dayMix = smoothstep(-0.08, 0.14, NdotL);
    float diff   = max(NdotL, 0.0) * 0.92 + 0.04;

    // Land/ocean mask via fbm
    float land = fbm(vUv * 3.6 + vec2(1.73, 2.41));
    land = smoothstep(0.43, 0.54, land);
    float islands = fbm(vUv * 7.4 + vec2(4.1, 3.7));
    land = clamp(land + smoothstep(0.51, 0.57, islands) * 0.35, 0.0, 1.0);

    // Latitude-based ice caps (vUv.y: 0=south, 1=north)
    float ice = clamp(
      smoothstep(0.81, 0.97, vUv.y) + smoothstep(0.19, 0.03, vUv.y),
      0.0, 1.0);

    // Ocean
    float on = fbm(vUv * 5.8 + vec2(2.2, 0.9));
    vec3 ocean = mix(
      mix(vec3(0.01,0.04,0.16), vec3(0.02,0.09,0.30), on),
      vec3(0.04,0.16,0.42), on * 0.5);

    // Ocean specular
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float spec = pow(max(dot(reflect(-SUN, N), V), 0.0), 42.0)
                 * 0.75 * max(NdotL, 0.0);

    // Land terrain
    float d1 = fbm(vUv * 9.5  + vec2(3.1, 1.4));
    float d2 = fbm(vUv * 21.0 + vec2(6.7, 4.2));
    vec3 landCol = mix(
      mix(vec3(0.04,0.12,0.03), vec3(0.11,0.18,0.05), d1),
      mix(vec3(0.27,0.19,0.08), vec3(0.18,0.14,0.11), d2), d1 * 0.55);

    // Mountain snow
    float mtn = fbm(vUv * 13.0 + vec2(8.3, 2.1));
    landCol = mix(landCol, vec3(0.84,0.88,0.93),
                  smoothstep(0.59, 0.67, mtn) * (1.0-ice) * land * 0.65);

    // Ice
    vec3 surface = mix(ocean, landCol, land);
    surface = mix(surface, vec3(0.78,0.86,0.96), ice);

    // Day lighting + ocean glint
    vec3 day = surface * diff;
    day += vec3(0.18, 0.40, 0.88) * spec * (1.0-land) * (1.0-ice);

    // Night city lights
    float cities = pow(max(
      fbm(vUv * 17.0 + vec2(4.4, 7.2)) *
      fbm(vUv *  7.0 + vec2(1.1, 5.5)), 0.0), 2.1)
      * land * (1.0-ice) * 0.85;
    vec3 night = surface * 0.011
               + vec3(1.0, 0.87, 0.62) * cities;

    gl_FragColor = vec4(mix(night, day, dayMix), 1.0);
  }
`;

/* ── Cloud fragment shader ──────────────────────────────────────── */
const cloudFrag = /* glsl */ `
  uniform float time;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5;
    for(int i=0;i<5;i++){v+=a*noise(p);p*=2.1;a*=0.5;}
    return v;
  }

  void main(){
    vec3 SUN = normalize(vec3(0.992, 0.124, 0.0));
    vec3 N   = normalize(vWorldNormal);
    float NdotL  = max(dot(N, SUN), 0.0);
    float dayMix = smoothstep(-0.10, 0.12, dot(N, SUN));

    // Slow time drift for additional cloud movement beyond mesh rotation
    vec2 uv = vUv + vec2(time * 0.00022, 0.0);
    float c = fbm(uv * 4.3 + vec2(1.5, 0.8))
            + fbm(uv * 8.8 + vec2(3.2, 2.1)) * 0.32;
    float mask = smoothstep(0.43, 0.60, c);

    float lit = NdotL * 0.78 + 0.22;
    vec3 col  = mix(vec3(0.52,0.57,0.65), vec3(0.90,0.93,0.97), smoothstep(0.43,0.60,c)) * lit;
    col = mix(col * 0.04, col, dayMix);

    gl_FragColor = vec4(col, mask * 0.60);
  }
`;

/* ── Earth component ────────────────────────────────────────────── */
export default function Earth({
  radius = 2,
  onClick,
  showKSC = false,
}: {
  radius?: number;
  onClick?: () => void;
  showKSC?: boolean;
}) {
  const earthRef      = useRef<THREE.Mesh>(null);
  const cloudsRef     = useRef<THREE.Mesh>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const cloudDrift    = useRef(0);

  const earthMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   vert,
    fragmentShader: earthFrag,
  }), []);

  const cloudMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms:       { time: { value: 0 } },
    vertexShader:   vert,
    fragmentShader: cloudFrag,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.NormalBlending,
  }), []);

  const emissiveColor = useMemo(() => new THREE.Color("#1a44ee"), []);

  useFrame((state, dt) => {
    cloudMat.uniforms.time.value = state.clock.elapsedTime;
    cloudDrift.current += dt * 0.00018;

    const now         = new Date();
    const hoursUTC    = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const doy         = getDayOfYear(now);
    const seasonAngle = ((doy - 172) / 365.25) * Math.PI * 2;

    if (outerGroupRef.current) outerGroupRef.current.rotation.y = seasonAngle;
    const utcRotation = ((hoursUTC - 12) / 24) * Math.PI * 2 - seasonAngle;
    if (earthRef.current)  earthRef.current.rotation.y  = utcRotation;
    if (cloudsRef.current) cloudsRef.current.rotation.y = utcRotation + cloudDrift.current;
  });

  return (
    <group>
      <group ref={outerGroupRef}>
        <group rotation={[0, 0, AXIAL_TILT]}>
          {/* Surface */}
          <mesh ref={earthRef} onClick={onClick}>
            <sphereGeometry args={[radius, 128, 128]} />
            <primitive attach="material" object={earthMat} />
          </mesh>

          {/* KSC marker */}
          {showKSC && <KSCMarker radius={radius} />}

          {/* Clouds */}
          <mesh ref={cloudsRef}>
            <sphereGeometry args={[radius * 1.003, 64, 64]} />
            <primitive attach="material" object={cloudMat} />
          </mesh>
        </group>
      </group>

      {/* Atmosphere rim */}
      <mesh>
        <sphereGeometry args={[radius * 1.08, 64, 64]} />
        <meshPhongMaterial
          color="#2255ff"
          emissive={emissiveColor}
          emissiveIntensity={0.35}
          transparent
          opacity={0.13}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
