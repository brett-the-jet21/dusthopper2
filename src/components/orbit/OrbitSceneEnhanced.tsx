"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Sphere } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState, useMemo, useRef, Suspense } from "react";
import * as THREE from "three";

import { EarthPro } from "./EarthPro";
import { StarsField } from "./StarsField";

const EARTH_RADIUS = 6.371;

// PERFECT CIRCULAR ORBIT - no more ellipses!
function generateCircularOrbit(altitude: number, inclination: number) {
  const points: THREE.Vector3[] = [];
  const radius = EARTH_RADIUS + (altitude / 100);
  const incRad = (inclination * Math.PI) / 180;
  const segments = 128;
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    
    // Start with a circle in the XY plane
    const x = radius * Math.cos(theta);
    const y = radius * Math.sin(theta);
    const z = 0;
    
    // Rotate around X axis by inclination angle
    const rotatedY = y * Math.cos(incRad) - z * Math.sin(incRad);
    const rotatedZ = y * Math.sin(incRad) + z * Math.cos(incRad);
    
    points.push(new THREE.Vector3(x, rotatedY, rotatedZ));
  }
  
  return points;
}

function Sun() {
  return (
    <group position={[100, 0, 0]}>
      <Sphere args={[0.5, 32, 32]}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>
      <pointLight color="#ffffff" intensity={200} distance={500} decay={1} />
      <Sphere args={[1.5, 32, 32]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
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

function OrbitingSpacecraft({ mission, index, timeScale, onPositionUpdate }: any) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      const orbitalPeriod = 90 * 60;
      const scaledTime = state.clock.elapsedTime * timeScale;
      const progress = (scaledTime / orbitalPeriod + (index * 0.33)) % 1;
      const theta = progress * Math.PI * 2;
      
      const radius = EARTH_RADIUS + (mission.alt / 100);
      const incRad = (mission.inclination * Math.PI) / 180;
      
      // Circle in XY plane
      const x = radius * Math.cos(theta);
      const y = radius * Math.sin(theta);
      const z = 0;
      
      // Rotate by inclination
      const rotatedY = y * Math.cos(incRad) - z * Math.sin(incRad);
      const rotatedZ = y * Math.sin(incRad) + z * Math.cos(incRad);
      
      groupRef.current.position.set(x, rotatedY, rotatedZ);
      
      // Point forward
      const nextTheta = theta + 0.01;
      const nextX = radius * Math.cos(nextTheta);
      const nextY = radius * Math.sin(nextTheta);
      const nextRotatedY = nextY * Math.cos(incRad);
      const nextRotatedZ = nextY * Math.sin(incRad);
      groupRef.current.lookAt(nextX, nextRotatedY, nextRotatedZ);
      
      onPositionUpdate([x, rotatedY, rotatedZ]);
    }
  });
  
  const Model = mission.model === 'iss' ? DetailedISS : mission.model === 'starship' ? DetailedStarship : DetailedStarlink;
  
  return (
    <group ref={groupRef}>
      <Suspense fallback={null}><Model /></Suspense>
    </group>
  );
}

