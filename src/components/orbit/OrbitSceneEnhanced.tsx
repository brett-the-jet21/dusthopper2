"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sphere, Line, Box, Cylinder, Cone } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState, useMemo, useRef } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";

const EARTH_RADIUS = 6.371;

function generateOrbitPath(altitude: number, inclination: number) {
  const points = [];
  const radius = EARTH_RADIUS + (altitude / 100);
  const segments = 256;
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta) * Math.sin(inclination * Math.PI / 180);
    const z = radius * Math.sin(theta) * Math.cos(inclination * Math.PI / 180);
    points.push(new THREE.Vector3(x, y, z));
  }
  
  return points;
}

// REALISTIC ISS MODEL based on actual design
function ISSModel() {
  return (
    <group scale={0.8}>
      {/* Central truss - aluminum */}
      <Box args={[3, 0.12, 0.12]}>
        <meshStandardMaterial color="#b8b8b8" metalness={0.85} roughness={0.3} />
      </Box>
      
      {/* Pressurized modules */}
      <group position={[0, 0, 0]}>
        {/* Zarya */}
        <Cylinder args={[0.18, 0.18, 1.2]} rotation={[0, 0, Math.PI/2]} position={[-0.6, 0, 0]}>
          <meshStandardMaterial color="#e8e8e8" metalness={0.6} roughness={0.4} />
        </Cylinder>
        
        {/* Unity/Destiny */}
        <Cylinder args={[0.2, 0.2, 1.4]} rotation={[0, 0, Math.PI/2]} position={[0.7, 0, 0]}>
          <meshStandardMaterial color="#f0f0f0" metalness={0.65} roughness={0.35} />
        </Cylinder>
      </group>
      
      {/* Solar panel arrays - PORT (left) */}
      <group position={[-1.8, 0, 0]}>
        <Box args={[2.2, 0.015, 1.1]}>
          <meshStandardMaterial 
            color="#0d2b4a" 
            metalness={0.95} 
            roughness={0.05}
            emissive="#1a4d7a"
            emissiveIntensity={0.15}
          />
        </Box>
        <Box args={[2.2, 0.015, 1.1]} position={[0, 0.25, 0]}>
          <meshStandardMaterial 
            color="#0d2b4a" 
            metalness={0.95} 
            roughness={0.05}
            emissive="#1a4d7a"
            emissiveIntensity={0.15}
          />
        </Box>
      </group>
      
      {/* Solar panel arrays - STARBOARD (right) */}
      <group position={[1.8, 0, 0]}>
        <Box args={[2.2, 0.015, 1.1]}>
          <meshStandardMaterial 
            color="#0d2b4a" 
            metalness={0.95} 
            roughness={0.05}
            emissive="#1a4d7a"
            emissiveIntensity={0.15}
          />
        </Box>
        <Box args={[2.2, 0.015, 1.1]} position={[0, 0.25, 0]}>
          <meshStandardMaterial 
            color="#0d2b4a" 
            metalness={0.95} 
            roughness={0.05}
            emissive="#1a4d7a"
            emissiveIntensity={0.15}
          />
        </Box>
      </group>
      
      {/* Radiators - gold thermal coating */}
      <Box args={[0.8, 0.02, 0.35]} position={[0.5, 0.35, 0]}>
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
      </Box>
      <Box args={[0.8, 0.02, 0.35]} position={[-0.5, 0.35, 0]}>
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
      </Box>
      
      {/* Canadarm2 */}
      <Cylinder args={[0.03, 0.03, 1.5]} rotation={[0, 0, Math.PI/4]} position={[0.3, 0.25, 0.15]}>
        <meshStandardMaterial color="#c0c0c0" metalness={0.8} />
      </Cylinder>
      
      {/* Glow */}
      <pointLight color="#00ffcc" intensity={5} distance={10} />
    </group>
  );
}

