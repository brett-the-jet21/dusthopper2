"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Sphere } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState, useMemo, useRef, Suspense, useEffect } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";

const EARTH_RADIUS = 6.371;

function Sun() {
  return (
    <group position={[80, 0, 0]}>
      <Sphere args={[1, 32, 32]}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>
      <pointLight color="#ffffff" intensity={150} distance={400} decay={1} />
      <Sphere args={[3, 32, 32]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} />
      </Sphere>
    </group>
  );
}

function DetailedISS() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.002; });
  
  return (
    <group ref={groupRef} scale={0.5}>
      <mesh><boxGeometry args={[3, 0.12, 0.12]} /><meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.3} emissive="#c0c0c0" emissiveIntensity={0.5} /></mesh>
      <mesh position={[-0.6, 0, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.2, 0.2, 1.2]} /><meshStandardMaterial color="#e8e8e8" metalness={0.7} roughness={0.4} emissive="#e8e8e8" emissiveIntensity={0.4} /></mesh>
      <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.22, 0.22, 1.4]} /><meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.4} emissive="#e0e0e0" emissiveIntensity={0.4} /></mesh>
      <group position={[-1.7, 0, 0]}>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.5} /></mesh>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.5} /></mesh>
      </group>
      <group position={[1.7, 0, 0]}>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.5} /></mesh>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.5} /></mesh>
      </group>
      <pointLight color="#00ffcc" intensity={5} distance={12} />
    </group>
  );
}

function DetailedStarship() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.003; });
  
  return (
    <group ref={groupRef} scale={0.35}>
      <mesh><cylinderGeometry args={[0.3, 0.3, 2.5, 32]} /><meshStandardMaterial color="#d0d0d0" metalness={0.95} roughness={0.15} emissive="#a0a0a0" emissiveIntensity={0.4} /></mesh>
      <mesh position={[0, 1.6, 0]}><coneGeometry args={[0.3, 0.8, 32]} /><meshStandardMaterial color="#c8c8c8" metalness={0.95} roughness={0.12} emissive="#a0a0a0" emissiveIntensity={0.4} /></mesh>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.31, 0.31, 1.2, 32]} /><meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.9} /></mesh>
      <mesh position={[0.4, 0.6, 0]} rotation={[0, 0, Math.PI/8]}><boxGeometry args={[0.7, 0.05, 0.3]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} emissive="#666" emissiveIntensity={0.4} /></mesh>
      <mesh position={[-0.4, 0.6, 0]} rotation={[0, 0, -Math.PI/8]}><boxGeometry args={[0.7, 0.05, 0.3]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} emissive="#666" emissiveIntensity={0.4} /></mesh>
      <pointLight color="#ffaa00" intensity={5} distance={12} />
    </group>
  );
}

function DetailedStarlink() {
  return (
    <group scale={0.3}>
      <mesh><boxGeometry args={[0.8, 0.1, 0.5]} /><meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.2} emissive="#2a2a2a" emissiveIntensity={0.5} /></mesh>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[1.2, 0.02, 0.4]} /><meshStandardMaterial color="#1a4d7a" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.6} /></mesh>
      <pointLight color="#00ff88" intensity={5} distance={10} />
    </group>
  );
}

function calculateOrbitalVelocity(altitudeKm: number): { kms: number; mph: number } {
  const G = 6.674e-11;
  const M = 5.972e24;
  const R_earth = 6371000;
  const r = R_earth + (altitudeKm * 1000);
  const v = Math.sqrt((G * M) / r);
  const kms = v / 1000;
  const mph = kms * 0.621371 * 1000;
  return { kms, mph };
}

