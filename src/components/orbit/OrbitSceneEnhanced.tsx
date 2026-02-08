"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Sphere } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState, useMemo, useRef, Suspense } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";

const EARTH_RADIUS = 6.371;

function generateOrbitPath(altitude: number, inclination: number) {
  const points = [];
  const orbitRadius = EARTH_RADIUS + (altitude / 100);
  const segments = 128;
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    let x = orbitRadius * Math.cos(angle);
    let y = 0;
    let z = orbitRadius * Math.sin(angle);
    const incRad = (inclination * Math.PI) / 180;
    const newY = z * Math.sin(incRad);
    const newZ = z * Math.cos(incRad);
    points.push(new THREE.Vector3(x, newY, newZ));
  }
  
  return points;
}

// WHITE SUN like in real space
function Sun() {
  return (
    <group position={[50, 0, 0]}>
      <Sphere args={[3, 32, 32]}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>
      <pointLight color="#ffffff" intensity={50} distance={200} />
      <mesh>
        <sphereGeometry args={[5, 32, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

function DetailedISS() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.002; });
  
  return (
    <group ref={groupRef} scale={0.5}>
      <mesh><boxGeometry args={[3, 0.12, 0.12]} /><meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.3} emissive="#c0c0c0" emissiveIntensity={0.3} /></mesh>
      <mesh position={[-0.6, 0, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.2, 0.2, 1.2]} /><meshStandardMaterial color="#e8e8e8" metalness={0.7} roughness={0.4} emissive="#e8e8e8" emissiveIntensity={0.2} /></mesh>
      <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.22, 0.22, 1.4]} /><meshStandardMaterial color="#e0e0e0" metalness={0.7} roughness={0.4} emissive="#e0e0e0" emissiveIntensity={0.2} /></mesh>
      <group position={[-1.7, 0, 0]}>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.3} /></mesh>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.3} /></mesh>
      </group>
      <group position={[1.7, 0, 0]}>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.3} /></mesh>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[2, 0.02, 1]} /><meshStandardMaterial color="#1a3d5c" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.3} /></mesh>
      </group>
      <pointLight color="#00ffcc" intensity={3} distance={8} />
    </group>
  );
}

function DetailedStarship() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.003; });
  
  return (
    <group ref={groupRef} scale={0.35}>
      <mesh><cylinderGeometry args={[0.3, 0.3, 2.5, 32]} /><meshStandardMaterial color="#d0d0d0" metalness={0.95} roughness={0.15} emissive="#a0a0a0" emissiveIntensity={0.2} /></mesh>
      <mesh position={[0, 1.6, 0]}><coneGeometry args={[0.3, 0.8, 32]} /><meshStandardMaterial color="#c8c8c8" metalness={0.95} roughness={0.12} emissive="#a0a0a0" emissiveIntensity={0.2} /></mesh>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.31, 0.31, 1.2, 32]} /><meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.9} /></mesh>
      <mesh position={[0.4, 0.6, 0]} rotation={[0, 0, Math.PI/8]}><boxGeometry args={[0.7, 0.05, 0.3]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} emissive="#666" emissiveIntensity={0.2} /></mesh>
      <mesh position={[-0.4, 0.6, 0]} rotation={[0, 0, -Math.PI/8]}><boxGeometry args={[0.7, 0.05, 0.3]} /><meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} emissive="#666" emissiveIntensity={0.2} /></mesh>
      <pointLight color="#ffaa00" intensity={3} distance={8} />
    </group>
  );
}

function DetailedStarlink() {
  return (
    <group scale={0.3}>
      <mesh><boxGeometry args={[0.8, 0.1, 0.5]} /><meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.2} emissive="#2a2a2a" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[1.2, 0.02, 0.4]} /><meshStandardMaterial color="#1a4d7a" metalness={0.95} roughness={0.1} emissive="#0066cc" emissiveIntensity={0.4} /></mesh>
      <pointLight color="#00ff88" intensity={3} distance={6} />
    </group>
  );
}