function RotatingEarth({ timeScale, paused }: { timeScale: number; paused: boolean }) {
  const earthRef = useRef<THREE.Group>(null);
  const baseRotationRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  
  useFrame((state, delta) => {
    if (earthRef.current) {
      if (baseRotationRef.current === null) {
        const now = new Date();
        const utcHours = now.getUTCHours();
        const utcMinutes = now.getUTCMinutes();
        const utcSeconds = now.getUTCSeconds();
        const totalUTCHours = utcHours + utcMinutes / 60 + utcSeconds / 3600;
        baseRotationRef.current = (totalUTCHours / 24) * Math.PI * 2;
      }
      
      if (!paused && timeScale > 0) {
        const rotationPerSecond = (Math.PI * 2) / 86400;
        elapsedRef.current += delta * rotationPerSecond * timeScale;
      }
      
      earthRef.current.rotation.y = baseRotationRef.current + elapsedRef.current;
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
      const distance = 15 / zoom;
      const offset = targetPos.clone().normalize().multiplyScalar(distance);
      const desiredPos = offset.add(new THREE.Vector3(0, 5 / zoom, 0));
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
  
  const missions = useMemo(() => [
    { name: "ISS", color: "#00ffcc", alt: 408, inclination: 51.6, model: 'iss' },
    { name: "STARSHIP HLS-1", color: "#ffaa00", alt: 350, inclination: 28.5, model: 'starship' },
    { name: "STARLINK-6548", color: "#00ff88", alt: 550, inclination: 53, model: 'starlink' },
  ], []);
  
  const orbitPaths = useMemo(() => 
    missions.map(m => generateCircularOrbit(m.alt, m.inclination)),
    [missions]
  );
  
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
      <Canvas camera={{ position: [0, 12, 22], fov: 50 }}>
        <color attach="background" args={["#000005"]} />
        <Sun />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 0, 0]} intensity={12} castShadow />
        <StarsField />
        <RotatingEarth timeScale={timeScale} paused={!playing} />
        
        {/* Render orbit paths */}
        {orbitPaths.map((path, i) => (
          <Line key={`path-${i}`} points={path} color={missions[i].color} lineWidth={2} transparent opacity={0.7} />
        ))}
        
        {/* Render spacecraft */}
        {missions.map((m, i) => (
          <OrbitingSpacecraft 
            key={i} 
            mission={m} 
            index={i} 
            timeScale={playing ? timeScale : 0} 
            onPositionUpdate={updatePosition(i)} 
          />
        ))}
        
        <SpaceCamera target={spacecraftPositions[selectedMission]} enabled={!freeCam} zoom={zoom} />
        <EffectComposer><Bloom intensity={3} luminanceThreshold={0.15} luminanceSmoothing={0.9} /></EffectComposer>
        <OrbitControls enabled={freeCam} enableDamping dampingFactor={0.05} />
      </Canvas>
      
      <div style={{position:'fixed',top:0,left:0,right:0,height:70,background:'linear-gradient(180deg, rgba(0,15,30,0.98) 0%, rgba(0,10,20,0.95) 100%)',borderBottom:'2px solid rgba(0,200,255,0.4)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 30px',zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.8)'}}>
        <div style={{display:'flex',gap:15}}>
          <button onClick={()=>setFreeCam(!freeCam)} style={{background:freeCam?'linear-gradient(135deg, #00ccff, #0099cc)':'rgba(10,20,30,0.8)',color:freeCam?'#000':'#0cf',border:'2px solid #0cf',padding:'12px 24px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,boxShadow:freeCam?'0 0 20px rgba(0,204,255,0.6)':'none',transition:'all 0.2s'}}>{freeCam?'🎥 FREE CAM':'🎯 TRACKING'}</button>
          <button onClick={()=>setPlaying(!playing)} style={{background:playing?'linear-gradient(135deg, #00ff88, #00cc66)':'linear-gradient(135deg, #ff4444, #cc0000)',color:'#000',border:'none',padding:'12px 24px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,boxShadow:playing?'0 0 20px rgba(0,255,136,0.6)':'0 0 20px rgba(255,68,68,0.6)',transition:'all 0.2s'}}>{playing?'⏸ PAUSE':'▶ PLAY'}</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{color:'rgba(0,200,255,0.9)',fontSize:13,fontWeight:700,letterSpacing:1.5,textTransform:'uppercase'}}>TIME SCALE</span>
          <select value={timeScale} onChange={(e)=>setTimeScale(Number(e.target.value))} style={{background:'rgba(10,20,30,0.9)',color:'#0cf',border:'2px solid #0cf',padding:'10px 18px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'monospace',letterSpacing:0.5}}>
            <option value={1}>1× REAL-TIME</option>
            <option value={60}>60×</option>
            <option value={360}>360×</option>
            <option value={1440}>1440×</option>
            <option value={3600}>3600×</option>
          </select>
        </div>
      </div>
      
      <div style={{position:'fixed',left:25,top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',gap:10,background:'rgba(0,15,30,0.95)',padding:15,borderRadius:8,border:'2px solid rgba(0,200,255,0.4)',zIndex:100,boxShadow:'0 8px 24px rgba(0,0,0,0.8)'}}>
        <button onClick={()=>setZoom(z=>Math.min(z*1.3,4))} style={{background:'rgba(10,20,30,0.8)',color:'#0cf',border:'2px solid #0cf',padding:'10px 16px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:20,lineHeight:1,transition:'all 0.2s'}}>+</button>
        <div style={{color:'#0cf',fontSize:12,fontWeight:700,textAlign:'center',fontFamily:'monospace',padding:'5px 0'}}>{zoom.toFixed(1)}×</div>
        <button onClick={()=>setZoom(z=>Math.max(z/1.3,0.4))} style={{background:'rgba(10,20,30,0.8)',color:'#0cf',border:'2px solid #0cf',padding:'10px 16px',borderRadius:6,cursor:'pointer',fontWeight:700,fontSize:20,lineHeight:1,transition:'all 0.2s'}}>−</button>
      </div>
      
      <div style={{position:'fixed',bottom:25,left:'50%',transform:'translateX(-50%)',display:'flex',gap:18,zIndex:100}}>{missions.map((m,i)=><button key={i} onClick={()=>setSelectedMission(i)} style={{background:i===selectedMission?`linear-gradient(135deg,${m.color},${m.color}dd)`:'rgba(0,15,30,0.95)',color:i===selectedMission?'#000':'#fff',border:`2px solid ${m.color}`,padding:'14px 32px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,letterSpacing:1,textTransform:'uppercase',boxShadow:i===selectedMission?`0 0 30px ${m.color}80, 0 8px 20px rgba(0,0,0,0.8)`:'0 4px 12px rgba(0,0,0,0.6)',transition:'all 0.3s'}}>{m.name}</button>)}</div>
      
      <div style={{position:'fixed',top:90,right:25,width:280,background:'rgba(0,15,30,0.98)',border:'2px solid rgba(0,200,255,0.4)',borderRadius:10,padding:'20px 24px',color:'#0cf',fontSize:12,fontFamily:'monospace',boxShadow:'0 8px 32px rgba(0,0,0,0.9)',zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18,paddingBottom:16,borderBottom:'2px solid rgba(0,200,255,0.3)'}}>
          <div style={{width:10,height:10,borderRadius:'50%',background:'#0f8',boxShadow:'0 0 15px #0f8'}}/>
          <div style={{fontWeight:700,fontSize:15,letterSpacing:0.5}}>{missions[selectedMission].name}</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,padding:'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>ALTITUDE</span><span style={{fontWeight:700,color:'#0ff',fontSize:13}}>{missions[selectedMission].alt} km</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,padding:'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>VELOCITY</span><span style={{fontWeight:700,color:'#0ff',fontSize:13}}>7.66 km/s</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,padding:'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>VELOCITY 🇺🇸</span><span style={{fontWeight:700,color:'#0ff',fontSize:13}}>{velocityMph} mph</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,padding:'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>INCLINATION</span><span style={{fontWeight:700,color:'#0ff',fontSize:13}}>{missions[selectedMission].inclination}°</span></div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16,padding:'8px 0'}}><span style={{opacity:0.8,letterSpacing:0.5}}>PERIOD</span><span style={{fontWeight:700,color:'#0ff',fontSize:13}}>~90 min</span></div>
        <div style={{borderTop:'2px solid rgba(0,200,255,0.3)',paddingTop:14}}><div style={{opacity:0.7,fontSize:11,marginBottom:6,letterSpacing:0.5}}>TIME MULTIPLIER</div><div style={{fontWeight:700,fontSize:18,color:'#00ff88'}}>{timeScale}× {timeScale===1&&'🦅'}</div></div>
      </div>
    </div>
  );
}