function calculateOrbitalPosition(
  semiMajorAxis: number,
  eccentricity: number,
  inclination: number,
  raan: number,
  argOfPerigee: number,
  meanAnomaly: number
): THREE.Vector3 {
  const i = (inclination * Math.PI) / 180;
  const omega = (raan * Math.PI) / 180;
  const w = (argOfPerigee * Math.PI) / 180;
  const M = (meanAnomaly * Math.PI) / 180;
  
  let E = M;
  for (let iter = 0; iter < 10; iter++) {
    E = M + eccentricity * Math.sin(E);
  }
  
  const v = 2 * Math.atan2(
    Math.sqrt(1 + eccentricity) * Math.sin(E / 2),
    Math.sqrt(1 - eccentricity) * Math.cos(E / 2)
  );
  
  const r = semiMajorAxis * (1 - eccentricity * Math.cos(E));
  const xOrbital = r * Math.cos(v);
  const yOrbital = r * Math.sin(v);
  
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const cosI = Math.cos(i);
  const sinI = Math.sin(i);
  
  const x = (cosW * cosOmega - sinW * sinOmega * cosI) * xOrbital +
           (-sinW * cosOmega - cosW * sinOmega * cosI) * yOrbital;
           
  const y = (cosW * sinOmega + sinW * cosOmega * cosI) * xOrbital +
           (-sinW * sinOmega + cosW * cosOmega * cosI) * yOrbital;
           
  const z = (sinW * sinI) * xOrbital + (cosW * sinI) * yOrbital;
  
  return new THREE.Vector3(x, z, -y);
}

function generateRealisticOrbit(mission: any): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const segments = 256;
  const semiMajorAxis = EARTH_RADIUS + (mission.altitude / 100);
  const eccentricity = mission.eccentricity || 0.0001;
  const inclination = mission.inclination;
  const raan = mission.raan || 0;
  const argOfPerigee = mission.argOfPerigee || 0;
  
  for (let i = 0; i <= segments; i++) {
    const meanAnomaly = (i / segments) * 360;
    const pos = calculateOrbitalPosition(
      semiMajorAxis,
      eccentricity,
      inclination,
      raan,
      argOfPerigee,
      meanAnomaly
    );
    points.push(pos);
  }
  
  return points;
}

function OrbitingSpacecraft({ mission, index, timeScale, startTime, onPositionUpdate }: any) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      const elapsed = state.clock.elapsedTime * timeScale;
      const orbitalPeriod = mission.period * 60;
      const progress = ((elapsed + startTime) / orbitalPeriod) % 1;
      const meanAnomaly = progress * 360;
      
      const semiMajorAxis = EARTH_RADIUS + (mission.altitude / 100);
      const pos = calculateOrbitalPosition(
        semiMajorAxis,
        mission.eccentricity || 0.0001,
        mission.inclination,
        mission.raan || 0,
        mission.argOfPerigee || 0,
        meanAnomaly
      );
      
      groupRef.current.position.copy(pos);
      
      const nextMeanAnomaly = meanAnomaly + 1;
      const nextPos = calculateOrbitalPosition(
        semiMajorAxis,
        mission.eccentricity || 0.0001,
        mission.inclination,
        mission.raan || 0,
        mission.argOfPerigee || 0,
        nextMeanAnomaly
      );
      groupRef.current.lookAt(nextPos);
      
      onPositionUpdate([pos.x, pos.y, pos.z]);
    }
  });
  
  const Model = mission.model === 'iss' ? DetailedISS : mission.model === 'starship' ? DetailedStarship : DetailedStarlink;
  
  return (
    <group ref={groupRef}>
      <Suspense fallback={null}><Model /></Suspense>
    </group>
  );
}

// COMPLETELY FIXED Earth rotation
function RotatingEarth({ timeScale, paused }: { timeScale: number; paused: boolean }) {
  const earthRef = useRef<THREE.Group>(null);
  const initialRotationSet = useRef(false);
  
  useFrame((state, delta) => {
    if (earthRef.current) {
      // Set initial rotation ONCE based on current time
      if (!initialRotationSet.current) {
        const now = new Date();
        const utcHours = now.getUTCHours();
        const utcMinutes = now.getUTCMinutes();
        const utcSeconds = now.getUTCSeconds();
        
        // Calculate exact fraction of day elapsed
        const totalSeconds = utcHours * 3600 + utcMinutes * 60 + utcSeconds;
        const dayFraction = totalSeconds / 86400;
        
        // Earth rotates 2π radians per day
        const initialRotation = dayFraction * Math.PI * 2;
        
        earthRef.current.rotation.y = initialRotation;
        initialRotationSet.current = true;
        
        console.log(`UTC Time: ${utcHours}:${utcMinutes}:${utcSeconds}`);
        console.log(`Day fraction: ${dayFraction.toFixed(6)}`);
        console.log(`Initial rotation: ${initialRotation.toFixed(6)} rad (${(initialRotation * 180 / Math.PI).toFixed(2)}°)`);
      }
      
      // Only rotate if playing
      if (!paused && timeScale > 0) {
        // Earth rotates 2π radians in 86400 seconds
        // At 1× speed, rotation per second = 2π / 86400 = 0.0000727 rad/s
        const rotationPerSecond = (Math.PI * 2) / 86400;
        const rotationThisFrame = rotationPerSecond * delta * timeScale;
        
        earthRef.current.rotation.y += rotationThisFrame;
      }
    }
  });
  
  return (
    <group ref={earthRef}>
      <EarthPro />
    </group>
  );
}

