'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera } from '@react-three/drei';
import { useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';

const EARTH_RADIUS = 6.371;
const GM = 398600.4418;

const missions = [
  {
    id: 'iss',
    name: 'ISS',
    altitude: 408,
    inclination: 51.6416,
    period: 92.68,
    velocity: 7.66,
    raan: 0,
    argOfPeriapsis: 0,
    trueAnomalyOffset: 0,
    color: '#00ff00',
  },
  {
    id: 'starship',
    name: 'Starship HLS-1',
    altitude: 350,
    inclination: 28.5,
    period: 91.5,
    velocity: 7.70,
    raan: 45,
    argOfPeriapsis: 0,
    trueAnomalyOffset: 120,
    color: '#ff6600',
  },
  {
    id: 'starlink',
    name: 'Starlink-6548',
    altitude: 550,
    inclination: 53.0,
    period: 95.6,
    velocity: 7.59,
    raan: 90,
    argOfPeriapsis: 0,
    trueAnomalyOffset: 240,
    color: '#0088ff',
  },
];

function solveKeplerEquation(M: number, e: number = 0, tolerance: number = 1e-6): number {
  let E = M;
  let delta = 1;
  let iterations = 0;
  const maxIterations = 100;

  while (Math.abs(delta) > tolerance && iterations < maxIterations) {
    delta = E - e * Math.sin(E) - M;
    E = E - delta / (1 - e * Math.cos(E));
    iterations++;
  }

  return E;
}

function calculateOrbitalPosition(
  semiMajorAxis: number,
  inclination: number,
  raan: number,
  argOfPeriapsis: number,
  time: number,
  period: number,
  trueAnomalyOffset: number = 0
): THREE.Vector3 {
  const n = (2 * Math.PI) / (period * 60);
  const M = (n * time + (trueAnomalyOffset * Math.PI) / 180) % (2 * Math.PI);
  const E = solveKeplerEquation(M, 0);
  const nu = 2 * Math.atan2(Math.sqrt(1) * Math.sin(E / 2), Math.sqrt(1) * Math.cos(E / 2));

  const r = semiMajorAxis;
  const x = r * Math.cos(nu);
  const y = r * Math.sin(nu);

  const incRad = (inclination * Math.PI) / 180;
  const raanRad = (raan * Math.PI) / 180;
  const argPRad = (argOfPeriapsis * Math.PI) / 180;

  const cosRaan = Math.cos(raanRad);
  const sinRaan = Math.sin(raanRad);
  const cosInc = Math.cos(incRad);
  const sinInc = Math.sin(incRad);
  const cosArgP = Math.cos(argPRad);
  const sinArgP = Math.sin(argPRad);

  const xEci =
    x * (cosRaan * cosArgP - sinRaan * sinArgP * cosInc) -
    y * (cosRaan * sinArgP + sinRaan * cosArgP * cosInc);
  const yEci =
    x * (sinRaan * cosArgP + cosRaan * sinArgP * cosInc) -
    y * (sinRaan * sinArgP - cosRaan * cosArgP * cosInc);
  const zEci = x * sinArgP * sinInc + y * cosArgP * sinInc;

  return new THREE.Vector3(xEci, zEci, -yEci);
}

function RotatingEarth({ timeScale, playing }: { timeScale: number; playing: boolean }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const [initialRotation] = useState(() => {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const utcSeconds = now.getUTCSeconds();
    const secondsSinceMidnight = utcHours * 3600 + utcMinutes * 60 + utcSeconds;
    const rotation = (secondsSinceMidnight / 86400) * Math.PI * 2;
    return rotation;
  });

  useFrame((state, delta) => {
    if (earthRef.current && playing) {
      const rotationSpeed = (2 * Math.PI / 86400) * timeScale;
      earthRef.current.rotation.y += rotationSpeed * delta;
    }
  });

  const earthTexture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return loader.load('/textures/earth_daymap.jpg');
  }, []);

  const earthNormalMap = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return loader.load('/textures/earth_normal_map.jpg');
  }, []);

  const earthSpecularMap = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return loader.load('/textures/earth_specular_map.jpg');
  }, []);

  useEffect(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y = initialRotation;
    }
  }, [initialRotation]);

  return (
    <mesh ref={earthRef} position={[0, 0, 0]}>
      <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
      <meshPhongMaterial
        map={earthTexture}
        normalMap={earthNormalMap}
        specularMap={earthSpecularMap}
        specular={new THREE.Color(0x333333)}
        shininess={25}
      />
    </mesh>
  );
}