function OrbitingSpacecraft({ mission, index, timeScale, onPositionUpdate }: any) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      const orbitalPeriod = 90 * 60;
      const scaledTime = state.clock.elapsedTime * timeScale;
      const progress = (scaledTime / orbitalPeriod + (index * 0.33)) % 1;
      const angle = progress * Math.PI * 2;
      const orbitRadius = EARTH_RADIUS + (mission.alt / 100);
      const incRad = (mission.inclination * Math.PI) / 180;
      let x = orbitRadius * Math.cos(angle);
      let y = 0;
      let z = orbitRadius * Math.sin(angle);
      const newY = z * Math.sin(incRad);
      const newZ = z * Math.cos(incRad);
      groupRef.current.position.set(x, newY, newZ);
      const nextAngle = angle + 0.01;
      let nextX = orbitRadius * Math.cos(nextAngle);
      let nextZ = orbitRadius * Math.sin(nextAngle);
      const nextNewZ = nextZ * Math.cos(incRad);
      groupRef.current.lookAt(nextX, newY, nextNewZ);
      onPositionUpdate([x, newY, newZ]);
    }
  });
  
  const orbitPath = useMemo(() => generateOrbitPath(mission.alt, mission.inclination), [mission]);
  const Model = mission.model === 'iss' ? DetailedISS : mission.model === 'starship' ? DetailedStarship : DetailedStarlink;
  
  return (
    <group ref={groupRef}>
      <Line points={orbitPath} color={mission.color} lineWidth={2} transparent opacity={0.6} />
      <Suspense fallback={null}><Model /></Suspense>
    </group>
  );
}