function SpaceCamera({ target, enabled, zoom }: any) {
  const { camera } = useThree();
  
  useFrame(() => {
    if (enabled && target && target.length === 3) {
      const targetPos = new THREE.Vector3(...target);
      const baseDistance = 15;
      const distance = baseDistance / Math.max(zoom, 0.1);
      const offset = targetPos.clone().normalize().multiplyScalar(distance);
      const verticalOffset = 5 / Math.max(zoom, 0.1);
      const desiredPos = offset.add(new THREE.Vector3(0, verticalOffset, 0));
      camera.position.lerp(desiredPos, 0.03);
      camera.lookAt(targetPos);
    }
  });
  
  return null;
}

export function OrbitSceneEnhanced({ missionId }: { missionId: string }) {
  const [freeCam, setFreeCam] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [timeScale, setTimeScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedMission, setSelectedMission] = useState(0);
  const [spacecraftPositions, setSpacecraftPositions] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const missions = useMemo(() => [
    { 
      name: "ISS", 
      color: "#00ffcc", 
      altitude: 408, 
      inclination: 51.6416,
      eccentricity: 0.0006703,
      raan: 247.4627,
      argOfPerigee: 130.5360,
      period: 92.68,
      model: 'iss' 
    },
    { 
      name: "STARSHIP HLS-1", 
      color: "#ffaa00", 
      altitude: 350, 
      inclination: 28.5,
      eccentricity: 0.0001,
      raan: 0,
      argOfPerigee: 0,
      period: 91.5,
      model: 'starship' 
    },
    { 
      name: "STARLINK-6548", 
      color: "#00ff88", 
      altitude: 550, 
      inclination: 53.0,
      eccentricity: 0.0001,
      raan: 120,
      argOfPerigee: 0,
      period: 95.6,
      model: 'starlink' 
    },
  ], []);
  
  const orbitPaths = useMemo(() => 
    missions.map(m => generateRealisticOrbit(m)),
    [missions]
  );
  
  const updatePosition = (index: number) => (pos: any) => {
    setSpacecraftPositions(prev => {
      const newPos = [...prev];
      newPos[index] = pos;
      return newPos;
    });
  };
  
  const currentMission = missions[selectedMission];
  const velocity = calculateOrbitalVelocity(currentMission.altitude);
  const startTimes = [0, 30 * 60, 60 * 60];
  
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ position: [0, 12, 22], fov: 50 }}>
        <color attach="background" args={["#000005"]} />
        <Sun />
        <ambientLight intensity={0.4} />
        <directionalLight position={[80, 0, 0]} intensity={8} castShadow />
        <StarsField />
        <RotatingEarth timeScale={timeScale} paused={!playing} />
        
        {orbitPaths.map((path, i) => (
          <Line key={`path-${i}`} points={path} color={missions[i].color} lineWidth={2} transparent opacity={0.7} />
        ))}
        
        {missions.map((m, i) => (
          <OrbitingSpacecraft 
            key={i} 
            mission={m} 
            index={i} 
            timeScale={playing ? timeScale : 0}
            startTime={startTimes[i]}
            onPositionUpdate={updatePosition(i)} 
          />
        ))}
        
        <SpaceCamera target={spacecraftPositions[selectedMission]} enabled={!freeCam} zoom={zoom} />
        <EffectComposer><Bloom intensity={2.5} luminanceThreshold={0.2} luminanceSmoothing={0.9} /></EffectComposer>
        <OrbitControls enabled={freeCam} enableDamping dampingFactor={0.05} />
      </Canvas>
      
      <div style={{position:'fixed',top:0,left:0,right:0,height:isMobile?60:70,background:'linear-gradient(180deg, rgba(0,15,30,0.98) 0%, rgba(0,10,20,0.95) 100%)',borderBottom:'2px solid rgba(0,200,255,0.4)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'0 12px':'0 30px',zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.8)',flexWrap:isMobile?'wrap':'nowrap'}}>
        <div style={{display:'flex',gap:isMobile?8:15,flexShrink:0}}>
          <button onClick={()=>setFreeCam(!freeCam)} style={{background:freeCam?'linear-gradient(135deg, #00ccff, #0099cc)':'rgba(10,20,30,0.8)',color:freeCam?'#000':'#0cf',border:'2px solid #0cf',padding:isMobile?'8px 12px':'12px 24px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:isMobile?11:13,textTransform:'uppercase',letterSpacing:1,boxShadow:freeCam?'0 0 20px rgba(0,204,255,0.6)':'none',transition:'all 0.2s',whiteSpace:'nowrap'}}>{freeCam?(isMobile?'FREE':'🎥 FREE CAM'):(isMobile?'TRACK':'🎯 TRACKING')}</button>
          <button onClick={()=>setPlaying(!playing)} style={{background:playing?'linear-gradient(135deg, #00ff88, #00cc66)':'linear-gradient(135deg, #ff4444, #cc0000)',color:'#000',border:'none',padding:isMobile?'8px 12px':'12px 24px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:isMobile?11:13,textTransform:'uppercase',letterSpacing:1,boxShadow:playing?'0 0 20px rgba(0,255,136,0.6)':'0 0 20px rgba(255,68,68,0.6)',transition:'all 0.2s',whiteSpace:'nowrap'}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:isMobile?6:12}}>
          <span style={{color:'rgba(0,200,255,0.9)',fontSize:isMobile?10:13,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase',display:isMobile?'none':'inline'}}>TIME SCALE</span>
          <select value={timeScale} onChange={(e)=>setTimeScale(Number(e.target.value))} style={{background:'rgba(10,20,30,0.9)',color:'#0cf',border:'2px solid #0cf',padding:isMobile?'6px 10px':'10px 18px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:isMobile?10:13,fontFamily:'monospace',letterSpacing:0.5}}>
            <option value={1}>1× REAL</option>
            <option value={60}>60×</option>
            <option value={360}>360×</option>
            <option value={1440}>1440×</option>
            <option value={3600}>3600×</option>
          </select>
        </div>
      </div>
      
      {!isMobile && (
        <div style={{position:'fixed',left:25,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:10,background:'rgba(0,15,30,0.95)',padding:15,borderRadius:8,border:'2px solid rgba(0,200,255,0.4)',zIndex:100,boxShadow:'0 8px 24px rgba(0,0,0,0.8)'}}>
          <button onClick={()=>setZoom(z=>Math.min(z*1.3,4))} style={{background:'rgba(10,20,30,0.8)',color:'#0cf',border:'2px solid #0cf',padding:'10px 16px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:20,lineHeight:1}}>+</button>
          <div style={{color:'#0cf',fontSize:12,fontWeight:700,textAlign:'center',fontFamily:'monospace',padding:'5px 0'}}>{zoom.toFixed(1)}×</div>
          <button onClick={()=>setZoom(z=>Math.max(z/1.3,0.4))} style={{background:'rgba(10,20,30,0.8)',color:'#0cf',border:'2px solid #0cf',padding:'10px 16px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:20,lineHeight:1}}>−</button>
        </div>
      )}
      
      {isMobile && (
        <div style={{position:'fixed',left:10,bottom:100,display:'flex',flexDirection:'column',gap:8,background:'rgba(0,15,30,0.95)',padding:10,borderRadius:8,border:'2px solid rgba(0,200,255,0.4)',zIndex:100}}>
          <button onClick={()=>setZoom(z=>Math.min(z*1.3,4))} style={{background:'rgba(10,20,30,0.8)',color:'#0cf',border:'2px solid #0cf',padding:'8px 12px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:18,lineHeight:1}}>+</button>
          <button onClick={()=>setZoom(z=>Math.max(z/1.3,0.4))} style={{background:'rgba(10,20,30,0.8)',color:'#0cf',border:'2px solid #0cf',padding:'8px 12px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:18,lineHeight:1}}>−</button>
        </div>
      )}
      
      <div style={{position:'fixed',bottom:isMobile?10:25,left:'50%',transform:'translateX(-50%)',display:'flex',gap:isMobile?8:18,zIndex:100,flexWrap:'wrap',justifyContent:'center',maxWidth:isMobile?'90%':'auto'}}>{missions.map((m,i)=><button key={i} onClick={()=>setSelectedMission(i)} style={{background:i===selectedMission?`linear-gradient(135deg,${m.color},${m.color}dd)`:'rgba(0,15,30,0.95)',color:i===selectedMission?'#000':'#fff',border:`2px solid ${m.color}`,padding:isMobile?'8px 16px':'14px 32px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:isMobile?10:13,letterSpacing:1,textTransform:'uppercase',boxShadow:i===selectedMission?`0 0 30px ${m.color}80, 0 8px 20px rgba(0,0,0,0.8)`:'0 4px 12px rgba(0,0,0,0.6)',transition:'all 0.3s',whiteSpace:'nowrap'}}>{isMobile?m.name.split(' ')[0]:m.name}</button>)}</div>
      
      <div style={{position:'fixed',top:isMobile?70:90,right:telemetryCollapsed?-280:isMobile?10:25,width:isMobile?'calc(100% - 20px)':280,maxWidth:isMobile?400:280,background:'rgba(0,15,30,0.98)',border:'2px solid rgba(0,200,255,0.4)',borderRadius:10,padding:isMobile?'12px 16px':'20px 24px',color:'#0cf',fontSize:isMobile?10:12,fontFamily:'monospace',boxShadow:'0 8px 32px rgba(0,0,0,0.9)',zIndex:100,transition:'right 0.3s ease'}}>
        <button onClick={()=>setTelemetryCollapsed(!telemetryCollapsed)} style={{position:'absolute',left:-40,top:20,background:'rgba(0,15,30,0.98)',border:'2px solid rgba(0,200,255,0.4)',borderRadius:'8px 0 0 8px',padding:'10px 8px',cursor:'pointer',color:'#0cf',fontWeight:700,fontSize:16}}>{telemetryCollapsed?'◀':'▶'}</button>
        
        <div style={{display:'flex',alignItems:'center',gap:isMobile?8:12,marginBottom:isMobile?12:18,paddingBottom:isMobile?10:16,borderBottom:'2px solid rgba(0,200,255,0.3)'}}>
          <div style={{width:isMobile?8:10,height:isMobile?8:10,borderRadius:'50%',background:'#0f8',boxShadow:'0 0 15px #0f8'}}/>
          <div style={{fontWeight:700,fontSize:isMobile?13:15,letterSpacing:0.5}}>{currentMission.name}</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:isMobile?6:10,padding:isMobile?'4px 0':'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>ALTITUDE</span><span style={{fontWeight:700,color:'#0ff',fontSize:isMobile?11:13}}>{currentMission.altitude} km</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:isMobile?6:10,padding:isMobile?'4px 0':'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>VELOCITY</span><span style={{fontWeight:700,color:'#0ff',fontSize:isMobile?11:13}}>{velocity.kms.toFixed(2)} km/s</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:isMobile?6:10,padding:isMobile?'4px 0':'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>VELOCITY 🇺🇸</span><span style={{fontWeight:700,color:'#0ff',fontSize:isMobile?11:13}}>{Math.round(velocity.mph)} mph</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:isMobile?6:10,padding:isMobile?'4px 0':'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>INCLINATION</span><span style={{fontWeight:700,color:'#0ff',fontSize:isMobile?11:13}}>{currentMission.inclination.toFixed(4)}°</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:isMobile?10:16,padding:isMobile?'4px 0':'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>PERIOD</span><span style={{fontWeight:700,color:'#0ff',fontSize:isMobile?11:13}}>{currentMission.period.toFixed(1)} min</span></div>
        <div style={{borderTop:'2px solid rgba(0,200,255,0.3)',paddingTop:isMobile?10:14}}><div style={{opacity:0.7,fontSize:isMobile?9:11,marginBottom:isMobile?4:6,letterSpacing:0.5}}>TIME MULTIPLIER</div><div style={{fontWeight:700,fontSize:isMobile?16:18,color:'#00ff88'}}>{timeScale}× {timeScale===1&&'🦅'}</div></div>
      </div>
    </div>
  );
}
