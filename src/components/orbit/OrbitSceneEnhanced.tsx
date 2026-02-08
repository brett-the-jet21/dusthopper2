"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState, useMemo, useRef } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";

const EARTH_RADIUS = 6.371; // Earth radius in our units

// Generate proper circular orbit
function generateOrbitPath(altitude: number, inclination: number) {
  const points = [];
  const radius = EARTH_RADIUS + (altitude / 100); // Scale altitude
  const segments = 256;
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    
    // Create circular orbit
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta) * Math.sin(inclination * Math.PI / 180);
    const z = radius * Math.sin(theta) * Math.cos(inclination * Math.PI / 180);
    
    points.push(new THREE.Vector3(x, y, z));
  }
  
  return points;
}

// Better spacecraft visual
function Spacecraft({ color }: { color: string }) {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.02;
    }
  });
  
  return (
    <group ref={meshRef}>
      {/* Main body */}
      <Sphere args={[0.3, 16, 16]}>
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={1.5}
          metalness={0.8}
          roughness={0.2}
        />
      </Sphere>
      
      {/* Solar panels */}
      <mesh position={[0.5, 0, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.4]} />
        <meshStandardMaterial color="#1a4d7a" metalness={0.9} />
      </mesh>
      <mesh position={[-0.5, 0, 0]}>
        <boxGeometry args={[0.8, 0.05, 0.4]} />
        <meshStandardMaterial color="#1a4d7a" metalness={0.9} />
      </mesh>
      
      {/* Glow */}
      <pointLight color={color} intensity={3} distance={5} />
      
      {/* Outer glow sphere */}
      <Sphere args={[0.5, 16, 16]}>
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </Sphere>
    </group>
  );
}

function OrbitingSpacecraft({ mission, index, timeScale, onPositionUpdate }: any) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      const orbitalPeriod = 90 * 60; // 90 minutes for ISS
      const scaledTime = state.clock.elapsedTime * timeScale;
      const progress = (scaledTime / orbitalPeriod + (index * 0.33)) % 1; // Offset each satellite
      const angle = progress * Math.PI * 2;
      
      const radius = EARTH_RADIUS + (mission.alt / 100);
      const inclinationRad = mission.inclination * Math.PI / 180;
      
      // Proper circular orbit
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle) * Math.sin(inclinationRad);
      const z = radius * Math.sin(angle) * Math.cos(inclinationRad);
      
      groupRef.current.position.set(x, y, z);
      onPositionUpdate([x, y, z]);
    }
  });
  
  const orbitPath = useMemo(() => 
    generateOrbitPath(mission.alt, mission.inclination), 
    [mission]
  );
  
  return (
    <group ref={groupRef}>
      {/* Orbital path line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={orbitPath.length}
            array={new Float32Array(orbitPath.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={mission.color} transparent opacity={0.6} linewidth={2} />
      </line>
      
      {/* Spacecraft */}
      <Spacecraft color={mission.color} />
    </group>
  );
}

function RotatingEarth({ timeScale }: { timeScale: number }) {
  const earthRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (earthRef.current) {
      const dayDuration = 24 * 60 * 60;
      const scaledTime = state.clock.elapsedTime * timeScale;
      earthRef.current.rotation.y = (scaledTime / dayDuration) * Math.PI * 2;
    }
  });
  
  return (
    <group ref={earthRef}>
      <EarthPro />
    </group>
  );
}

function SpaceCamera({ target, enabled }: any) {
  const { camera } = useThree();
  
  useFrame(() => {
    if (enabled && target) {
      const targetPos = new THREE.Vector3(...target);
      
      // Position camera to view spacecraft and Earth together
      const distance = 12;
      const offset = targetPos.clone().normalize().multiplyScalar(distance);
      const desiredPos = offset.add(new THREE.Vector3(0, 4, 0));
      
      camera.position.lerp(desiredPos, 0.02);
      camera.lookAt(targetPos);
    }
  });
  
  return null;
}