function OrbitingSpacecraft({
  mission,
  timeScale,
  playing,
  isSelected,
}: {
  mission: typeof missions[0];
  timeScale: number;
  playing: boolean;
  isSelected: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [simulationTime, setSimulationTime] = useState(0);

  useFrame((state, delta) => {
    if (playing) {
      setSimulationTime((prev) => prev + delta * timeScale);
    }
  });

  const position = useMemo(() => {
    const semiMajorAxis = EARTH_RADIUS + mission.altitude;
    return calculateOrbitalPosition(
      semiMajorAxis,
      mission.inclination,
      mission.raan,
      mission.argOfPeriapsis,
      simulationTime,
      mission.period,
      mission.trueAnomalyOffset
    );
  }, [mission, simulationTime]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.copy(position);
    }
  }, [position]);

  const orbitPoints = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const numPoints = 256;
    const semiMajorAxis = EARTH_RADIUS + mission.altitude;

    for (let i = 0; i <= numPoints; i++) {
      const time = (i / numPoints) * mission.period * 60;
      const pos = calculateOrbitalPosition(
        semiMajorAxis,
        mission.inclination,
        mission.raan,
        mission.argOfPeriapsis,
        time,
        mission.period,
        mission.trueAnomalyOffset
      );
      points.push(pos);
    }

    return points;
  }, [mission]);

  const orbitGeometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(orbitPoints);
  }, [orbitPoints]);

  return (
    <>
      <line geometry={orbitGeometry}>
        <lineBasicMaterial
          color={mission.color}
          transparent
          opacity={isSelected ? 0.6 : 0.3}
        />
      </line>

      <mesh ref={meshRef} position={position}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={mission.color} />
        {isSelected && (
          <mesh>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshBasicMaterial color={mission.color} transparent opacity={0.3} />
          </mesh>
        )}
      </mesh>
    </>
  );
}

function Sun() {
  return (
    <group position={[80, 0, 0]}>
      <mesh>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <pointLight color="#ffffff" intensity={2} distance={200} decay={2} />
    </group>
  );
}

function SpaceCamera({
  selectedMission,
  trackingMode,
  zoomLevel,
}: {
  selectedMission: string | null;
  trackingMode: 'FREE_CAM' | 'TRACKING';
  zoomLevel: number;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (trackingMode === 'TRACKING' && selectedMission) {
      const mission = missions.find((m) => m.id === selectedMission);
      if (mission) {
        const distance = 25 * zoomLevel;
        const target = new THREE.Vector3(0, 0, 0);
        const offset = new THREE.Vector3(distance * 0.7, distance * 0.5, distance * 0.7);
        camera.position.lerp(target.clone().add(offset), 0.05);
        camera.lookAt(target);
      }
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[25, 15, 25]} fov={45} />
      {trackingMode === 'FREE_CAM' && (
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={10}
          maxDistance={100}
        />
      )}
    </>
  );
}