function RotatingEarth({ timeScale, initialRotation }: { timeScale: number; initialRotation: number }) {
  const earthRef = useRef<THREE.Group>(null);
  const totalRotationRef = useRef(initialRotation);
  
  useFrame((state, delta) => {
    if (earthRef.current) {
      if (timeScale > 0) {
        // Earth rotates 360° in 86400 seconds
        // At 1× real-time, this should be IMPERCEPTIBLE
        const SECONDS_PER_DAY = 86400;
        const rotationThisFrame = (Math.PI * 2 / SECONDS_PER_DAY) * delta * timeScale;
        totalRotationRef.current += rotationThisFrame;
      }
      earthRef.current.rotation.y = totalRotationRef.current;
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
    if (enabled && target) {
      const targetPos = new THREE.Vector3(...target);
      const distance = 12 / zoom;
      const offset = targetPos.clone().normalize().multiplyScalar(distance);
      const desiredPos = offset.add(new THREE.Vector3(0, 4 / zoom, 0));
      camera.position.lerp(desiredPos, 0.02);
      camera.lookAt(targetPos);
    }
  });
  return null;
}

export function OrbitSceneEnhanced({ missionId }: { missionId: string }) {
  const [freeCam, setFreeCam] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [timeScale, setTimeScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [selectedMission, setSelectedMission] = useState(0);
  const [spacecraftPositions, setSpacecraftPositions] = useState<any[]>([]);
  
  // Set initial Earth rotation for 7:05am PST (UTC-8)
  // 7:05am PST = 15:05 UTC = 15.0833 hours
  // Rotation = (15.0833 / 24) * 2π radians
  const initialEarthRotation = useMemo(() => {
    const now = new Date();
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    return (utcHours / 24) * Math.PI * 2;
  }, []);
  
  const missions = useMemo(() => [
    { name: "ISS", color: "#00ffcc", alt: 408, inclination: 51.6, model: 'iss' },
    { name: "STARSHIP HLS-1", color: "#ffaa00", alt: 350, inclination: 28.5, model: 'starship' },
    { name: "STARLINK-6548", color: "#00ff88", alt: 550, inclination: 53, model: 'starlink' },
  ], []);
  
  const updatePosition = (index: number) => (pos: any) => {
    setSpacecraftPositions(prev => {
      const newPos = [...prev];
      newPos[index] = pos;
      return newPos;
    });
  };
  
  const velocityMph = (7.66 * 0.621371 * 1000).toFixed(0);
  
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ position: [0, 10, 20], fov: 50 }}>
        <color attach="background" args={["#000008"]} />
        <Sun />
        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 0, 0]} intensity={8} castShadow />
        <StarsField />
        <RotatingEarth timeScale={playing ? timeScale : 0} initialRotation={initialEarthRotation} />
        {playing && missions.map((m, i) => (
          <OrbitingSpacecraft key={i} mission={m} index={i} timeScale={timeScale} onPositionUpdate={updatePosition(i)} />
        ))}
        <SpaceCamera target={spacecraftPositions[selectedMission]} enabled={!freeCam} zoom={zoom} />
        <EffectComposer><Bloom intensity={2} luminanceThreshold={0.3} luminanceSmoothing={0.9} /></EffectComposer>
        <OrbitControls enabled={freeCam} enableDamping dampingFactor={0.05} />
      </Canvas>
      
      <div style={{position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:12,background:'rgba(5,10,15,0.95)',padding:'14px 28px',borderRadius:10,border:'1px solid rgba(0,200,255,0.3)',boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:100}}>
        <button onClick={()=>setFreeCam(!freeCam)} style={{background:freeCam?'#00ccff':'#1a1a1a',color:freeCam?'#000':'#0cf',border:'1px solid #0cf',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{freeCam?'🎥 FREE':'🎯 TRACK'}</button>
        <button onClick={()=>setPlaying(!playing)} style={{background:playing?'#00ff88':'#ff3333',color:'#000',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
        <div style={{width:1,height:36,background:'rgba(0,200,255,0.2)'}}/>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'rgba(0,200,255,0.8)',fontSize:12,fontWeight:700}}>TIME</span>
          <select value={timeScale} onChange={(e)=>setTimeScale(Number(e.target.value))} style={{background:'#1a1a1a',color:'#0cf',border:'1px solid #0cf',padding:'10px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'monospace'}}>
            <option value={1}>1× REAL 🦅</option>
            <option value={60}>60×</option>
            <option value={360}>360×</option>
            <option value={1440}>1440×</option>
            <option value={3600}>3600×</option>
          </select>
        </div>
      </div>
      
      <div style={{position:'fixed',left:24,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:12,background:'rgba(5,10,15,0.95)',padding:'12px',borderRadius:10,border:'1px solid rgba(0,200,255,0.3)',zIndex:100}}>
        <button onClick={()=>setZoom(Math.min(zoom * 1.2, 3))} style={{background:'#1a1a1a',color:'#0cf',border:'1px solid #0cf',padding:'12px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:18,lineHeight:1}}>+</button>
        <div style={{color:'#0cf',fontSize:11,fontWeight:700,textAlign:'center',fontFamily:'monospace'}}>{zoom.toFixed(1)}×</div>
        <button onClick={()=>setZoom(Math.max(zoom / 1.2, 0.5))} style={{background:'#1a1a1a',color:'#0cf',border:'1px solid #0cf',padding:'12px 18px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:18,lineHeight:1}}>−</button>
      </div>
      
      <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',display:'flex',gap:16,zIndex:100}}>{missions.map((m,i)=><button key={i} onClick={()=>setSelectedMission(i)} style={{background:i===selectedMission?`linear-gradient(135deg,${m.color},${m.color}dd)`:'rgba(5,10,15,0.95)',color:i===selectedMission?'#000':'#fff',border:`2px solid ${m.color}`,padding:'12px 28px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:12,boxShadow:i===selectedMission?`0 8px 24px ${m.color}80`:'0 4px 12px rgba(0,0,0,0.5)',transition:'all 0.3s'}}>{m.name}</button>)}</div>
      
      <div style={{position:'fixed',top:24,right:24,width:260,background:'rgba(5,10,15,0.95)',border:'1px solid rgba(0,200,255,0.3)',borderRadius:12,padding:'18px 22px',color:'#0cf',fontSize:12,fontFamily:'monospace',boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,paddingBottom:14,borderBottom:'1px solid rgba(0,200,255,0.2)'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#0f8',boxShadow:'0 0 12px #0f8'}}/>
          <div style={{fontWeight:700,fontSize:14}}>{missions[selectedMission].name}</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{opacity:0.7}}>ALTITUDE</span><span style={{fontWeight:700,color:'#0ff'}}>{missions[selectedMission].alt} km</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{opacity:0.7}}>VELOCITY</span><span style={{fontWeight:700,color:'#0ff'}}>7.66 km/s</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{opacity:0.7}}>VELOCITY 🇺🇸</span><span style={{fontWeight:700,color:'#0ff'}}>{velocityMph} mph</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{opacity:0.7}}>INCLINATION</span><span style={{fontWeight:700,color:'#0ff'}}>{missions[selectedMission].inclination}°</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}><span style={{opacity:0.7}}>PERIOD</span><span style={{fontWeight:700,color:'#0ff'}}>~90 min</span></div>
        <div style={{borderTop:'1px solid rgba(0,200,255,0.2)',paddingTop:12}}><div style={{opacity:0.6,fontSize:10,marginBottom:4}}>TIME SCALE</div><div style={{fontWeight:700,fontSize:16,color:'#00ff88'}}>{timeScale}× {timeScale===1&&'🦅'}</div></div>
      </div>
    </div>
  );
}