export function OrbitSceneEnhanced({ missionId }: { missionId: string }) {
  const [freeCam, setFreeCam] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [timeScale, setTimeScale] = useState(100);
  const [selectedMission, setSelectedMission] = useState(0);
  const [spacecraftPositions, setSpacecraftPositions] = useState<any[]>([]);
  
  const missions = useMemo(() => [
    { name: "ISS", color: "#00ffcc", alt: 408, inclination: 51.6 },
    { name: "STARSHIP HLS-1", color: "#ffaa00", alt: 350, inclination: 28.5 },
    { name: "STARLINK-6548", color: "#00ff88", alt: 550, inclination: 53 },
  ], []);
  
  const updatePosition = (index: number) => (pos: any) => {
    setSpacecraftPositions(prev => {
      const newPos = [...prev];
      newPos[index] = pos;
      return newPos;
    });
  };
  
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Canvas camera={{ position: [0, 10, 20], fov: 50 }}>
        <color attach="background" args={["#000005"]} />
        
        {/* Lighting */}
        <ambientLight intensity={0.2} />
        <directionalLight position={[30, 20, 10]} intensity={5} castShadow />
        <pointLight position={[0, 0, 0]} intensity={3} distance={100} color="#ffffff" />
        
        <StarsField />
        <RotatingEarth timeScale={playing ? timeScale : 0} />
        
        {playing && missions.map((m, i) => (
          <OrbitingSpacecraft 
            key={i} 
            mission={m} 
            index={i} 
            timeScale={timeScale}
            onPositionUpdate={updatePosition(i)} 
          />
        ))}
        
        <SpaceCamera target={spacecraftPositions[selectedMission]} enabled={!freeCam} />
        
        <EffectComposer>
          <Bloom intensity={2.2} luminanceThreshold={0.05} luminanceSmoothing={0.9} />
        </EffectComposer>
        
        <OrbitControls enabled={freeCam} enableDamping dampingFactor={0.05} />
      </Canvas>
      
      {/* CONTROLS */}
      <div style={{position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:12,background:'rgba(5,10,15,0.95)',padding:'14px 28px',borderRadius:10,border:'1px solid rgba(0,200,255,0.3)',boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:100}}>
        <button onClick={()=>setFreeCam(!freeCam)} style={{background:freeCam?'#00ccff':'#1a1a1a',color:freeCam?'#000':'#0cf',border:'1px solid #0cf',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{freeCam?'🎥 FREE':'🎯 TRACK'}</button>
        <button onClick={()=>setPlaying(!playing)} style={{background:playing?'#00ff88':'#ff3333',color:'#000',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
        <div style={{width:1,height:36,background:'rgba(0,200,255,0.2)'}}/>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'rgba(0,200,255,0.8)',fontSize:12,fontWeight:700,letterSpacing:0.5}}>TIME</span>
          <select value={timeScale} onChange={(e)=>setTimeScale(Number(e.target.value))} style={{background:'#1a1a1a',color:'#0cf',border:'1px solid #0cf',padding:'10px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'monospace'}}>
            <option value={1}>1× REAL</option>
            <option value={10}>10×</option>
            <option value={100}>100×</option>
            <option value={500}>500×</option>
            <option value={1000}>1000×</option>
          </select>
        </div>
      </div>
      
      {/* MISSIONS */}
      <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',display:'flex',gap:16,zIndex:100}}>{missions.map((m,i)=><button key={i} onClick={()=>setSelectedMission(i)} style={{background:i===selectedMission?`linear-gradient(135deg,${m.color},${m.color}dd)`:'rgba(5,10,15,0.95)',color:i===selectedMission?'#000':'#fff',border:`2px solid ${m.color}`,padding:'12px 28px',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:12,letterSpacing:0.5,boxShadow:i===selectedMission?`0 8px 24px ${m.color}80`:'0 4px 12px rgba(0,0,0,0.5)',transition:'all 0.3s'}}>{m.name}</button>)}</div>
      
      {/* TELEMETRY */}
      <div style={{position:'fixed',top:24,right:24,width:240,background:'rgba(5,10,15,0.95)',border:'1px solid rgba(0,200,255,0.3)',borderRadius:12,padding:'18px 22px',color:'#0cf',fontSize:12,fontFamily:'monospace',boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,paddingBottom:14,borderBottom:'1px solid rgba(0,200,255,0.2)'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'#0f8',boxShadow:'0 0 12px #0f8',animation:'pulse 2s infinite'}}/>
          <div style={{fontWeight:700,fontSize:14}}>{missions[selectedMission].name}</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <span style={{opacity:0.7}}>ALTITUDE</span>
          <span style={{fontWeight:700,color:'#0ff'}}>{missions[selectedMission].alt} km</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <span style={{opacity:0.7}}>VELOCITY</span>
          <span style={{fontWeight:700,color:'#0ff'}}>7.66 km/s</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <span style={{opacity:0.7}}>INCLINATION</span>
          <span style={{fontWeight:700,color:'#0ff'}}>{missions[selectedMission].inclination}°</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
          <span style={{opacity:0.7}}>PERIOD</span>
          <span style={{fontWeight:700,color:'#0ff'}}>~90 min</span>
        </div>
        <div style={{borderTop:'1px solid rgba(0,200,255,0.2)',paddingTop:12}}>
          <div style={{opacity:0.6,fontSize:10,marginBottom:4}}>TIME SCALE</div>
          <div style={{fontWeight:700,fontSize:16,color:'#00ff88'}}>{timeScale}×</div>
        </div>
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}