export default function OrbitSceneEnhanced() {
  const [selectedMission, setSelectedMission] = useState<string>('iss');
  const [trackingMode, setTrackingMode] = useState<'FREE_CAM' | 'TRACKING'>('TRACKING');
  const [playing, setPlaying] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [telemetryOpen, setTelemetryOpen] = useState(true);

  const timeScales = [1, 60, 360, 1440, 3600];

  return (
    <div className="relative w-full h-screen bg-black">
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-white font-mono tracking-wider">
              DUSTHOPPER ORBITAL CONTROL
            </h1>
            <p className="text-sm text-green-400 font-mono">REAL-TIME SATELLITE TRACKING SYSTEM</p>
          </div>
        </div>
      </div>

      <Canvas>
        <color attach="background" args={['#000000']} />
        <ambientLight intensity={0.1} />
        <Stars radius={300} depth={50} count={5000} factor={4} fade speed={1} />
        
        <Sun />
        <RotatingEarth timeScale={timeScale} playing={playing} />
        
        {missions.map((mission) => (
          <OrbitingSpacecraft
            key={mission.id}
            mission={mission}
            timeScale={playing ? timeScale : 0}
            playing={playing}
            isSelected={mission.id === selectedMission}
          />
        ))}
        
        <SpaceCamera
          selectedMission={selectedMission}
          trackingMode={trackingMode}
          zoomLevel={zoomLevel}
        />
      </Canvas>

      <div className="absolute bottom-4 left-4 right-4 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-black/80 border border-green-500 rounded p-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-2">
                {missions.map((mission) => (
                  <button
                    key={mission.id}
                    onClick={() => setSelectedMission(mission.id)}
                    className={`px-4 py-2 rounded font-mono text-sm transition-all ${
                      selectedMission === mission.id
                        ? 'bg-green-500 text-black font-bold'
                        : 'bg-black/50 text-green-400 border border-green-500 hover:bg-green-500/20'
                    }`}
                  >
                    {mission.name}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setPlaying(!playing)}
                  className="px-6 py-2 rounded font-mono font-bold bg-green-500 text-black hover:bg-green-400 transition-all"
                >
                  {playing ? 'PAUSE' : 'PLAY'}
                </button>
                
                <div className="flex gap-1">
                  {timeScales.map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setTimeScale(scale)}
                      className={`px-3 py-2 rounded font-mono text-xs transition-all ${
                        timeScale === scale
                          ? 'bg-green-500 text-black font-bold'
                          : 'bg-black/50 text-green-400 border border-green-500 hover:bg-green-500/20'
                      }`}
                    >
                      {scale}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setTrackingMode(trackingMode === 'FREE_CAM' ? 'TRACKING' : 'FREE_CAM')}
                  className={`px-4 py-2 rounded font-mono text-sm transition-all ${
                    trackingMode === 'TRACKING'
                      ? 'bg-green-500 text-black font-bold'
                      : 'bg-black/50 text-green-400 border border-green-500 hover:bg-green-500/20'
                  }`}
                >
                  {trackingMode}
                </button>
                
                <button
                  onClick={() => setZoomLevel(Math.max(0.4, zoomLevel - 0.2))}
                  className="px-3 py-2 rounded font-mono bg-black/50 text-green-400 border border-green-500 hover:bg-green-500/20"
                >
                  −
                </button>
                <span className="px-3 py-2 font-mono text-green-400 text-sm">
                  {zoomLevel.toFixed(1)}×
                </span>
                <button
                  onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.2))}
                  className="px-3 py-2 rounded font-mono bg-black/50 text-green-400 border border-green-500 hover:bg-green-500/20"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => setTelemetryOpen(!telemetryOpen)}
                className="px-3 py-2 rounded font-mono bg-black/50 text-green-400 border border-green-500 hover:bg-green-500/20"
              >
                {telemetryOpen ? '◀' : '▶'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {telemetryOpen && (
        <div className="absolute top-20 right-4 z-10 w-80 bg-black/90 border border-green-500 rounded p-4">
          <h2 className="text-lg font-bold text-green-400 font-mono mb-3">TELEMETRY DATA</h2>
          {missions
            .filter((m) => m.id === selectedMission)
            .map((mission) => (
              <div key={mission.id} className="space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-green-400">MISSION:</span>
                  <span className="text-white font-bold">{mission.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">ALTITUDE:</span>
                  <span className="text-white">{mission.altitude} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">VELOCITY:</span>
                  <span className="text-white">
                    {mission.velocity} km/s ({(mission.velocity * 2236.94).toFixed(0)} mph)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">INCLINATION:</span>
                  <span className="text-white">{mission.inclination.toFixed(2)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">PERIOD:</span>
                  <span className="text-white">{mission.period.toFixed(2)} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">STATUS:</span>
                  <span className="text-green-500 font-bold">{playing ? 'ACTIVE' : 'PAUSED'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-400">TIME SCALE:</span>
                  <span className="text-white">{timeScale}×</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