// REALISTIC STARSHIP based on actual SpaceX design
function StarshipModel() {
  return (
    <group scale={0.5}>
      {/* Main body - stainless steel */}
      <Cylinder args={[0.3, 0.3, 2.5, 32]}>
        <meshStandardMaterial 
          color="#d0d0d0" 
          metalness={0.95} 
          roughness={0.15}
          envMapIntensity={1.5}
        />
      </Cylinder>
      
      {/* Nose cone */}      <Cone args={[0.3, 0.8, 32]} position={[0, 1.65, 0]}>
        <meshStandardMaterial color="#c8c8c8" metalness={0.95} roughness={0.1} />
      </Cone>
      
      {/* Forward flaps (grid fins) */}
      <Box args={[0.6, 0.05, 0.25]} position={[0.35, 0.6, 0]} rotation={[0, 0, Math.PI/6]}>
        <meshStandardMaterial color="#8a8a8a" metalness={0.85} roughness={0.3} />
      </Box>
      <Box args={[0.6, 0.05, 0.25]} position={[-0.35, 0.6, 0]} rotation={[0, 0, -Math.PI/6]}>
        <meshStandardMaterial color="#8a8a8a" metalness={0.85} roughness={0.3} />
      </Box>
      
      {/* Aft flaps */}
      <Box args={[0.7, 0.05, 0.3]} position={[0.4, -1, 0]} rotation={[0, 0, Math.PI/8]}>
        <meshStandardMaterial color="#888" metalness={0.85} roughness={0.3} />
      </Box>
      <Box args={[0.7, 0.05, 0.3]} position={[-0.4, -1, 0]} rotation={[0, 0, -Math.PI/8]}>
        <meshStandardMaterial color="#888" metalness={0.85} roughness={0.3} />
      </Box>
      
      {/* Heat tiles - black */}
      <Cylinder args={[0.31, 0.31, 1.2, 32]} position={[0, 0.3, 0]}>
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.9} />
      </Cylinder>
      
      {/* Raptor engines */}
      <group position={[0, -1.4, 0]}>
        <Cylinder args={[0.08, 0.1, 0.15]} position={[0.12, 0, 0.12]}>
          <meshStandardMaterial color="#4a4a4a" metalness={0.9} />
        </Cylinder>
        <Cylinder args={[0.08, 0.1, 0.15]} position={[-0.12, 0, 0.12]}>
          <meshStandardMaterial color="#4a4a4a" metalness={0.9} />
        </Cylinder>
        <Cylinder args={[0.08, 0.1, 0.15]} position={[0, 0, -0.12]}>
          <meshStandardMaterial color="#4a4a4a" metalness={0.9} />
        </Cylinder>
      </group>
      
      <pointLight color="#ffaa00" intensity={5} distance={8} />
    </group>
  );
}

// REALISTIC STARLINK
function StarlinkModel() {
  return (
    <group scale={0.4}>
      {/* Main body */}
      <Box args={[0.8, 0.1, 0.5]}>
        <meshStandardMaterial color="#2a2a2a" metalness={0.9} roughness={0.2} />
      </Box>
      
      {/* Solar panel */}
      <Box args={[1.2, 0.015, 0.4]} position={[0, 0.15, 0]}>
        <meshStandardMaterial 
          color="#1a3d5c" 
          metalness={0.95} 
          roughness={0.05}
          emissive="#2066aa"
          emissiveIntensity={0.2}
        />
      </Box>
      
      {/* Antennas */}
      <Cylinder args={[0.02, 0.02, 0.15]} position={[0.2, -0.08, 0]}>
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} />
      </Cylinder>
      <Cylinder args={[0.02, 0.02, 0.15]} position={[-0.2, -0.08, 0]}>
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} />
      </Cylinder>
      
      <pointLight color="#00ff88" intensity={3} distance={5} />
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
      
      const radius = EARTH_RADIUS + (mission.alt / 100);
      const inclinationRad = mission.inclination * Math.PI / 180;
      
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle) * Math.sin(inclinationRad);
      const z = radius * Math.sin(angle) * Math.cos(inclinationRad);
      
      groupRef.current.position.set(x, y, z);
      
      const nextAngle = angle + 0.01;
      const nextX = radius * Math.cos(nextAngle);
      const nextZ = radius * Math.sin(nextAngle) * Math.cos(inclinationRad);
      groupRef.current.lookAt(nextX, y, nextZ);
      
      onPositionUpdate([x, y, z]);
    }
  });
  
  const orbitPath = useMemo(() => 
    generateOrbitPath(mission.alt, mission.inclination), 
    [mission]
  );
  
  const Model = mission.model === 'iss' ? ISSModel : mission.model === 'starship' ? StarshipModel : StarlinkModel;
  
  return (
    <group ref={groupRef}>
      <Line points={orbitPath} color={mission.color} lineWidth={1.5} transparent opacity={0.5} />
      <Model />
    </group>
  );
}

function RotatingEarth({ timeScale }: { timeScale: number }) {
  const earthRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  
  useFrame((state, delta) => {
    if (earthRef.current && timeScale > 0) {
      // FIXED: Earth takes 86400 seconds (24 hours) for one rotation
      // At 1× speed, rotation per second = 2π / 86400
      const rotationPerSecond = (Math.PI * 2) / 86400;
      const rotationThisFrame = rotationPerSecond * delta * timeScale;
      rotationRef.current += rotationThisFrame;
      earthRef.current.rotation.y = rotationRef.current;
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
  const [timeScale, setTimeScale] = useState(1);
  const [selectedMission, setSelectedMission] = useState(0);
  const [spacecraftPositions, setSpacecraftPositions] = useState<any[]>([]);
  
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
        <color attach="background" args={["#000005"]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[30, 20, 10]} intensity={6} castShadow />
        <pointLight position={[0, 0, 0]} intensity={4} distance={100} />
        
        <StarsField />
        <RotatingEarth timeScale={playing ? timeScale : 0} />
        
        {playing && missions.map((m, i) => (
          <OrbitingSpacecraft key={i} mission={m} index={i} timeScale={timeScale} onPositionUpdate={updatePosition(i)} />
        ))}
        
        <SpaceCamera target={spacecraftPositions[selectedMission]} enabled={!freeCam} />
        
        <EffectComposer>
          <Bloom intensity={2.5} luminanceThreshold={0.05} luminanceSmoothing={0.9} />
        </EffectComposer>
        
        <OrbitControls enabled={freeCam} enableDamping dampingFactor={0.05} />
      </Canvas>
      
      <div style={{position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',display:'flex',gap:12,background:'rgba(5,10,15,0.95)',padding:'14px 28px',borderRadius:10,border:'1px solid rgba(0,200,255,0.3)',boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:100}}>
        <button onClick={()=>setFreeCam(!freeCam)} style={{background:freeCam?'#00ccff':'#1a1a1a',color:freeCam?'#000':'#0cf',border:'1px solid #0cf',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{freeCam?'🎥 FREE':'🎯 TRACK'}</button>
        <button onClick={()=>setPlaying(!playing)} style={{background:playing?'#00ff88':'#ff3333',color:'#000',border:'none',padding:'10px 20px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
        <div style={{width:1,height:36,background:'rgba(0,200,255,0.2)'}}/>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{color:'rgba(0,200,255,0.8)',fontSize:12,fontWeight:700}}>TIME</span>
          <select value={timeScale} onChange={(e)=>setTimeScale(Number(e.target.value))} style={{background:'#1a1a1a',color:'#0cf',border:'1px solid #0cf',padding:'10px 16px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12,fontFamily:'monospace'}}>
            <option value={1}>1× REAL-TIME 🦅</option>
            <option value={60}>60× (1 min/sec)</option>
            <option value={360}>360× (6 min/sec)</option>
            <option value={1440}>1440× (24 min/sec)</option>
            <option value={3600}>3600× (1 hr/sec)</option>
          </select>
        </div>
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
